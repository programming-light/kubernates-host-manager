import { FastifyRequest, FastifyReply } from 'fastify';
import log from '../lib/logger.js';
import prisma from '../lib/prisma.js';

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const GITHUB_REDIRECT_URI = process.env.GITHUB_REDIRECT_URI || 'http://localhost:3001/api/v1/github/callback';
const GITHUB_APP_NAME = process.env.GITHUB_APP_NAME;

function requireGitHubConfig(reply: FastifyReply): boolean {
  if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
    reply.status(500).send({ error: 'Server Error', message: 'GitHub OAuth not configured' });
    return false;
  }
  return true;
}

async function getInstallationToken(installationId: number, appToken: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/app/installations/${installationId}/access_tokens`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${appToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      },
    );
    if (!res.ok) return null;
    const { token } = await res.json();
    return token;
  } catch {
    return null;
  }
}

let _jwt: any = null;
async function getJwt(): Promise<any> {
  if (!_jwt) _jwt = await import('jsonwebtoken').then(m => m.default);
  return _jwt;
}

async function getAppToken(): Promise<string | null> {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return null;
  try {
    const jwt = await getJwt();
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iss: process.env.GITHUB_APP_ID, iat: now, exp: now + 60 },
      privateKey,
      { algorithm: 'RS256' },
    );
  } catch {
    return null;
  }
}

export async function githubLogin(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId;
  if (!userId) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  if (!requireGitHubConfig(reply)) return;

  const params = new URLSearchParams({
    client_id: GITHUB_CLIENT_ID!,
    redirect_uri: GITHUB_REDIRECT_URI,
    scope: 'repo,user:email,admin:repo_hook',
    state: userId,
  });

  reply.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}

export async function githubCallback(request: FastifyRequest, reply: FastifyReply) {
  if (!requireGitHubConfig(reply)) return;

  const { code, state } = request.query as any;

  if (!code) {
    return reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=no_code`);
  }

  try {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: GITHUB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=token_failed`);
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const githubUser = await userRes.json();

    const userId = state;
    await prisma.user.update({
      where: { id: userId },
      data: {
        githubToken: accessToken,
        githubUsername: githubUser.login,
      },
    });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
    reply.redirect(`${clientUrl}/dashboard/projects/new?github=connected`);
  } catch (err: any) {
    log.error('GitHub OAuth callback error:', err.message);
    reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=oauth_failed`);
  }
}

async function fetchWithAuth(url: string, token: string): Promise<any[]> {
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      log.warn(`GitHub API ${url} returned ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    log.warn(`GitHub API fetch failed for ${url}: ${err.message}`);
    return [];
  }
}

export async function getRepos(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;

  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.githubToken) {
    return reply.status(400).send({ error: 'Bad Request', message: 'GitHub not connected. Please connect your GitHub account first.' });
  }

  try {
    const token = user.githubToken;
    const seen = new Set<number>();
    const allRepos: any[] = [];

    // 1. Fetch personal repos (owner only — org repos come from installations)
    const personalRepos = await fetchWithAuth(
      'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner',
      token,
    );
    for (const repo of personalRepos) {
      if (!seen.has(repo.id)) { seen.add(repo.id); allRepos.push(repo); }
    }

    // 4. If GitHub App is configured, also fetch from installations (like Vercel)
    //    GitHub App installations bypass org-level OAuth restrictions.
    const appToken = await getAppToken();
    if (appToken) {
      const installations = await fetchWithAuth('https://api.github.com/app/installations', appToken);
      for (const inst of installations) {
        const installToken = await getInstallationToken(inst.id, appToken);
        if (!installToken) continue;
        const reposRes = await fetch(
          `https://api.github.com/installation/repositories?per_page=100`,
          { headers: { Authorization: `Bearer ${installToken}`, Accept: 'application/vnd.github.v3+json' } },
        );
        if (!reposRes.ok) continue;
        const { repositories } = await reposRes.json();
        for (const repo of (repositories || [])) {
          if (!seen.has(repo.id)) { seen.add(repo.id); allRepos.push(repo); }
        }
      }
    }

    // 5. Also fetch from user's stored GitHub App installations
    const storedInstallations = await prisma.gitHubInstallation.findMany({ where: { userId } });
    for (const si of storedInstallations) {
      if (!appToken) continue;
      const installToken = await getInstallationToken(si.installationId, appToken);
      if (!installToken) continue;
      const reposRes = await fetch(
        `https://api.github.com/installation/repositories?per_page=100`,
        { headers: { Authorization: `Bearer ${installToken}`, Accept: 'application/vnd.github.v3+json' } },
      );
      if (!reposRes.ok) continue;
      const { repositories } = await reposRes.json();
      for (const repo of (repositories || [])) {
        if (!seen.has(repo.id)) { seen.add(repo.id); allRepos.push(repo); }
      }
    }

    const filtered = allRepos.map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: repo.html_url,
      cloneUrl: repo.clone_url,
      sshUrl: repo.ssh_url,
      language: repo.language,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at,
      private: repo.private,
      fork: repo.fork,
    }));

    reply.send(filtered);
  } catch (err: any) {
    log.error('Failed to fetch GitHub repos:', err.message);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch repositories' });
  }
}

export async function disconnectGitHub(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId;
  if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { githubToken: null, githubUsername: null },
    });
    await prisma.gitHubInstallation.deleteMany({ where: { userId } });
    reply.send({ message: 'GitHub disconnected successfully' });
  } catch (err: any) {
    log.error('Failed to disconnect GitHub:', err.message);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to disconnect GitHub' });
  }
}

