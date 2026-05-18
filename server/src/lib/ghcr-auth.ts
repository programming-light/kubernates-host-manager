import * as k8s from '@kubernetes/client-node';
import { k8sConfigManager } from './k8s-config.js';
import log from './logger.js';
import prisma from './prisma.js';

let _jwt: any = null;
async function getJwt(): Promise<any> {
  if (!_jwt) _jwt = await import('jsonwebtoken').then(m => m.default);
  return _jwt;
}

export async function getAppToken(): Promise<string | null> {
  if (!process.env.GITHUB_APP_ID || !process.env.GITHUB_APP_PRIVATE_KEY) return null;
  try {
    const jwt = await getJwt();
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iss: process.env.GITHUB_APP_ID, iat: now, exp: now + 600 },
      privateKey,
      { algorithm: 'RS256' },
    );
  } catch {
    return null;
  }
}

export async function getInstallationToken(installationId: number, appToken: string): Promise<string | null> {
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

export function getGhcrImageName(githubUser: string, projectName: string, tag: string): string {
  const user = githubUser.toLowerCase();
  const project = projectName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  return `ghcr.io/${user}/${project}:${tag}`;
}

export function parseGhcrImage(fullImage: string): { registry: string; user: string; project: string; tag: string } | null {
  const match = fullImage.match(/^ghcr\.io\/([^/]+)\/([^:]+):(.+)$/);
  if (!match) return null;
  return { registry: 'ghcr.io', user: match[1], project: match[2], tag: match[3] };
}

export async function getGhcrCredentials(userId: string): Promise<{ username: string; password: string; imageUser: string } | null> {
  const appToken = await getAppToken();
  if (!appToken) {
    log.warn('GitHub App not configured, cannot get GHCR token');
    return null;
  }

  const installation = await prisma.gitHubInstallation.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  if (!installation) {
    log.warn(`No GitHub installation found for user ${userId}`);
    return null;
  }

  const token = await getInstallationToken(installation.installationId, appToken);
  if (!token) {
    log.warn(`Failed to get installation token for installation ${installation.installationId}`);
    return null;
  }

  return { username: 'token', password: token, imageUser: installation.orgLogin };
}

export async function createGhcrPullSecret(namespace: string, secretName: string, dockerConfigJson: string): Promise<void> {
  const coreApi = k8sConfigManager.coreApi;
  const secret: k8s.V1Secret = {
    metadata: {
      name: secretName,
      namespace,
      labels: { 'managed-by': 'k8s-platform', type: 'ghcr-pull' },
    },
    type: 'kubernetes.io/dockerconfigjson',
    data: {
      '.dockerconfigjson': Buffer.from(dockerConfigJson).toString('base64'),
    },
  };

  try {
    await coreApi.replaceNamespacedSecret(secretName, namespace, secret);
    log.info(`Updated GHCR pull secret ${secretName} in ${namespace}`);
  } catch {
    await coreApi.createNamespacedSecret(namespace, secret);
    log.info(`Created GHCR pull secret ${secretName} in ${namespace}`);
  }
}

export async function ensureGhcrPullSecret(namespace: string, userId: string): Promise<string | null> {
  const creds = await getGhcrCredentials(userId);
  if (!creds) return null;

  const dockerConfig = JSON.stringify({
    auths: {
      'ghcr.io': {
        auth: Buffer.from(`${creds.username}:${creds.password}`).toString('base64'),
      },
    },
  });

  const secretName = 'ghcr-pull-secret';
  await createGhcrPullSecret(namespace, secretName, dockerConfig);
  return secretName;
}

export async function ensureGhcrPullSecretForProject(projectId: string, namespace: string): Promise<string | null> {
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return null;
  return ensureGhcrPullSecret(namespace, project.userId);
}

export async function getGhcrDockerConfig(userId: string): Promise<{ configJson: string; imageUser: string } | null> {
  const creds = await getGhcrCredentials(userId);
  if (!creds) return null;

  const configJson = JSON.stringify({
    auths: {
      'ghcr.io': {
        auth: Buffer.from(`${creds.username}:${creds.password}`).toString('base64'),
      },
    },
  });

  return { configJson, imageUser: creds.imageUser };
}

export async function getUserInstallationToken(userId: string): Promise<string | null> {
  const appToken = await getAppToken();
  if (!appToken) return null;

  const installation = await prisma.gitHubInstallation.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  if (!installation) return null;

  return getInstallationToken(installation.installationId, appToken);
}
