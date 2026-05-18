import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';

export async function getClusters(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { workspaceId } = request.query as any;
    
    const where = workspaceId ? { workspaceId: workspaceId as string } : {};
    
    const clusters = await prisma.cluster.findMany({
      where,
      include: { workspace: true },
    });
    
    reply.send(clusters);
  } catch (error) {
    log.error('Error fetching clusters:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch clusters' });
  }
}

export async function createCluster(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { workspaceId, name } = request.body as any;

    if (!workspaceId || !name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'workspaceId and name are required' });
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Invalid workspace' });
    }

    const clusterCount = await prisma.cluster.count({
      where: { workspace: { ownerId: userId } },
    });

    if (clusterCount >= 1) {
      const subscription = await prisma.subscription.findUnique({
        where: { userId },
        include: { plan: true },
      });

      if (!subscription || subscription.status !== 'ACTIVE') {
        return reply.status(402).send({
          error: 'Payment Required',
          message: 'You have reached the free cluster limit. Please subscribe to a plan to create additional clusters.',
          upgradeUrl: '/dashboard/pricing',
        });
      }
    }

    const provider = process.env.K8S_PROVIDER || 'minikube';
    
    const cluster = await prisma.cluster.create({
      data: {
        workspaceId,
        name,
        provider,
        region: '',
        status: 'active',
      },
    });

    log.info(`Cluster created: ${name} with provider: ${provider}`);
    reply.status(201).send(cluster);
  } catch (error) {
    log.error('Error creating cluster:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to create cluster' });
  }
}

export async function getClusterById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const cluster = await prisma.cluster.findUnique({
      where: { id: (request.params as any).id },
      include: { workspace: true },
    });

    if (!cluster) {
      return reply.status(404).send({ error: 'Not Found', message: 'Cluster not found' });
    }

    if (cluster.workspace.ownerId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    let clusterInfo: Record<string, unknown> = {
      ...cluster,
      providerConfig: {
        provider: cluster.provider,
        apiServer: process.env[`${cluster.provider.toUpperCase()}_API_SERVER`] || null,
        region: process.env[`${cluster.provider.toUpperCase()}_REGION`] || null,
      },
    };

    try {
      const k8sConfig = await k8sConfigManager.loadConfig();
      clusterInfo.k8sConnected = k8sConfig.connected;
      clusterInfo.k8sVersion = k8sConfig.connected ? 'connected' : null;
    } catch {
      clusterInfo.k8sConnected = false;
    }

    reply.send(clusterInfo);
  } catch (error) {
    log.error('Error fetching cluster:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch cluster' });
  }
}

export async function deleteCluster(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const cluster = await prisma.cluster.findUnique({
      where: { id: (request.params as any).id },
      include: { workspace: true },
    });

    if (!cluster) {
      return reply.status(404).send({ error: 'Not Found', message: 'Cluster not found' });
    }

    if (cluster.workspace.ownerId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    await prisma.cluster.delete({ where: { id: (request.params as any).id } });
    reply.status(204).send();
  } catch (error) {
    log.error('Error deleting cluster:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete cluster' });
  }
}

export async function getClusterResources(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const cluster = await prisma.cluster.findUnique({
      where: { id: (request.params as any).id },
      include: { workspace: true },
    });

    if (!cluster || cluster.workspace.ownerId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    const userResources = await prisma.userResource.findMany({
      where: { userId },
    });

    reply.send(userResources);
  } catch (error) {
    log.error('Error fetching resources:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch resources' });
  }
}
