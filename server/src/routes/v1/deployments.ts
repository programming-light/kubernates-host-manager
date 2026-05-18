import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authMiddleware } from '../../middleware/auth.js';
import { deployments as schemas } from '../../schemas/index.js';
import prisma from '../../lib/prisma.js';
import log from '../../lib/logger.js';

export default async function(router: FastifyInstance) {
  router.get('/', { preHandler: [authMiddleware], schema: schemas.list }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId;
      const { projectId, page, limit } = request.query as any;

      const where: any = {
        project: { workspace: { ownerId: userId } },
      };
      if (projectId) where.projectId = projectId as string;

      const skip = (Number(page || 1) - 1) * Number(limit || 20);
      const [deployments, total] = await Promise.all([
        prisma.deployment.findMany({
          where,
          include: { project: { include: { workspace: true } } },
          orderBy: { createdAt: 'desc' },
          skip,
          take: Number(limit || 20),
        }),
        prisma.deployment.count({ where }),
      ]);
      reply.send({ data: deployments, pagination: { page: Number(page || 1), limit: Number(limit || 20), total, pages: Math.ceil(total / Number(limit || 20)) } });
    } catch (error) {
      log.error('Error fetching deployments:', error);
      reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch deployments' });
    }
  });

  router.post('/', { preHandler: [authMiddleware], schema: schemas.create }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId;
      const { projectId, environment, version, config } = request.body as any;

      if (!projectId || !environment) {
        return reply.status(400).send({ error: 'Bad Request', message: 'projectId and environment are required' });
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { workspace: true },
      });

      if (!project || project.workspace.ownerId !== userId) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      }

      const deployment = await prisma.deployment.create({
        data: { projectId, environment, version: version || 'v1.0.0', status: 'pending', config },
      });

      log.info(`Deployment created: ${deployment.id} for project: ${projectId}`);
      reply.status(201).send(deployment);
    } catch (error) {
      log.error('Error creating deployment:', error);
      reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to create deployment' });
    }
  });

  router.get('/:id', { preHandler: [authMiddleware], schema: schemas.getById }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId;
      const deployment = await prisma.deployment.findUnique({
        where: { id: (request.params as any).id },
        include: { project: { include: { workspace: true } } },
      });

      if (!deployment) {
        return reply.status(404).send({ error: 'Not Found', message: 'Deployment not found' });
      }

      if (deployment.project.workspace.ownerId !== userId) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      }

      reply.send(deployment);
    } catch (error) {
      log.error('Error fetching deployment:', error);
      reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch deployment' });
    }
  });

  router.put('/:id', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId;
      const { status, version } = request.body as any;
      const deployment = await prisma.deployment.findUnique({
        where: { id: (request.params as any).id },
        include: { project: { include: { workspace: true } } },
      });

      if (!deployment || deployment.project.workspace.ownerId !== userId) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      }

      const updated = await prisma.deployment.update({
        where: { id: (request.params as any).id },
        data: { ...(status && { status }), ...(version && { version }) },
      });

      reply.send(updated);
    } catch (error) {
      log.error('Error updating deployment:', error);
      reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update deployment' });
    }
  });

  router.post('/:id/rollback', { preHandler: [authMiddleware], schema: schemas.rollback }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId;
      const deployment = await prisma.deployment.findUnique({
        where: { id: (request.params as any).id },
        include: { project: { include: { workspace: true } } },
      });

      if (!deployment) {
        return reply.status(404).send({ error: 'Not Found', message: 'Deployment not found' });
      }

      if (deployment.project.workspace.ownerId !== userId) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      }

      reply.send({ message: 'Rollback initiated', deploymentId: (request.params as any).id });
    } catch (error: any) {
      log.error('Error rolling back deployment:', error);
      reply.status(500).send({ error: 'Internal Server Error', message: error.message });
    }
  });

  router.delete('/:id', { preHandler: [authMiddleware] }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const userId = (request as any).userId;
      const deployment = await prisma.deployment.findUnique({
        where: { id: (request.params as any).id },
        include: { project: { include: { workspace: true } } },
      });

      if (!deployment || deployment.project.workspace.ownerId !== userId) {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      }

      await prisma.deployment.delete({ where: { id: (request.params as any).id } });
      reply.status(204).send();
    } catch (error) {
      log.error('Error deleting deployment:', error);
      reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete deployment' });
    }
  });
}
