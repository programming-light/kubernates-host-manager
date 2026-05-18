import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import log from './logger.js';
import { containerBuilder, BuildRequest, BuildResult } from './container-builder.js';
import { emitK8sEvent } from './socket.js';

let connection: Redis | null = null;
let buildQueue: Queue | null = null;
let worker: Worker | null = null;

function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL;
  if (url && url.trim()) return url.trim();
  return null;
}

function getConnection(): Redis | null {
  if (connection) return connection;

  const redisUrl = getRedisUrl();
  if (!redisUrl) {
    log.warn('REDIS_URL not configured. Queue functionality disabled.');
    return null;
  }

  try {
    connection = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => Math.min(times * 100, 3000),
      lazyConnect: true,
    });

    connection.on('error', (err) => {
      log.warn(`Redis connection error (queue will be unavailable): ${err.message}`);
    });

    connection.on('connect', () => {
      log.info('Redis connected for BullMQ');
    });
  } catch (err: any) {
    log.warn(`Failed to create Redis connection: ${err.message}`);
    return null;
  }

  return connection;
}

async function getQueue(): Promise<Queue | null> {
  if (buildQueue) return buildQueue;

  const conn = getConnection();
  if (!conn) return null;

  buildQueue = new Queue('builds', {
    connection: conn,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: 100,
      removeOnFail: 50,
    },
  });

  return buildQueue;
}

async function startWorker(): Promise<void> {
  if (worker) return;

  const conn = getConnection();
  if (!conn) return;

  worker = new Worker<BuildRequest, BuildResult>(
    'builds',
    async (job: Job<BuildRequest>) => {
      const { gitUrl, projectId, namespace, branch } = job.data;
      log.info(`Processing build job ${job.id} for ${gitUrl}`);

      emitK8sEvent('build', { projectId, gitUrl, jobId: job.id, status: 'started' }, projectId);

      try {
        const result = await containerBuilder.buildFromGit(job.data);
        emitK8sEvent('build', {
          projectId, imageName: result.fullImage, jobId: job.id, status: 'completed',
        }, projectId);
        return result;
      } catch (err: any) {
        emitK8sEvent('build', {
          projectId, error: err.message, jobId: job.id, status: 'failed',
        }, projectId);
        throw err;
      }
    },
    { connection: conn, concurrency: 2 }
  );

  worker.on('completed', (job) => {
    log.info(`Build job ${job.id} completed: ${job.returnvalue?.fullImage}`);
  });

  worker.on('failed', (job, err) => {
    log.error(`Build job ${job?.id} failed: ${err.message}`);
  });
}

export async function enqueueBuild(buildReq: BuildRequest): Promise<Job<BuildRequest> | null> {
  const queue = await getQueue();
  if (!queue) {
    log.warn('Queue unavailable, skipping enqueue');
    return null;
  }

  await startWorker();

  return queue.add('build', buildReq, {
    jobId: `build-${buildReq.projectId}-${Date.now()}`,
  });
}

export async function getBuildStatus(jobId: string) {
  const queue = await getQueue();
  if (!queue) return { status: 'not_found', error: 'Queue unavailable' };

  const job = await queue.getJob(jobId);
  if (!job) return { status: 'not_found' };

  const state = await job.getState();
  const result = job.returnvalue;
  const failedReason = job.failedReason;

  return { status: state, result, failedReason, progress: job.progress };
}

export async function getQueueStats() {
  const queue = await getQueue();
  if (!queue) return { waiting: 0, active: 0, completed: 0, failed: 0 };

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);
  return { waiting, active, completed, failed };
}

export async function closeQueue() {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (buildQueue) {
    await buildQueue.close();
    buildQueue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
