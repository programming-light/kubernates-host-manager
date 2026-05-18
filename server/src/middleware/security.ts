import { FastifyRequest, FastifyReply, FastifyError } from 'fastify';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';

export async function ipBlocker(request: FastifyRequest, reply: FastifyReply) {
  const ip = request.ip;

  try {
    const blocked = await prisma.blockedIP.findFirst({
      where: {
        ip,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (blocked) {
      log.warn(`Blocked request from IP: ${ip} - ${blocked.reason || 'No reason'}`);
      reply.status(403).send({ error: 'Forbidden', message: 'Your IP has been blocked' });
    }
  } catch (error) {
    log.error('IP blocker error:', error);
  }
}

export async function logRequest(request: FastifyRequest, reply: FastifyReply) {
  if (request.url === '/api/health' || request.url.startsWith('/api-docs')) return;

  try {
    await prisma.requestLog.create({
      data: {
        ip: request.ip,
        method: request.method,
        url: request.url,
        userAgent: (request.headers['user-agent'] || '').substring(0, 500),
        referer: (request.headers['referer'] || '').substring(0, 500),
        userId: (request as any).userId || null,
      },
    });
  } catch (error) {
    log.warn('[security] Failed to log request:', error);
  }
}

export async function updateRequestLog(request: FastifyRequest, reply: FastifyReply) {
  try {
    await prisma.requestLog.updateMany({
      where: {
        ip: request.ip,
        createdAt: { gte: new Date(Date.now() - 5000) },
      },
      data: {
        statusCode: reply.statusCode,
      },
    });
  } catch (error) {
    log.warn('[security] Failed to update request log:', error);
  }
}
