import { FastifyRequest, FastifyReply } from 'fastify';
import log from '../lib/logger.js';
import prisma from '../lib/prisma.js';

const GITLAB_CLIENT_ID = process.env.GITLAB_CLIENT_ID;
const GITLAB_CLIENT_SECRET = process.env.GITLAB_CLIENT_SECRET;
const GITLAB_REDIRECT_URI = process.env.GITLAB_REDIRECT_URI || 'http://localhost:3001/api/v1/sources/gitlab/callback';

const GITEA_CLIENT_ID = process.env.GITEA_CLIENT_ID;
const GITEA_CLIENT_SECRET = process.env.GITEA_CLIENT_SECRET;
const GITEA_URL = process.env.GITEA_URL || 'https://gitea.com';
const GITEA_REDIRECT_URI = process.env.GITEA_REDIRECT_URI || 'http://localhost:3001/api/v1/sources/gitea/callback';

export async function getSourcesStatus(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  reply.send({
    github: { connected: !!(user?.githubToken), username: user?.githubUsername || null },
    gitlab: { connected: !!(user?.gitlabToken), username: user?.gitlabUsername || null },
    gitea: { connected: !!(user?.giteaToken), username: user?.giteaUsername || null, url: user?.giteaUrl || GITEA_URL },
    dockerhub: { connected: true, available: true },
  });
}

export async function disconnectSource(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { provider } = request.params as any;

  const updateData: any = {};
  switch (provider) {
    case 'github':
      updateData.githubToken = null; updateData.githubUsername = null; break;
    case 'gitlab':
      updateData.gitlabToken = null; updateData.gitlabUsername = null; break;
    case 'gitea':
      updateData.giteaToken = null; updateData.giteaUsername = null; updateData.giteaUrl = null; break;
    default:
      return reply.status(400).send({ error: 'Bad Request', message: `Unknown provider: ${provider}` });
  }

  await prisma.user.update({ where: { id: userId }, data: updateData });
  reply.send({ message: `${provider} disconnected` });
}

export async function gitlabLogin(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId;
  if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

  if (!GITLAB_CLIENT_ID || !GITLAB_CLIENT_SECRET) {
    return reply.status(500).send({ error: 'Server Error', message: 'GitLab OAuth not configured' });
  }

  const params = new URLSearchParams({
    client_id: GITLAB_CLIENT_ID!,
    redirect_uri: GITLAB_REDIRECT_URI,
    response_type: 'code',
    scope: 'api read_user',
    state: userId,
  });

  reply.redirect(`https://gitlab.com/oauth/authorize?${params.toString()}`);
}

export async function gitlabCallback(request: FastifyRequest, reply: FastifyReply) {
  const { code, state } = request.query as any;
  if (!code) {
    return reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=gitlab_no_code`);
  }

  try {
    const tokenRes = await fetch('https://gitlab.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: GITLAB_CLIENT_ID,
        client_secret: GITLAB_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: GITLAB_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=gitlab_token_failed`);
    }

    const userRes = await fetch('https://gitlab.com/api/v4/user', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const gitlabUser = await userRes.json();

    const userId = state;
    await prisma.user.update({
      where: { id: userId },
      data: { gitlabToken: accessToken, gitlabUsername: gitlabUser.username },
    });

    reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?gitlab=connected`);
  } catch (err: any) {
    log.error('GitLab OAuth callback error:', err.message);
    reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=gitlab_oauth_failed`);
  }
}

export async function getGitlabRepos(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.gitlabToken) {
    return reply.status(400).send({ error: 'Bad Request', message: 'GitLab not connected.' });
  }

  try {
    const reposRes = await fetch('https://gitlab.com/api/v4/projects?membership=true&per_page=100&order_by=updated_at&sort=desc', {
      headers: { Authorization: `Bearer ${user.gitlabToken}` },
    });
    const repos = await reposRes.json();

    const filtered = (Array.isArray(repos) ? repos : []).map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.path_with_namespace,
      description: repo.description,
      htmlUrl: repo.web_url,
      cloneUrl: repo.http_url_to_repo,
      sshUrl: repo.ssh_url_to_repo,
      language: repo.programming_language,
      defaultBranch: repo.default_branch || 'main',
      updatedAt: repo.last_activity_at,
      visibility: repo.visibility,
    }));

    reply.send(filtered);
  } catch (err: any) {
    log.error('Failed to fetch GitLab repos:', err.message);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch repositories' });
  }
}

export async function giteaLogin(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId;
  if (!userId) return reply.status(401).send({ error: 'Unauthorized' });

  const { serverUrl } = request.query as any;
  const baseUrl = serverUrl || GITEA_URL;

  if (!GITEA_CLIENT_ID || !GITEA_CLIENT_SECRET) {
    return reply.status(500).send({ error: 'Server Error', message: 'Gitea OAuth not configured. Set GITEA_CLIENT_ID and GITEA_CLIENT_SECRET.' });
  }

  const params = new URLSearchParams({
    client_id: GITEA_CLIENT_ID!,
    redirect_uri: GITEA_REDIRECT_URI,
    response_type: 'code',
    state: `${userId}:${baseUrl}`,
  });

  reply.redirect(`${baseUrl}/login/oauth/authorize?${params.toString()}`);
}

