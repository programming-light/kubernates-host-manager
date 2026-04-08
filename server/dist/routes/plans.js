/**
 * @swagger
 * tags:
 *   - name: Plans
 *     description: Pricing plans management
 */
/**
 * @swagger
 * /api/plans:
 *   get:
 *     tags: [Plans]
 *     summary: List all pricing plans
 *     responses:
 *       200:
 *         description: List of pricing plans
 */
/**
 * @swagger
 * /api/plans/{id}:
 *   get:
 *     tags: [Plans]
 *     summary: Get pricing plan details
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan details
 */
import { Router } from 'express';
import prisma from '../lib/prisma.js';
const router = Router();
router.get('/', async (req, res) => {
    try {
        const plans = await prisma.pricingPlan.findMany({
            where: { isActive: true },
            orderBy: { price: 'asc' },
        });
        res.json(plans);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch plans' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const plan = await prisma.pricingPlan.findUnique({
            where: { id: req.params.id },
        });
        if (!plan) {
            return res.status(404).json({ error: 'Not Found', message: 'Plan not found' });
        }
        res.json(plan);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch plan' });
    }
});
export default router;
