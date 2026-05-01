import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import log from './lib/logger.js';
import prisma from './lib/prisma.js';
import { initEmailService, isEmailConfigured } from './lib/email.js';
import routes from './routes/routes.js';
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
    app.use(cookieParser());
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
    app.use('/api', routes);
    app.get('/', (req, res) => {
        res.json({
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
