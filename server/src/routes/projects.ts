/**
 * @swagger
 * tags:
 *   - name: Projects
 *     description: Project management
 */

/**
 * @swagger
 * /api/projects:
 *   get:
 *     tags: [Projects]
 *     summary: List all projects
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: workspaceId
 *         schema:
 *           type: string
 *       - in: query
 *         name: clusterId
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Project'
 */

/**
 * @swagger
 * /api/projects:
 *   post:
 *     tags: [Projects]
 *     summary: Create a project
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - clusterId
 *             properties:
 *               workspaceId:
 *                 type: string
 *               clusterId:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               gitUrl:
 *                 type: string
 *               namespace:
 *                 type: string
 *               replicas:
 *                 type: number
 *     responses:
 *       201:
 *         description: Project created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 */

/**
 * @swagger
 * /api/projects/{id}:
 *   get:
 *     tags: [Projects]
 *     summary: Get project details
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
 *         description: Project details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Project'
 */

/**
 * @swagger
 * /api/projects/{id}:
 *   put:
 *     tags: [Projects]
 *     summary: Update project
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
 *         description: Project updated
 */

/**
 * @swagger
 * /api/projects/{id}:
 *   delete:
 *     tags: [Projects]
 *     summary: Delete project
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
 *         description: Project deleted
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';

const router = Router();

interface Project {
  id: string;
  workspaceId: string;
  clusterId: string;
  name: string;
  slug: string;
  description?: string;
  gitUrl?: string;
  status: string;
  namespace: string;
  replicas: number;
  createdAt: Date;
  updatedAt: Date;
}

const projects: Map<string, Project> = new Map();

router.get('/', authMiddleware, (req: AuthRequest, res) => {
  const { workspaceId, clusterId } = req.query;
  let userProjects: Project[] = [];
  
  projects.forEach((project) => {
    if (!workspaceId || project.workspaceId === workspaceId) {
      if (!clusterId || project.clusterId === clusterId) {
        userProjects.push(project);
      }
    }
  });
  res.json(userProjects);
});

router.post('/', authMiddleware, (req: AuthRequest, res) => {
  const { workspaceId, clusterId, name, description, gitUrl, namespace, replicas } = req.body;

  const project: Project = {
    id: uuid(),
    workspaceId: workspaceId || 'default',
    clusterId,
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    description,
    gitUrl,
    status: 'active',
    namespace: namespace || 'default',
    replicas: replicas || 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  projects.set(project.id, project);
  res.status(201).json(project);
});

router.get('/:id', authMiddleware, (req: AuthRequest, res) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
  }
  res.json(project);
});

router.put('/:id', authMiddleware, (req: AuthRequest, res) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
  }

  const { name, description, gitUrl, status, namespace, replicas } = req.body;
  if (name) project.name = name;
  if (description !== undefined) project.description = description;
  if (gitUrl !== undefined) project.gitUrl = gitUrl;
  if (status) project.status = status;
  if (namespace) project.namespace = namespace;
  if (replicas) project.replicas = replicas;
  project.updatedAt = new Date();

  projects.set(project.id, project);
  res.json(project);
});

router.delete('/:id', authMiddleware, (req: AuthRequest, res) => {
  if (!projects.has(req.params.id)) {
    return res.status(404).json({ error: 'Not Found', message: 'Project not found' });
  }
  projects.delete(req.params.id);
  res.status(204).send();
});

export default router;
export { projects };
