import * as crypto from 'crypto';
import log from './logger.js';

let redisClient: any = null;

async function getRedisClient(): Promise<any> {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl || !redisUrl.trim()) {
    return null;
  }

  try {
    const { default: Redis } = await import('ioredis');
    redisClient = new Redis(redisUrl, {
      lazyConnect: true,
      enableReadyCheck: false,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
      maxRetriesPerRequest: 3,
    });

    await redisClient.connect().catch(() => {
      redisClient = null;
    });
  } catch (err: any) {
    log.warn(`Redis not available for OTP cache, using in-memory: ${err.message}`);
    redisClient = null;
  }

  return redisClient;
}

const memoryStore = new Map<string, { code: string; expiresAt: number }>();

export async function generateOTP(email: string): Promise<string> {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const ttl = 5 * 60;
  const expiresAt = Date.now() + ttl * 1000;

  const client = await getRedisClient();
  if (client) {
    try {
      await client.set(`otp:${email}`, code, 'EX', ttl);
    } catch {
      memoryStore.set(email, { code, expiresAt });
    }
  } else {
    memoryStore.set(email, { code, expiresAt });
  }

  return code;
}

export async function verifyOTP(email: string, code: string): Promise<boolean> {
  const client = await getRedisClient();
  if (client) {
    try {
      const stored = await client.get(`otp:${email}`);
      if (!stored) return false;
      const isValid = stored === code;
      if (isValid) await client.del(`otp:${email}`);
      return isValid;
    } catch {
      return verifyFromMemory(email, code);
    }
  }

  return verifyFromMemory(email, code);
}

function verifyFromMemory(email: string, code: string): boolean {
  const record = memoryStore.get(email);
  if (!record) return false;
  if (Date.now() > record.expiresAt) {
    memoryStore.delete(email);
    return false;
  }
  const isValid = record.code === code;
  if (isValid) memoryStore.delete(email);
  return isValid;
}

export async function getOTP(email: string): Promise<string | null> {
  const client = await getRedisClient();
  if (client) {
    try {
      return await client.get(`otp:${email}`);
    } catch {
      return getFromMemory(email);
    }
  }

  return getFromMemory(email);
}

function getFromMemory(email: string): string | null {
  const record = memoryStore.get(email);
  if (!record || Date.now() > record.expiresAt) {
    if (record) memoryStore.delete(email);
    return null;
  }
  return record.code;
}
