/**
 * @swagger
 * tags:
 *   - name: Plans
 *     description: Pricing plans management
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, adminMiddleware, type AuthRequest } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const plans = await prisma.pricingPlan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch plans' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const plan = await prisma.pricingPlan.findUnique({
      where: { id: req.params.id },
    });
    if (!plan) {
      return res.status(404).json({ error: 'Not Found', message: 'Plan not found' });
    }
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch plan' });
  }
});

router.post('/', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { name, slug, description, price, interval, isFeatured, features, limits } = req.body;

    if (!name || !slug || price === undefined) {
      return res.status(400).json({ error: 'Bad Request', message: 'Name, slug, and price are required' });
    }

    const existingPlan = await prisma.pricingPlan.findUnique({ where: { slug } });
    if (existingPlan) {
      return res.status(409).json({ error: 'Conflict', message: 'Plan with this slug already exists' });
    }

    const plan = await prisma.pricingPlan.create({
      data: {
        name,
        slug,
        description,
        price: Number(price),
        interval: interval || 'monthly',
        isFeatured: isFeatured || false,
        features: features || {},
        limits: limits || {},
      },
    });

    res.status(201).json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to create plan' });
  }
});

router.put('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { name, description, price, interval, isActive, isFeatured, features, limits } = req.body;
    const { id } = req.params;

    const plan = await prisma.pricingPlan.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(interval && { interval }),
        ...(isActive !== undefined && { isActive }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(features && { features }),
        ...(limits && { limits }),
      },
    });

    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to update plan' });
  }
});

router.delete('/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId;
    const { id } = req.params;

    await prisma.pricingPlan.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({ message: 'Plan deactivated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to delete plan' });
  }
});

export default router;