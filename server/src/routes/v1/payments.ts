import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import prisma from '../../lib/prisma.js';
import log from '../../lib/logger.js';
import { SubscriptionStatus } from '../../constants/roles.js';

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

export default async function(router: FastifyInstance) {
  router.post('/initiate', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId!;
      const { planId, paymentMethod } = request.body as { planId: string; paymentMethod: string };
      if (!planId || !paymentMethod) {
        return reply.status(400).send({ error: 'Bad Request', message: 'planId and paymentMethod required' });
      }
      const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
      if (!plan) return reply.status(404).send({ error: 'Not Found', message: 'Plan not found' });
      const amount = Number(plan.price);
      if (paymentMethod === 'sslcommerz') {
        const result = await createSSLCommerzPayment(amount, 'USD', userId, planId);
        return reply.send({ paymentId: result.paymentId, transactionId: result.tranId, paymentUrl: SSL_COMMERZ_URL });
      } else if (paymentMethod === 'stripe') {
        const result = await createStripePayment(amount, 'USD', userId, planId);
        return reply.send({ paymentId: result.paymentId, plan: plan.name, amount: plan.price });
      } else {
        return reply.status(400).send({ error: 'Bad Request', message: 'Invalid payment method' });
      }
    } catch (error) {
      log.error('Payment error:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  router.get('/subscription', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId!;
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });
      if (!subscription) return reply.send({ status: 'no_subscription', plan: null });
      return reply.send({ status: subscription.status, plan: subscription.plan, startDate: subscription.startDate, endDate: subscription.endDate });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  router.post('/subscription/cancel', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId!;
      const subscription = await prisma.subscription.findUnique({ where: { userId } });
      if (!subscription) return reply.status(404).send({ error: 'Not Found' });
      await prisma.subscription.update({ where: { id: subscription.id }, data: { cancelAtPeriodEnd: true, autoRenew: false } });
      return reply.send({ message: 'Subscription will be cancelled at end of period' });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  router.get('/resources', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId!;
      const resources = await prisma.userResource.findMany({ where: { userId } });
      return reply.send(resources);
    } catch (error) {
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  router.post('/webhook', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const { tran_id, status } = request.body as { tran_id?: string; status?: string };
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
      return reply.send({ status: 'received' });
    } catch (error) {
      log.error('Webhook error:', error);
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });

  router.get('/history', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId!;
      const { page = 1, limit = 20 } = request.query as any;
      const skip = (Number(page) - 1) * Number(limit);
      const [payments, total] = await Promise.all([
        prisma.payment.findMany({ where: { userId }, skip, take: Number(limit), orderBy: { createdAt: 'desc' } }),
        prisma.payment.count({ where: { userId } }),
      ]);
      return reply.send({ data: payments, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
    } catch (error) {
      return reply.status(500).send({ error: 'Internal Server Error' });
    }
  });
}
