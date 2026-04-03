import { Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import * as pino from 'pino';
import axios from 'axios';

const logger = pino.default();

export class HealthCheckWorker {
  constructor(private prisma: PrismaClient) {}

  async process(job: Job) {
    logger.info(`Processing health check job ${job.id}`, job.data);

    const { deploymentId, endpoint } = job.data;

    try {
      // Get deployment
      const deployment = await this.prisma.deployment.findUnique({
        where: { id: deploymentId },
        include: { project: true },
      });

      if (!deployment) {
        throw new Error(`Deployment ${deploymentId} not found`);
      }

      // Perform health check
      logger.info(`Health checking endpoint ${endpoint}`);

      try {
        const response = await axios.get(endpoint, {
          timeout: 10000,
        });

        if (response.status >= 200 && response.status < 300) {
          logger.info(`Health check passed for deployment ${deploymentId}`);
          return { success: true, deploymentId, status: 'healthy' };
        } else {
          logger.warn(`Health check failed with status ${response.status}`);
          return { success: true, deploymentId, status: 'unhealthy' };
        }
      } catch (axiosError) {
        logger.warn(`Health check request failed: ${axiosError.message}`);
        return { success: true, deploymentId, status: 'unreachable' };
      }
    } catch (error) {
      logger.error(`Health check job ${job.id} failed:`, error);
      throw error;
    }
  }

  private sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
