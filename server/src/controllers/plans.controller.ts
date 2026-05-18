import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';

export async function getPlans(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { active } = request.query as any;
    
    const where: any = {};
    if (active === 'true') {
      where.isActive = true;
    }

    const plans = await prisma.pricingPlan.findMany({
      where,
      orderBy: { price: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });

    reply.send(plans);
  } catch (error) {
    log.error('Failed to get plans:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch plans' });
  }
}

export async function getPlanById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;

    const plan = await prisma.pricingPlan.findUnique({
      where: { id },
      include: { _count: { select: { subscriptions: true } } },
    });

    if (!plan) {
      reply.status(404).send({ error: 'Not Found', message: 'Plan not found' });
    }

    reply.send(plan);
  } catch (error) {
    log.error('Failed to get plan:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch plan' });
  }
}

export async function createPlan(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, slug, description, price, interval, isActive, isFeatured, features, limits } = request.body as any;

    if (!name || !slug || price === undefined) {
      reply.status(400).send({ error: 'Bad Request', message: 'Name, slug, and price are required' });
    }

    const existing = await prisma.pricingPlan.findUnique({ where: { slug } });
    if (existing) {
      reply.status(400).send({ error: 'Bad Request', message: 'Plan slug already exists' });
    }

    const plan = await prisma.pricingPlan.create({
      data: {
        name,
        slug,
        description: description || null,
        price: Number(price),
        interval: interval || 'monthly',
        isActive: isActive !== false,
        isFeatured: isFeatured || false,
        features: features || {},
        limits: limits || {},
      },
    });

    reply.status(201).send(plan);
  } catch (error) {
    log.error('Failed to create plan:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to create plan' });
  }
}

export async function updatePlan(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;
    const { name, description, price, interval, isActive, isFeatured, features, limits } = request.body as any;

    const plan = await prisma.pricingPlan.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(price !== undefined && { price: Number(price) }),
        ...(interval !== undefined && { interval }),
        ...(isActive !== undefined && { isActive }),
        ...(isFeatured !== undefined && { isFeatured }),
        ...(features !== undefined && { features }),
        ...(limits !== undefined && { limits }),
      },
    });

    reply.send({ message: 'Plan updated', plan });
  } catch (error) {
    log.error('Failed to update plan:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update plan' });
  }
}

export async function deletePlan(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { id } = request.params as any;

    await prisma.pricingPlan.delete({
      where: { id },
    });

    reply.send({ message: 'Plan deleted successfully' });
  } catch (error) {
    log.error('Failed to delete plan:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete plan' });
  }
}
