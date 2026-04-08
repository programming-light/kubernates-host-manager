import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import log from './lib/logger.js';
import prisma from './lib/prisma.js';
import { initEmailService, isEmailConfigured } from './lib/email.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import workspaceRoutes from './routes/workspaces.js';
import clusterRoutes from './routes/clusters.js';
import projectRoutes from './routes/projects.js';
import deploymentRoutes from './routes/deployments.js';
import kubernetesRoutes from './routes/kubernetes.js';
import planRoutes from './routes/plans.js';
import paymentRoutes from './routes/payments.js';
const app = express();
const PORT = process.env.PORT || 3001;
async function main() {
    await prisma.$connect();
    log.info('Connected to database');
    initEmailService();
    if (isEmailConfigured()) {
        log.info('Email service initialized');
    }
    else {
        log.warn('Email service not configured - OTPs will be logged to console');
    }
    app.use(helmet({
        contentSecurityPolicy: false,
    }));
    app.use(cors({
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
        credentials: true
    }));
    app.use(express.json());
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'K8s Platform API Docs',
        swaggerOptions: {
            persistAuthorization: true,
            docExpansion: 'list',
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
        },
    }));
    app.use('/api/auth', authRoutes);
    app.use('/api/auth', userRoutes);
    app.use('/api/workspaces', workspaceRoutes);
    app.use('/api/clusters', clusterRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/deployments', deploymentRoutes);
    app.use('/api/kubernetes', kubernetesRoutes);
    app.use('/api/plans', planRoutes);
    app.use('/api/payments', paymentRoutes);
    app.get('/', (req, res) => {
        res.json({
            name: 'K8s Platform API',
            version: '1.0.0',
            documentation: '/api-docs',
            endpoints: {
                auth: '/api/auth',
                users: '/api/auth/me',
                workspaces: '/api/workspaces',
                clusters: '/api/clusters',
                projects: '/api/projects',
                deployments: '/api/deployments',
                kubernetes: '/api/kubernetes',
            },
        });
    });
    app.get('/api/health', (req, res) => {
        res.json({
            status: 'ok',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
        });
    });
    app.use(notFoundHandler);
    app.use(errorHandler);
    app.listen(PORT, () => {
        log.info(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 K8s Platform API Server                               ║
║                                                            ║
║   Server:    http://localhost:${PORT}                        ║
║   API Docs:  http://localhost:${PORT}/api-docs                ║
║   Health:    http://localhost:${PORT}/api/health              ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
    `);
    });
}
main().catch((e) => {
    log.error('Failed to start server:', e);
    process.exit(1);
});
