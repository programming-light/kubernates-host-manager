import { authMiddleware, adminMiddleware } from '../../middleware/auth.js';
import { plans as schemas } from '../../schemas/index.js';
import prisma from '../../lib/prisma.js';
export default async function (router) {
    router.get('/', { schema: schemas.list }, async (request, reply) => {
        try {
            const plans = await prisma.pricingPlan.findMany({
                where: { isActive: true },
                orderBy: { price: 'asc' },
            });
            reply.send(plans);
        }
        catch (error) {
            reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch plans' });
        }
    });
    router.get('/:id', async (request, reply) => {
        try {
            const plan = await prisma.pricingPlan.findUnique({
                where: { id: request.params.id },
            });
            if (!plan)
                return reply.status(404).send({ error: 'Not Found', message: 'Plan not found' });
            reply.send(plan);
        }
        catch (error) {
            reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch plan' });
        }
    });
    router.post('/', { preHandler: [authMiddleware, adminMiddleware], schema: schemas.create }, async (request, reply) => {
        try {
            const { name, slug, description, price, interval, isFeatured, features, limits } = request.body;
            if (!name || !slug || price === undefined) {
                return reply.status(400).send({ error: 'Bad Request', message: 'Name, slug, and price are required' });
            }
            const existing = await prisma.pricingPlan.findUnique({ where: { slug } });
            if (existing)
                return reply.status(409).send({ error: 'Conflict', message: 'Plan with this slug already exists' });
            const plan = await prisma.pricingPlan.create({
                data: { name, slug, description, price: Number(price), interval: interval || 'monthly', isFeatured: isFeatured || false, features: features || {}, limits: limits || {} },
            });
            reply.status(201).send(plan);
        }
        catch (error) {
            reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to create plan' });
        }
    });
    router.put('/:id', { preHandler: [authMiddleware, adminMiddleware], schema: schemas.update }, async (request, reply) => {
        try {
            const { name, description, price, interval, isActive, isFeatured, features, limits } = request.body;
            const { id } = request.params;
            const plan = await prisma.pricingPlan.update({
                where: { id },
                data: { ...(name && { name }), ...(description !== undefined && { description }), ...(price !== undefined && { price: Number(price) }), ...(interval && { interval }), ...(isActive !== undefined && { isActive }), ...(isFeatured !== undefined && { isFeatured }), ...(features && { features }), ...(limits && { limits }) },
            });
            reply.send(plan);
        }
        catch (error) {
            reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update plan' });
        }
    });
    router.delete('/:id', { preHandler: [authMiddleware, adminMiddleware], schema: schemas.remove }, async (request, reply) => {
        try {
            const { id } = request.params;
            await prisma.pricingPlan.update({ where: { id }, data: { isActive: false } });
            reply.send({ message: 'Plan deactivated successfully' });
        }
        catch (error) {
            reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete plan' });
        }
    });
}
