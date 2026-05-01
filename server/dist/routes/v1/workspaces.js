/**
 * @swagger
 * tags:
 *   - name: Workspaces
 *     description: Workspace management endpoints
 */
/**
 * @swagger
 * /api/workspaces:
 *   get:
 *     tags: [Workspaces]
 *     summary: List all workspaces
 *     description: Get all workspaces for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of workspaces
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Workspace'
 */
/**
 * @swagger
 * /api/workspaces:
 *   post:
 *     tags: [Workspaces]
 *     summary: Create a workspace
 *     description: Create a new workspace
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
 *               - slug
 *             properties:
 *               name:
 *                 type: string
 *                 example: My Workspace
 *               slug:
 *                 type: string
 *                 example: my-workspace
 *               description:
 *                 type: string
 *     responses:
 *       201:
 *         description: Workspace created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 */
/**
 * @swagger
 * /api/workspaces/{id}:
 *   get:
 *     tags: [Workspaces]
 *     summary: Get workspace by ID
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
 *         description: Workspace details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Workspace'
 *       404:
 *         description: Workspace not found
 */
/**
 * @swagger
 * /api/workspaces/{id}:
 *   put:
 *     tags: [Workspaces]
 *     summary: Update workspace
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Workspace updated
 */
/**
 * @swagger
 * /api/workspaces/{id}:
 *   delete:
 *     tags: [Workspaces]
 *     summary: Delete workspace
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
 *         description: Workspace deleted
 */
import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { authMiddleware } from '../../middleware/auth.js';
const router = Router();
const workspaces = new Map();
router.get('/', authMiddleware, (req, res) => {
    const userWorkspaces = [];
    workspaces.forEach((ws) => {
        if (ws.ownerId === req.userId) {
            userWorkspaces.push(ws);
        }
    });
    res.json(userWorkspaces);
});
router.post('/', authMiddleware, (req, res) => {
    const { name, slug, description } = req.body;
    if (workspaces.has(slug)) {
        return res.status(400).json({ error: 'Bad Request', message: 'Workspace slug already exists' });
    }
    const workspace = {
        id: uuid(),
        name,
        slug,
        ownerId: req.userId,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    workspaces.set(slug, workspace);
    res.status(201).json(workspace);
});
router.get('/:id', authMiddleware, (req, res) => {
    let found;
    workspaces.forEach((ws) => {
        if (ws.id === req.params.id && ws.ownerId === req.userId) {
            found = ws;
        }
    });
    if (!found) {
        return res.status(404).json({ error: 'Not Found', message: 'Workspace not found' });
    }
    res.json(found);
});
router.put('/:id', authMiddleware, (req, res) => {
    const { name, description } = req.body;
    let found;
    let foundSlug = '';
    workspaces.forEach((ws, slug) => {
        if (ws.id === req.params.id && ws.ownerId === req.userId) {
            found = ws;
            foundSlug = slug;
        }
    });
    if (!found) {
        return res.status(404).json({ error: 'Not Found', message: 'Workspace not found' });
    }
    if (name)
        found.name = name;
    if (description !== undefined)
        found.description = description;
    found.updatedAt = new Date();
    workspaces.set(foundSlug, found);
    res.json(found);
});
router.delete('/:id', authMiddleware, (req, res) => {
    let deleted = false;
    workspaces.forEach((ws, slug) => {
        if (ws.id === req.params.id && ws.ownerId === req.userId) {
            workspaces.delete(slug);
            deleted = true;
        }
    });
    if (!deleted) {
        return res.status(404).json({ error: 'Not Found', message: 'Workspace not found' });
    }
    res.status(204).send();
});
export default router;
export { workspaces };