export async function giteaCallback(request: FastifyRequest, reply: FastifyReply) {
  const { code, state } = request.query as any;
  if (!code) {
    return reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=gitea_no_code`);
  }

  const [userId, serverUrl] = (state || '').split(':');
  const baseUrl = serverUrl || GITEA_URL;

  try {
    const tokenRes = await fetch(`${baseUrl}/login/oauth/access_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        client_id: GITEA_CLIENT_ID,
        client_secret: GITEA_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: GITEA_REDIRECT_URI,
      }),
    });

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    if (!accessToken) {
      return reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=gitea_token_failed`);
    }

    const userRes = await fetch(`${baseUrl}/api/v1/user`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const giteaUser = await userRes.json();

    await prisma.user.update({
      where: { id: userId },
      data: { giteaToken: accessToken, giteaUsername: giteaUser.login, giteaUrl: baseUrl },
    });

    reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?gitea=connected`);
  } catch (err: any) {
    log.error('Gitea OAuth callback error:', err.message);
    reply.redirect(`${process.env.CLIENT_URL || 'http://localhost:3000'}/dashboard/projects/new?error=gitea_oauth_failed`);
  }
}

export async function getGiteaRepos(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user?.giteaToken) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Gitea not connected.' });
  }

  const baseUrl = user.giteaUrl || GITEA_URL;

  try {
    const reposRes = await fetch(`${baseUrl}/api/v1/user/repos?sort=updated&per_page=100`, {
      headers: { Authorization: `Bearer ${user.giteaToken}` },
    });
    const repos = await reposRes.json();

    const filtered = (Array.isArray(repos) ? repos : []).map((repo: any) => ({
      id: repo.id,
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description,
      htmlUrl: `${baseUrl}/${repo.full_name}`,
      cloneUrl: `${baseUrl}/${repo.full_name}.git`,
      sshUrl: repo.ssh_url,
      language: repo.language,
      defaultBranch: repo.default_branch || 'main',
      updatedAt: repo.updated_at,
      private: repo.private,
    }));

    reply.send(filtered);
  } catch (err: any) {
    log.error('Failed to fetch Gitea repos:', err.message);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch repositories' });
  }
}

export async function setupGitea(request: FastifyRequest, reply: FastifyReply) {
  const { url } = request.body as any;
  if (!url) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Gitea server URL is required' });
  }

  try {
    const healthRes = await fetch(`${url}/api/v1/version`, { method: 'GET' });
    if (!healthRes.ok) throw new Error('Cannot reach Gitea server');
    const data = await healthRes.json();
    reply.send({ ok: true, version: data.version, url });
  } catch (err: any) {
    reply.status(400).send({ error: 'Bad Request', message: `Cannot connect to Gitea at ${url}: ${err.message}` });
  }
}

export async function searchDockerHub(request: FastifyRequest, reply: FastifyReply) {
  const { query } = request.query as any;
  if (!query) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Search query is required' });
  }

  try {
    const searchRes = await fetch(`https://hub.docker.com/v2/repositories/library/${query}/?page_size=20`, {
      headers: { 'Accept': 'application/json' },
    });

    if (searchRes.ok) {
      const data = await searchRes.json();
      const results = [{
        id: `library/${query}`,
        name: query,
        fullName: `library/${query}`,
        description: data.description || '',
        starCount: data.star_count || 0,
        pullCount: data.pull_count || 0,
        isOfficial: true,
        image: query,
        tags: [],
      }];
      return reply.send({ results, total: 1 });
    }

    const searchRes2 = await fetch(`https://hub.docker.com/v2/repositories/search?query=${encodeURIComponent(query)}&page_size=20`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!searchRes2.ok) {
      return reply.status(502).send({ error: 'Bad Gateway', message: 'Docker Hub search failed' });
    }

    const data = await searchRes2.json();
    const results = (data.results || data.summaries || []).map((r: any) => ({
      id: r.name,
      name: r.name?.split('/').pop() || r.name,
      fullName: r.name,
      description: r.description || r.short_description || '',
      starCount: r.star_count || 0,
      pullCount: r.pull_count || 0,
      isOfficial: r.is_official || r.name?.startsWith('library/') || false,
      image: r.name,
      tags: [],
    }));

    reply.send({ results, total: data.total || results.length });
  } catch (err: any) {
    log.error('Docker Hub search error:', err.message);
    reply.status(500).send({ error: 'Internal Server Error', message: err.message });
  }
}

export async function getDockerHubTags(request: FastifyRequest, reply: FastifyReply) {
  const { image } = request.query as any;
  if (!image) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Image name is required' });
  }

  try {
    const res = await fetch(`https://hub.docker.com/v2/repositories/${image}/tags?page_size=50`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!res.ok) {
      return reply.status(404).send({ error: 'Not Found', message: 'Image not found on Docker Hub' });
    }

    const data = await res.json();
    const tags = (data.results || []).map((t: any) => ({
      name: t.name,
      size: t.full_size,
      lastUpdated: t.last_updated,
    }));

    reply.send(tags);
  } catch (err: any) {
    log.error('Docker Hub tags error:', err.message);
    reply.status(500).send({ error: 'Internal Server Error', message: err.message });
  }
}
