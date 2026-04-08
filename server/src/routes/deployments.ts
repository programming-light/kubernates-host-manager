/**
 * @swagger
 * tags:
 *   - name: Deployments
 *     description: Deployment management
 */

/**
 * @swagger
 * /api/deployments:
 *   get:
 *     tags: [Deployments]
 *     summary: List all deployments
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: projectId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of deployments
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Deployment'
 */

/**
 * @swagger
 * /api/deployments:
 *   post:
 *     tags: [Deployments]
 *     summary: Create a deployment
 *     description: Deploy a Docker image to a project
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - imageUrl
 *             properties:
 *               projectId:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *                 example: nginx:latest
 *               replicas:
 *                 type: number
 *     responses:
 *       201:
 *         description: Deployment created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Deployment'
 */

/**
 * @swagger
 * /api/deployments/{id}:
 *   get:
 *     tags: [Deployments]
 *     summary: Get deployment details
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
 *         description: Deployment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Deployment'
 */

/**
 * @swagger
 * /api/deployments/{id}/restart:
 *   post:
 *     tags: [Deployments]
 *     summary: Restart deployment
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
 *         description: Deployment restarted
 */

/**
 * @swagger
 * /api/deployments/{id}/rollback:
 *   post:
 *     tags: [Deployments]
 *     summary: Rollback deployment
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
 *         description: Deployment rolled back
 */

/**
 * @swagger
 * /api/deployments/{id}/logs:
 *   get:
 *     tags: [Deployments]
 *     summary: Get deployment logs
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
 *         description: Deployment logs
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

interface Deployment {
  id: string;
  projectId: string;
  version: number;
  status: string;
  imageUrl: string;
  commitSha?: string;
  replicas: number;
  deployedBy?: string;
  startedAt: Date;
  completedAt?: Date;
  logs: string[];
}

const deployments: Map<string, Deployment> = new Map();

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const { projectId } = req.query;
  let userDeployments: Deployment[] = [];
  
  deployments.forEach((deployment) => {
    if (!projectId || deployment.projectId === projectId) {
      userDeployments.push(deployment);
    }
  });
  res.json(userDeployments);
});

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { projectId, imageUrl, replicas, commitSha } = req.body;

  const deployment: Deployment = {
    id: uuid(),
    projectId,
    version: 1,
    status: 'pending',
    imageUrl,
    replicas: replicas || 1,
    deployedBy: req.userId,
    startedAt: new Date(),
    logs: [`Deployment started at ${new Date().toISOString()}`],
  };

  if (commitSha) deployment.commitSha = commitSha;

  deployments.set(deployment.id, deployment);

  setTimeout(() => {
    const dep = deployments.get(deployment.id);
    if (dep) {
      dep.status = 'running';
      dep.completedAt = new Date();
      dep.logs.push(`Deployment completed successfully`);
      deployments.set(dep.id, dep);
    }
  }, 3000);

  res.status(201).json(deployment);
});

router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const deployment = deployments.get(req.params.id);
  if (!deployment) {
    return res.status(404).json({ error: 'Not Found', message: 'Deployment not found' });
  }
  res.json(deployment);
});

router.post('/:id/restart', authMiddleware, (req: AuthRequest, res) => {
  const deployment = deployments.get(req.params.id);
  if (!deployment) {
    return res.status(404).json({ error: 'Not Found', message: 'Deployment not found' });
  }

  deployment.status = 'pending';
  deployment.startedAt = new Date();
  deployment.completedAt = undefined;
  deployment.logs.push(`Restart initiated at ${new Date().toISOString()}`);
  
  deployments.set(deployment.id, deployment);
  res.json(deployment);
});

router.post('/:id/rollback', authMiddleware, (req: AuthRequest, res) => {
  const deployment = deployments.get(req.params.id);
  if (!deployment) {
    return res.status(404).json({ error: 'Not Found', message: 'Deployment not found' });
  }

  deployment.version = Math.max(1, deployment.version - 1);
  deployment.status = 'pending';
  deployment.startedAt = new Date();
  deployment.logs.push(`Rollback to version ${deployment.version} initiated`);
  
  deployments.set(deployment.id, deployment);
  res.json(deployment);
});

router.get('/:id/logs', authMiddleware, (req: AuthRequest, res) => {
  const deployment = deployments.get(req.params.id);
  if (!deployment) {
    return res.status(404).json({ error: 'Not Found', message: 'Deployment not found' });
  }
  res.json({ logs: deployment.logs });
});

export default router;
export { deployments };
