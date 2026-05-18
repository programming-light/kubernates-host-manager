import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';

export async function getPayments(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const userRole = (request as any).userRole!;
    const { page = 1, limit = 20, userId: targetUserId } = request.query as any;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};
    
    if (userRole !== 'ADMIN') {
      where.userId = userId;
    } else if (targetUserId) {
      where.userId = targetUserId as string;
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      prisma.payment.count({ where }),
    ]);

    reply.send({
      data: payments,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    log.error('Failed to get payments:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch payments' });
  }
}

export async function getPaymentById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const userRole = (request as any).userRole!;
    const { id } = request.params as any;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    if (!payment) {
      return reply.status(404).send({ error: 'Not Found', message: 'Payment not found' });
    }

    if (userRole !== 'ADMIN' && payment.userId !== userId) {
      reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    reply.send(payment);
  } catch (error) {
    log.error('Failed to get payment:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch payment' });
  }
}

export async function createPayment(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { amount, currency, method, paymentUrl, metadata } = request.body as any;

    if (!amount || !method) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Amount and method are required' });
    }

    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: Number(amount),
        currency: currency || 'USD',
        method,
        paymentUrl: paymentUrl || null,
        metadata: metadata || null,
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    reply.status(201).send(payment);
  } catch (error) {
    log.error('Failed to create payment:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to create payment' });
  }
}

export async function updatePaymentStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const { status, transactionId } = request.body as any;

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        ...(status && { status }),
        ...(transactionId && { transactionId }),
      },
      include: { user: { select: { id: true, email: true, name: true } } },
    });

    reply.send({ message: 'Payment updated', payment });
  } catch (error) {
    log.error('Failed to update payment:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update payment' });
  }
}
