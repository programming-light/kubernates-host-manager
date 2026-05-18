import { FastifyRequest, FastifyReply } from 'fastify';
import * as http from 'http';
import * as https from 'https';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';

function getAppLabel(userEmail: string | undefined | null, slug: string): string {
  const userPrefix = userEmail
    ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20)
    : 'user';
  return `app-${userPrefix}-${slug}`;
}

async function checkProjectAccess(projectId: string, userId?: string): Promise<{ allowed: boolean; project?: any; error?: string; status?: number }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true, user: true },
  });
  if (!project) return { allowed: false, error: 'Project not found', status: 404 };
  if (!userId) return { allowed: true, project };
  if (project.workspace.ownerId === userId || project.userId === userId) {
    return { allowed: true, project };
  }
  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId },
  });
  if (membership && (membership.role === 'ADMIN' || membership.role === 'MANAGER')) {
    return { allowed: true, project };
  }
  return { allowed: false, error: 'Access denied', status: 403 };
}

function getK8sAuthHeaders(): Record<string, string> {
  const kc = k8sConfigManager.getConfig();
  if (!kc) return {};
  const cluster = kc.getCurrentCluster();
  const user = kc.getCurrentUser();
  const headers: Record<string, string> = {};
  if (user?.token) {
    headers['Authorization'] = `Bearer ${user.token}`;
  }
  if (cluster?.['server'] && user?.['certData'] && user?.['keyData']) {
  }
  return headers;
}

function getK8sCa(): Buffer | string | undefined {
  const kc = k8sConfigManager.getConfig();
  if (!kc) return undefined;
  const cluster = kc.getCurrentCluster();
  if (cluster?.caData) {
    return Buffer.from(cluster.caData, 'base64');
  }
  if (cluster?.caFile) {
    try {
      const fs = require('fs');
      return fs.readFileSync(cluster.caFile);
    } catch {}
  }
  return undefined;
}

function getSkipTls(): boolean {
  const kc = k8sConfigManager.getConfig();
  if (!kc) return false;
  const cluster = kc.getCurrentCluster();
  return cluster?.skipTLSVerify === true;
}

async function getServiceName(namespace: string, appLabel: string): Promise<string | null> {
  try {
    const services = await k8sConfigManager.coreApi.listNamespacedService(
      namespace, undefined, undefined, undefined, undefined,
      `app=${appLabel}`
    );
    if (!services.body.items.length) return null;
    return services.body.items[0]?.metadata?.name || null;
  } catch {
    return null;
  }
}

export async function previewProxy(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId;
  const { projectId } = request.params as any;
  const proxyPath = '/' + ((request.params as any)['*'] || '');

  try {
    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: access.error });
    }
    const project = access.project!;

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const svcName = await getServiceName(project.namespace, appLabel);
    if (!svcName) {
      return reply.status(404).send({ error: 'Not Found', message: 'No running service found' });
    }

    const k8sApiServer = k8sConfigManager.getApiServerUrl();
    if (!k8sApiServer) {
      return reply.status(503).send({ error: 'Kubernetes API not available' });
    }

    const targetUrl = `${k8sApiServer}/api/v1/namespaces/${project.namespace}/services/${svcName}/proxy${proxyPath}`;
    const qs = request.url.split('?')[1] || '';
    const fullTarget = qs ? `${targetUrl}?${qs}` : targetUrl;

    const headers: Record<string, string> = {};
    const skipHeaders = new Set(['host', 'connection', 'keep-alive', 'transfer-encoding']);
    for (const [key, value] of Object.entries(request.headers)) {
      if (!skipHeaders.has(key.toLowerCase()) && value) {
        headers[key] = Array.isArray(value) ? value.join(', ') : value;
      }
    }

    const k8sHeaders = getK8sAuthHeaders();
    Object.assign(headers, k8sHeaders);

    headers['X-Forwarded-For'] = request.ip;
    headers['X-Forwarded-Host'] = request.hostname;
    headers['X-Forwarded-Proto'] = request.protocol;

    const parsed = new URL(fullTarget);
    const isHttps = parsed.protocol === 'https:';
    const ca = getK8sCa();
    const skipTls = getSkipTls();

    const options: https.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: request.method,
      headers,
      rejectUnauthorized: !skipTls,
      ca,
      timeout: 30000,
    };

    reply.hijack();

    const proxyReq = (isHttps ? https : http).request(options, (proxyRes) => {
      const skipRespHeaders = new Set(['transfer-encoding']);
      const respHeaders: Record<string, string | string[]> = {};
      for (const [key, value] of Object.entries(proxyRes.headers)) {
        if (!skipRespHeaders.has(key.toLowerCase()) && value !== undefined) {
          respHeaders[key] = value;
        }
      }
      try {
        reply.raw.writeHead(proxyRes.statusCode || 500, respHeaders);
      } catch (e) {
        log.error(`Preview proxy writeHead error: ${e}`);
        return;
      }
      proxyRes.pipe(reply.raw);
    });

    proxyReq.on('error', (err: any) => {
      log.error(`Preview proxy error: ${err.message}`);
      if (!reply.sent) {
        try {
          reply.raw.writeHead(502, { 'Content-Type': 'application/json' });
          reply.raw.end(JSON.stringify({ error: 'Bad Gateway', message: `Proxy error: ${err.message}` }));
        } catch {}
      }
    });

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      if (!reply.sent) {
        try {
          reply.raw.writeHead(504, { 'Content-Type': 'application/json' });
          reply.raw.end(JSON.stringify({ error: 'Gateway Timeout', message: 'Proxy request timed out' }));
        } catch {}
      }
    });

    if (request.body) {
      const body = request.body as any;
      if (typeof body === 'string' || Buffer.isBuffer(body)) {
        proxyReq.write(body);
      } else {
        proxyReq.write(JSON.stringify(body));
      }
    }

    proxyReq.end();
  } catch (error: any) {
    log.error('Preview proxy error:', error);
    if (!reply.sent) {
      reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  }
}

export async function getPreviewUrl(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: access.error });
    }
    const project = access.project!;

    const baseUrl = process.env.PUBLIC_API_URL || `http://${request.hostname}:${process.env.PORT || 3001}`;
    const previewUrl = `${baseUrl}/api/v1/container/proxy/${projectId}/`;

    reply.send({
      previewUrl,
      projectSlug: project.slug,
      projectId: project.id,
      status: project.status,
    });
  } catch (error: any) {
    log.error('Get preview URL error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
