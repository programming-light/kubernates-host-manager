import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import * as pino from 'pino';
import { DeploymentWorker } from './workers/deployment.worker';
import { SSLWorker } from './workers/ssl.worker';
import { HealthCheckWorker } from './workers/health-check.worker';

const logger = pino.default();
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const prisma = new PrismaClient();

// Queue definitions
const deploymentQueue = new Queue('deployments', { connection: redis });
const sslQueue = new Queue('ssl-provisioning', { connection: redis });
const healthCheckQueue = new Queue('health-checks', { connection: redis });

async function setupWorkers() {
  logger.info('Starting K8s Platform Worker Service');

  try {
    // Deployment Worker
    const deploymentWorker = new Worker('deployments', async (job) => {
      return new DeploymentWorker(prisma).process(job);
    }, { connection: redis });

    deploymentWorker.on('completed', (job) => {
      logger.info(`Deployment job ${job.id} completed`);
    });

    deploymentWorker.on('failed', (job, error) => {
      logger.error(`Deployment job ${job.id} failed: ${error.message}`);
    });

    // SSL Worker
    const sslWorker = new Worker('ssl-provisioning', async (job) => {
      return new SSLWorker(prisma).process(job);
    }, { connection: redis });

    sslWorker.on('completed', (job) => {
      logger.info(`SSL job ${job.id} completed`);
    });

    sslWorker.on('failed', (job, error) => {
      logger.error(`SSL job ${job.id} failed: ${error.message}`);
    });

    // Health Check Worker
    const healthWorker = new Worker('health-checks', async (job) => {
      return new HealthCheckWorker(prisma).process(job);
    }, { connection: redis });

    healthWorker.on('completed', (job) => {
      logger.info(`Health check job ${job.id} completed`);
    });

    healthWorker.on('failed', (job, error) => {
      logger.error(`Health check job ${job.id} failed: ${error.message}`);
    });

    logger.info('All workers started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await deploymentWorker.close();
      await sslWorker.close();
      await healthWorker.close();
      await redis.quit();
      await prisma.$disconnect();
      process.exit(0);
    });
  } catch (error) {
    logger.error('Failed to start workers:', error);
    process.exit(1);
  }
}

setupWorkers();