// === GitHub App Installation Flow (like Vercel) ===

export async function githubAppInstall(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId;
  if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

  if (!process.env.GITHUB_APP_NAME) {
    return reply.status(400).send({ error: 'Bad Request', message: 'GitHub App not configured. Set GITHUB_APP_NAME in .env' });
  }

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';
  const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_NAME}/installations/new?state=${userId}&redirect_uri=${encodeURIComponent(clientUrl + '/dashboard/projects/new?github=connected')}`;
  reply.redirect(installUrl);
}

export async function githubAppCallback(request: FastifyRequest, reply: FastifyReply) {
  const { installation_id, setup_action, state } = request.query as any;

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:3000';

  if (!installation_id) {
    return reply.redirect(`${clientUrl}/dashboard/projects/new?error=install_failed`);
  }

  if (state) {
    const appToken = await getAppToken();
    if (appToken) {
      try {
        const instRes = await fetch(
          `https://api.github.com/app/installations/${installation_id}`,
          { headers: { Authorization: `Bearer ${appToken}` } },
        );
        if (instRes.ok) {
          const installData = await instRes.json() as any;
          if (installData?.account) {
            await prisma.gitHubInstallation.upsert({
              where: { userId_installationId: { userId: state, installationId: parseInt(installation_id) } },
              update: { orgLogin: installData.account.login, orgAvatar: installData.account.avatar_url, permissions: installData.permissions },
              create: {
                userId: state,
                installationId: parseInt(installation_id),
                orgLogin: installData.account.login,
                orgAvatar: installData.account.avatar_url,
                permissions: installData.permissions,
              },
            });
            log.info(`GitHub App installed: org=${installData.account.login}, user=${state}`);
          }
        }
      } catch (dbErr: any) {
        log.warn(`Failed to save GitHub installation: ${dbErr.message}`);
      }
    }
  }

  reply.redirect(`${clientUrl}/dashboard/projects/new?github=connected`);
}

export async function getGitHubInstallations(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  try {
    const installations = await prisma.gitHubInstallation.findMany({ where: { userId } });
    reply.send(installations);
  } catch (err: any) {
    log.error('Failed to fetch GitHub installations:', err.message);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch installations' });
  }
}

export async function setupWebhook(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { owner, repo } = request.body as any;

  if (!owner || !repo) {
    return reply.status(400).send({ error: 'Bad Request', message: 'owner and repo are required' });
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.githubToken) {
    return reply.status(400).send({ error: 'Bad Request', message: 'GitHub not connected' });
  }

  const webhookUrl = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/github/webhook`;
  if (!process.env.GITHUB_WEBHOOK_SECRET) {
  throw new Error('GITHUB_WEBHOOK_SECRET environment variable is required');
}
const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  try {
    const existingHooks = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      headers: { Authorization: `Bearer ${user.githubToken}` },
    });
    const hooks = await existingHooks.json();

    const alreadyExists = Array.isArray(hooks) && hooks.some(
      (h: any) => h.config?.url === webhookUrl
    );

    if (alreadyExists) {
      return reply.send({ message: 'Webhook already exists', exists: true });
    }

    const createRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/hooks`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${user.githubToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'web',
        active: true,
        events: ['push'],
        config: {
          url: webhookUrl,
          content_type: 'json',
          secret: webhookSecret,
        },
      }),
    });

    const result = await createRes.json();
    if (createRes.ok) {
      reply.send({ message: 'Webhook created successfully', id: result.id });
    } else {
      reply.status(400).send({ error: 'Failed to create webhook', details: result });
    }
  } catch (err: any) {
    log.error('Failed to setup webhook:', err.message);
    reply.status(500).send({ error: 'Internal Server Error', message: err.message });
  }
}

export async function webhookHandler(request: FastifyRequest, reply: FastifyReply) {
  const event = request.headers['x-github-event'] as string;
  const signature = request.headers['x-hub-signature-256'] as string;

  const body = request.body as any;

  if (process.env.GITHUB_WEBHOOK_SECRET && signature) {
    const crypto = await import('crypto');
    const hmac = crypto.createHmac('sha256', process.env.GITHUB_WEBHOOK_SECRET);
    const digest = 'sha256=' + hmac.update(JSON.stringify(body)).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature))) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid signature' });
    }
  }

  if (event !== 'push') {
    return reply.status(200).send({ ok: true });
  }
  const repoFullName = body.repository?.full_name;
  const branch = body.ref?.replace('refs/heads/', '');
  const commitSha = body.after;
  const commitMsg = body.head_commit?.message || '';

  if (!repoFullName || !branch) {
    return reply.status(200).send({ ok: true });
  }

  const project = await prisma.project.findFirst({
    where: {
      gitUrl: { contains: repoFullName },
      branch,
      autoDeploy: true,
    },
  });

  if (!project) {
    return reply.status(200).send({ ok: true, message: 'No matching project for auto-deploy' });
  }

  reply.status(200).send({ ok: true, message: 'Pipeline triggered' });

  const { runPipelineAsync } = await import('./cicd.controller.js');

  try {
    const pipeline = await prisma.cICDPipeline.create({
      data: {
        projectId: project.id,
        userId: project.userId,
        gitUrl: project.gitUrl,
        branch,
        status: 'IDLE',
        lastCommitSha: commitSha,
        lastCommitMsg: commitMsg,
        triggeredBy: 'webhook',
      },
    });

    await runPipelineAsync(pipeline.id, project, branch);
  } catch (err: any) {
    log.error(`Webhook pipeline failed for ${repoFullName}:`, err.message);
  }
}
