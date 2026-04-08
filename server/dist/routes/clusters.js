/**
 * @swagger
 * tags:
 *   - name: Clusters
 *     description: Kubernetes cluster management
 */
/**
 * @swagger
 * /api/clusters:
 *   get:
 *     tags: [Clusters]
 *     summary: List all clusters
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of clusters
 */
/**
 * @swagger
 * /api/clusters:
 *   post:
 *     tags: [Clusters]
 *     summary: Create a cluster for workspace
 *     description: Creates a cluster using provider config from .env
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - workspaceId
 *               - name
 *             properties:
 *               workspaceId:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Cluster created
 */
/**
 * @swagger
 * /api/clusters/{id}:
 *   get:
 *     tags: [Clusters]
 *     summary: Get cluster details
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Cluster details
 */
/**
 * @swagger
 * /api/clusters/{id}:
 *   delete:
 *     tags: [Clusters]
 *     summary: Delete cluster
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       204:
 *         description: Cluster deleted
 */
import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';
const router = Router();
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { workspaceId } = req.query;
        const where = workspaceId ? { workspaceId: workspaceId } : {};
        const clusters = await prisma.cluster.findMany({
            where,
            include: { workspace: true },
        });
        res.json(clusters);
    }
    catch (error) {
        log.error('Error fetching clusters:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch clusters' });
    }
});
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { workspaceId, name } = req.body;
        if (!workspaceId || !name) {
            return res.status(400).json({ error: 'Bad Request', message: 'workspaceId and name are required' });
        }
        const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
        if (!workspace || workspace.ownerId !== req.userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Invalid workspace' });
        }
        const provider = process.env.K8S_PROVIDER || 'minikube';
        const cluster = await prisma.cluster.create({
            data: {
                workspaceId,
                name,
                provider,
                region: '',
                status: 'active',
            },
        });
        log.info(`Cluster created: ${name} with provider: ${provider}`);
        res.status(201).json(cluster);
    }
    catch (error) {
        log.error('Error creating cluster:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create cluster' });
    }
});
router.get('/:id', authMiddleware, async (req, res) => {
    try {
        const cluster = await prisma.cluster.findUnique({
            where: { id: req.params.id },
            include: { workspace: true },
        });
        if (!cluster) {
            return res.status(404).json({ error: 'Not Found', message: 'Cluster not found' });
        }
        if (cluster.workspace.ownerId !== req.userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }
        let clusterInfo = {
            ...cluster,
            providerConfig: {
                provider: cluster.provider,
                apiServer: process.env[`${cluster.provider.toUpperCase()}_API_SERVER`] || null,
                region: process.env[`${cluster.provider.toUpperCase()}_REGION`] || null,
            },
        };
        try {
            const k8sConfig = await k8sConfigManager.loadConfig();
            clusterInfo.k8sConnected = k8sConfig.connected;
            clusterInfo.k8sVersion = k8sConfig.connected ? 'connected' : null;
        }
        catch {
            clusterInfo.k8sConnected = false;
        }
        res.json(clusterInfo);
    }
    catch (error) {
        log.error('Error fetching cluster:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch cluster' });
    }
});
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const cluster = await prisma.cluster.findUnique({
            where: { id: req.params.id },
            include: { workspace: true },
        });
        if (!cluster) {
            return res.status(404).json({ error: 'Not Found', message: 'Cluster not found' });
        }
        if (cluster.workspace.ownerId !== req.userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }
        await prisma.cluster.delete({ where: { id: req.params.id } });
        res.status(204).send();
    }
    catch (error) {
        log.error('Error deleting cluster:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete cluster' });
    }
});
router.get('/:id/resources', authMiddleware, async (req, res) => {
    try {
        const cluster = await prisma.cluster.findUnique({
            where: { id: req.params.id },
            include: { workspace: true },
        });
        if (!cluster || cluster.workspace.ownerId !== req.userId) {
            return res.status(403).json({ error: 'Forbidden', message: 'Access denied' });
        }
        const userResources = await prisma.userResource.findMany({
            where: { userId: req.userId },
        });
        res.json(userResources);
    }
    catch (error) {
        log.error('Error fetching resources:', error);
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch resources' });
    }
});
export default router;
