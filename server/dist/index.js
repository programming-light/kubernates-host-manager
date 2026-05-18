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
let io;
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
        socket.on('join-k8s-updates', (namespace) => {
            socket.join(`k8s-${namespace || 'all'}`);
        });
        socket.on('leave-k8s-updates', (namespace) => {
            socket.leave(`k8s-${namespace || 'all'}`);
        });
        socket.on('join-build', (projectId) => {
            socket.join(`build-${projectId}`);
            log.info(`Socket ${socket.id} joined build-${projectId} room`);
        });
        socket.on('leave-build', (projectId) => {
            socket.leave(`build-${projectId}`);
        });
        socket.on('disconnect', () => {
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
