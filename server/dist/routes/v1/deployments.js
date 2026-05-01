/**
 * @swagger
 * tags:
 *   - name: Deployments
 *     description: Deployment management
 */
import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';
import log from '../../lib/logger.js';
const router = Router();
router.get('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { projectId } = req.query;
        const where = {};
        if (projectId)
            where.projectId = projectId;
        const deployments = await prisma.deployment.findMany({
            where,
            include: { project: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(deployments);
    }
    catch (error) {
        log.error('Error fetching deployments:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch deployments' });
    }
});
router.post('/', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { projectId, environment, version, config } = req.body;
        if (!projectId || !environment) {
            return res.status(400).json({ error: 'Bad Request', message: 'projectId and environment are required' });
        }
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { workspace: true },
        });
        if (!project || project.workspace.ownerId !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }
        const deployment = await prisma.deployment.create({
            data: {
                projectId,
                environment,
                version: version || 'v1.0.0',
                status: 'pending',
                config,
            },
        });
        log.info(`Deployment created: ${deployment.id} for project: ${projectId}`);
        res.status(201).json(deployment);
    }
    catch (error) {
        log.error('Error creating deployment:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create deployment' });
    }
});
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const deployment = await prisma.deployment.findUnique({
            where: { id: req.params.id },
            include: { project: { include: { workspace: true } } },
        });
        if (!deployment) {
            return res.status(404).json({ error: 'Not Found', message: 'Deployment not found' });
        }
        if (deployment.project.workspace.ownerId !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }
        res.json(deployment);
    }
    catch (error) {
        log.error('Error fetching deployment:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch deployment' });
    }
});
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const { status, version } = req.body;
        const deployment = await prisma.deployment.findUnique({
            where: { id: req.params.id },
            include: { project: { include: { workspace: true } } },
        });
        if (!deployment || deployment.project.workspace.ownerId !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }
        const updated = await prisma.deployment.update({
            where: { id: req.params.id },
            data: {
                ...(status && { status }),
                ...(version && { version }),
            },
        });
        res.json(updated);
    }
    catch (error) {
        log.error('Error updating deployment:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update deployment' });
    }
});
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const userId = req.userId;
        const deployment = await prisma.deployment.findUnique({
            where: { id: req.params.id },
            include: { project: { include: { workspace: true } } },
        });
        if (!deployment || deployment.project.workspace.ownerId !== userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }
        await prisma.deployment.delete({ where: { id: req.params.id } });
        res.status(204).send();
    }
    catch (error) {
        log.error('Error deleting deployment:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete deployment' });
    }
});
export default router;
