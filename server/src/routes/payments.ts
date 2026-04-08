/**
 * @swagger
 * tags:
 *   - name: Payments
 *     description: Payment and subscription management
 */

/**
 * @swagger
 * /api/payments/initiate:
 *   post:
 *     tags: [Payments]
 *     summary: Initiate payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - planId
 *               - paymentMethod
 *             properties:
 *               planId:
 *                 type: string
 *               paymentMethod:
 *                 type: string
 *                 enum: [sslcommerz, stripe]
 *     responses:
 *       200:
 *         description: Payment initiated
 */

/**
 * @swagger
 * /api/payments/webhook:
 *   post:
 *     tags: [Payments]
 *     summary: Payment webhook callback
 *     description: Handle payment gateway callbacks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook processed
 */

/**
 * @swagger
 * /api/payments/subscription:
 *   get:
 *     tags: [Payments]
 *     summary: Get current subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current subscription details
 */
import { Router } from 'express';
import { authMiddleware, type AuthRequest } from '../middleware/auth.js';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';

const router = Router();

const SSL_COMMERZ_STORE_ID = process.env.SSL_COMMERZ_STORE_ID || '';
const SSL_COMMERZ_STORE_PASS = process.env.SSL_COMMERZ_STORE_PASS || '';
const SSL_COMMERZ_URL = 'https://sandbox.sslcommerz.com/gwprocess/v3/api.php';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

async function createSSLCommerzPayment(amount: number, currency: string, userId: string, planId: string) {
  const tranId = `TRX_${Date.now()}_${userId}`;
  
  const postData = {
    store_id: SSL_COMMERZ_STORE_ID,
    store_passwd: SSL_COMMERZ_STORE_PASS,
    total_amount: amount,
    currency: currency,
    tran_id: tranId,
    success_url: `${process.env.CLIENT_URL}/payment/success?tran_id=${tranId}`,
    fail_url: `${process.env.CLIENT_URL}/payment/fail?tran_id=${tranId}`,
    cancel_url: `${process.env.CLIENT_URL}/payment/cancel?tran_id=${tranId}`,
    ipn_url: `${process.env.SERVER_URL}/api/payments/webhook`,
    product_category: 'Kubernetes Hosting',
    product_name: 'Hosting Plan',
    cus_name: 'Customer',
    cus_email: '',
    cus_add1: '',
    cus_city: '',
    cus_postcode: '',
    cus_country: '',
    shipping_method: 'NO',
    num_of_item: 1,
    product_profile: 'non-physical-goods',
  };

  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      currency,
      method: 'sslcommerz',
      transactionId: tranId,
      status: 'pending',
      metadata: { planId },
    },
  });

  return { paymentId: payment.id, tranId, postData };
}

async function createStripePayment(amount: number, currency: string, userId: string, planId: string) {
  const paymentIntent = {
    amount: Math.round(amount * 100),
    currency: currency.toLowerCase(),
    metadata: { userId, planId },
  };

  const payment = await prisma.payment.create({
    data: {
      userId,
      amount,
      currency,
      method: 'stripe',
      transactionId: `stripe_${Date.now()}`,
      status: 'pending',
      metadata: { planId, stripeData: paymentIntent },
    },
  });

  return { paymentId: payment.id, stripeData: paymentIntent };
}

router.post('/initiate', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { planId, paymentMethod } = req.body;

    if (!planId || !paymentMethod) {
      return res.status(400).json({ error: 'Bad Request', message: 'planId and paymentMethod are required' });
    }

    const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      return res.status(404).json({ error: 'Not Found', message: 'Plan not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User not found' });
    }

    if (paymentMethod === 'sslcommerz') {
      const result = await createSSLCommerzPayment(plan.price, 'USD', req.userId, planId);
      
      log.info(`SSLCommerz payment initiated: ${result.tranId}`);
      res.json({
        paymentId: result.paymentId,
        transactionId: result.tranId,
        message: 'Redirect to payment gateway',
        paymentUrl: SSL_COMMERZ_URL,
      });
    } else if (paymentMethod === 'stripe') {
      const result = await createStripePayment(plan.price, 'USD', req.userId, planId);
      
      log.info(`Stripe payment initiated: ${result.paymentId}`);
      res.json({
        paymentId: result.paymentId,
        message: 'Stripe payment created',
        amount: plan.price,
        currency: 'USD',
      });
    } else {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid payment method' });
    }
  } catch (error) {
    log.error('Error initiating payment:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to initiate payment' });
  }
});

router.post('/webhook', async (req, res) => {
  try {
    const { status, tran_id, val_id } = req.body;

    if (!tran_id) {
      return res.status(400).json({ error: 'Bad Request', message: 'Invalid webhook' });
    }

    const payment = await prisma.payment.findFirst({
      where: { transactionId: tran_id },
    });

    if (!payment) {
      return res.status(404).json({ error: 'Not Found', message: 'Payment not found' });
    }

    const isValid = status === 'VALID' && val_id;
    
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: isValid ? 'completed' : 'failed',
        metadata: { ...payment.metadata, webhookResponse: req.body },
      },
    });

    if (isValid) {
      const planId = payment.metadata?.planId as string;
      
      await prisma.subscription.upsert({
        where: { userId: payment.userId },
        create: {
          userId: payment.userId,
          planId,
          status: 'active',
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
        update: {
          planId,
          status: 'active',
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });

      const plan = await prisma.pricingPlan.findUnique({ where: { id: planId } });
      if (plan?.limits) {
        const limits = plan.limits as Record<string, number>;
        
        for (const [resourceType, allocated] of Object.entries(limits)) {
          await prisma.userResource.upsert({
            where: {
              id: `${payment.userId}_${resourceType}`,
            },
            create: {
              userId: payment.userId,
              resourceType,
              allocated,
              used: 0,
              unit: resourceType === 'cpu' ? 'cores' : resourceType === 'memory' ? 'GB' : 'units',
            },
            update: {
              allocated,
            },
          });
        }
      }

      log.info(`Payment completed for user: ${payment.userId}`);
    }

    res.json({ received: true });
  } catch (error) {
    log.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/subscription', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.userId },
      include: { plan: true },
    });

    if (!subscription) {
      return res.json({ status: 'free', message: 'No active subscription' });
    }

    res.json(subscription);
  } catch (error) {
    log.error('Error fetching subscription:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch subscription' });
  }
});

router.get('/resources', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const resources = await prisma.userResource.findMany({
      where: { userId: req.userId },
    });

    const subscription = await prisma.subscription.findUnique({
      where: { userId: req.userId },
      include: { plan: true },
    });

    res.json({
      subscription: subscription ? { status: subscription.status, plan: subscription.plan } : null,
      resources,
    });
  } catch (error) {
    log.error('Error fetching resources:', error);
    res.status(500).json({ error: 'Internal Server Error', message: 'Failed to fetch resources' });
  }
});

export default router;