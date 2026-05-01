/**
 * @swagger
 * tags:
 *   - name: Billing
 *     description: Billing and subscription management
 */

import { Router, Request, Response } from 'express';
import { authMiddleware, type AuthRequest } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';
import log from '../../lib/logger.js';
import { SubscriptionStatus } from '../../constants/roles.js';

const router = Router();

const SSL_COMMERZ_URL = 'https://sandbox.sslcommerz.com/gwprocess/v3/api.php';

async function createSSLCommerzPayment(amount: number, currency: string, userId: string, planId: string) {
  const tranId = `TRX_${Date.now()}_${userId}`;
  const payment = await prisma.payment.create({
    data: {
      userId, amount, currency, method: 'sslcommerz',
      transactionId: tranId, status: 'pending',
      metadata: { planId },
    },
  });
  return { paymentId: payment.id, tranId };
}

async function createStripePayment(amount: number, currency: string, userId: string, planId: string) {
  const transactionId = `stripe_${Date.now()}`;
  const payment = await prisma.payment.create({
    data: {
      userId, amount, currency, method: 'stripe',
      transactionId, status: 'pending',
      metadata: { planId },
    },
  });
  return { paymentId: payment.id };
}

router.post('/initiate', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { planId, paymentMethod } = req.body as { planId: string; paymentMethod: string };
    if (!planId || !paymentMethod) {
      return res.status(400).json({ error: 'Bad Request', message: 'planId and paymentMethod required' });
    }
    const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
    if (!plan) return res.status(404).json({ error: 'Not Found', message: 'Plan not found' });
    const amount = Number(plan.price);
    if (paymentMethod === 'sslcommerz') {
      const result = await createSSLCommerzPayment(amount, 'USD', userId, planId);
      res.json({ paymentId: result.paymentId, transactionId: result.tranId, paymentUrl: SSL_COMMERZ_URL });
    } else if (paymentMethod === 'stripe') {
      const result = await createStripePayment(amount, 'USD', userId, planId);
      res.json({ paymentId: result.paymentId, plan: plan.name, amount: plan.price });
    } else {
      res.status(400).json({ error: 'Bad Request', message: 'Invalid payment method' });
    }
  } catch (error) {
    log.error('Payment error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/subscription', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });
    if (!subscription) return res.json({ status: 'no_subscription', plan: null });
    res.json({ status: subscription.status, plan: subscription.plan, startDate: subscription.startDate, endDate: subscription.endDate });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/subscription/cancel', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const subscription = await prisma.subscription.findUnique({ where: { userId } });
    if (!subscription) return res.status(404).json({ error: 'Not Found' });
    await prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true, autoRenew: false } });
    res.json({ message: 'Subscription will be cancelled at end of period' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/resources', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const resources = await prisma.userResource.findMany({ where: { userId } });
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { tran_id, status } = req.body as { tran_id?: string; status?: string };
    if (tran_id && status === 'VALID') {
      const payment = await prisma.payment.findFirst({ where: { transactionId: tran_id } });
      if (payment && payment.status === 'pending') {
        await prisma.payment.update({ where: { id: payment.id }, data: { status: 'completed' } });
        const planId = (payment.metadata as any)?.planId;
        if (planId) {
          const endDate = new Date();
          endDate.setMonth(endDate.getMonth() + 1);
          await prisma.subscription.upsert({
            where: { userId: payment.userId },
            create: { userId: payment.userId, planId, status: SubscriptionStatus.ACTIVE, endDate },
            update: { planId, status: SubscriptionStatus.ACTIVE, endDate },
          });
        }
      }
    }
    res.json({ status: 'received' });
  } catch (error) {
    log.error('Webhook error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/history', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).userId!;
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({ where: { userId }, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
      prisma.payment.count({ where: { userId } }),
    ]);
    res.json({ data: payments, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;