import 'dotenv/config';
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketIOServer } from 'socket.io';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { ipBlocker, logRequest, updateRequestLog } from './middleware/security.js';
import log from './lib/logger.js';
import prisma from './lib/prisma.js';
import { initEmailService, isEmailConfigured } from './lib/email.js';
import { setIO, emitK8sEvent } from './lib/socket.js';
export { emitK8sEvent };

import routes from './routes/routes.js';
import { k8sWatcher } from './lib/k8s-watcher.js';
import * as stream from 'stream';
import * as k8s from '@kubernetes/client-node';
import { k8sConfigManager } from './lib/k8s-config.js';

function getAppLabel(userEmail: string | undefined | null, slug: string): string {
  const userPrefix = userEmail
    ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20)
    : 'user';
  return `app-${userPrefix}-${slug}`;
}

const PORT = parseInt(process.env.PORT || '3001');

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV === 'development' ? {
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: process.stdout.isTTY,
          translateTime: 'HH:MM:ss.l',
          ignore: 'pid,hostname',
        },
      },
    } : {}),
  },
  bodyLimit: 10 * 1024 * 1024,
});

let io: SocketIOServer;

async function main() {
  await prisma.$connect();
  log.info('Connected to database');

  await initEmailService();
  if (isEmailConfigured()) {
    log.info('Email service initialized');
  }

  await fastify.register(helmet, {
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  });

  await fastify.register(cors, {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  });

  await fastify.register(rateLimit, {
    global: true,
    max: parseInt(process.env.RATE_LIMIT_MAX || '200'),
    timeWindow: process.env.RATE_LIMIT_WINDOW || '1 minute',
    errorResponseBuilder: (request, context) => ({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Max ${context.max} requests per ${context.after}`,
      retryAfter: context.after,
    }),
    keyGenerator: (request) => request.ip,
  });

  await fastify.register(cookie);

  fastify.addHook('onRequest', ipBlocker);
  fastify.addHook('onRequest', logRequest);
  fastify.addHook('onResponse', updateRequestLog);

  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'K8s Platform API',
        version: '1.0.0',
        description: 'API documentation for K8s Hosting Platform - Multi-tenant Kubernetes management',
        contact: { name: 'API Support' },
      },
      servers: [{ url: `http://localhost:${PORT}`, description: 'Development server' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await fastify.register(swaggerUi, {
    routePrefix: '/api-docs',
    uiConfig: {
      docExpansion: 'list',
      persistAuthorization: true,
    },
  });

  await fastify.register(routes, { prefix: '/api' });

  fastify.get('/', async () => {
    return {
      name: 'K8s Platform API',
      version: '1.0.0',
      documentation: '/api-docs',
      endpoints: {
        auth: '/api/v1/auth',
        users: '/api/v1/auth/me',
        workspaces: '/api/v1/workspaces',
        clusters: '/api/v1/clusters',
        projects: '/api/v1/projects',
        deployments: '/api/v1/deployments',
        kubernetes: '/api/v1/kubernetes',
      },
    };
  });

  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  await fastify.listen({ port: PORT, host: '0.0.0.0' });

  io = new SocketIOServer(fastify.server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:3000',
      credentials: true,
    },
  });

  io.on('connection', (socket) => {
    log.info(`Client connected: ${socket.id}`);

    socket.on('join-k8s-updates', (namespace: string) => {
      socket.join(`k8s-${namespace || 'all'}`);
    });

    socket.on('leave-k8s-updates', (namespace: string) => {
      socket.leave(`k8s-${namespace || 'all'}`);
    });

    socket.on('join-build', (projectId: string) => {
      socket.join(`build-${projectId}`);
      log.info(`Socket ${socket.id} joined build-${projectId} room`);
    });

    socket.on('leave-build', (projectId: string) => {
      socket.leave(`build-${projectId}`);
    });

    const terminalConns = new Map<string, { close: () => void; stdinOpen: boolean; stdinStream: stream.Readable }>();

    socket.on('terminal:input', (inputData: { connId: string; data: string }) => {
      const conn = terminalConns.get(inputData.connId);
      if (conn && conn.stdinOpen) {
        conn.stdinStream.push(inputData.data);
      }
    });

    socket.on('terminal:resize', (_resizeData: { connId: string; cols: number; rows: number }) => {
      // xterm.js resize - K8s exec doesn't support SIGWINCH
    });

    socket.on('terminal:disconnect', (data: { connId: string }) => {
      const conn = terminalConns.get(data.connId);
      if (conn) {
        conn.close();
      }
    });

    socket.on('terminal:connect', async (data: { projectId: string; podName?: string }, callback) => {
      const connId = `term-${socket.id}-${data.projectId}`;
      try {
        const project = await prisma.project.findUnique({ where: { id: data.projectId }, include: { user: true } });
        if (!project) { callback?.({ error: 'Project not found' }); return; }

        const k8sConfig = await k8sConfigManager.loadConfig();
        if (!k8sConfig.connected) { callback?.({ error: 'K8s not connected' }); return; }

        const coreApi = k8sConfigManager.coreApi;
        const appLabel = getAppLabel(project.user?.email, project.slug);
        let targetPod = data.podName;
        if (!targetPod) {
          const pods = await coreApi.listNamespacedPod(
            project.namespace, undefined, undefined, undefined, undefined,
            `app=${appLabel}`
          );
          const runningPods = pods.body.items.filter(p => p.status?.phase === 'Running');
          if (!runningPods.length) {
            const total = pods.body.items.length;
            callback?.({ error: total ? `No running pods (${total} found, none Running)` : 'No pods found for this project' });
            return;
          }
          targetPod = runningPods[0].metadata!.name!;
        }

        const containerName = appLabel;
        const kc = k8sConfigManager.getConfig();
        if (!kc) { callback?.({ error: 'No kubeconfig' }); return; }
        const exec = new k8s.Exec(kc);

        let closed = false;

        const stdoutStream = new stream.Writable({
          write(chunk: any, _encoding: string, cb: Function) {
            const text = chunk.toString();
            if (!closed) socket.emit('terminal:data', { connId, data: text, stream: 'stdout' });
            cb();
          },
        });

        const stderrStream = new stream.Writable({
          write(chunk: any, _encoding: string, cb: Function) {
            const text = chunk.toString();
            if (!closed) socket.emit('terminal:data', { connId, data: text, stream: 'stderr' });
            cb();
          },
        });

        const stdinStream = new stream.Readable({ read() {} });

        let stdinOpen = true;

        exec.exec(
          project.namespace,
          targetPod,
          containerName,
          ['sh', '-c', `cd /app 2>/dev/null || cd /usr/src/app 2>/dev/null || cd /var/www 2>/dev/null || cd ~; exec $SHELL 2>/dev/null || exec /bin/sh 2>/dev/null || exec sh`],
          stdoutStream,
          stderrStream,
          stdinStream,
          true,
          (status: k8s.V1Status) => {
            closed = true;
            stdinOpen = false;
            socket.emit('terminal:exit', { connId, code: status.status === 'Success' ? 0 : 1 });
          }
        );

        const close = () => {
          closed = true;
          stdinOpen = false;
          stdinStream.push(null);
          terminalConns.delete(connId);
        };

        terminalConns.set(connId, { close, stdinOpen, stdinStream });

        callback?.({ connId, podName: targetPod });
      } catch (err: any) {
        log.error(`Terminal connect error: ${err.message}`);
        callback?.({ error: err.message });
      }
    });

    socket.on('disconnect', () => {
      for (const [id, conn] of terminalConns) {
        if (id.startsWith(`term-${socket.id}`)) {
          conn.close();
        }
      }
      log.info(`Client disconnected: ${socket.id}`);
    });
  });

  setIO(io);

  k8sWatcher.startWatching().catch(e => log.warn('Failed to start K8s watcher:', e.message));

  log.info(`
╔══════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 K8s Platform API Server (Fastify)                     ║
║                                                            ║
║   Server:    http://localhost:${PORT}                        ║
║   API Docs:  http://localhost:${PORT}/api-docs                ║
║   Health:    http://localhost:${PORT}/api/health              ║
║   Socket.IO: Enabled                                        ║
║   Log Level: ${process.env.LOG_LEVEL || 'info'}                              ║
║   Version:   fastify-migration                              ║
║                                                            ║
╚══════════════════════════════════════════════════════════╝`);
}

main().catch((e) => {
  log.error('Failed to start server:', e);
  process.exit(1);
});

process.on('SIGTERM', () => {
  log.info('Shutting down...');
  k8sWatcher.stopAll();
  process.exit(0);
});

process.on('SIGINT', () => {
  log.info('Shutting down...');
  k8sWatcher.stopAll();
  process.exit(0);
});
