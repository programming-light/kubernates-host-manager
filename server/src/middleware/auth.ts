import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { UserRole, hasPermission } from '../constants/roles.js';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
    userRole?: UserRole;
    email?: string;
  }
}

function getTokenFromRequest(request: FastifyRequest): string | null {
  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.split(' ')[1];
  }

  const cookieHeader = request.headers.cookie;
  if (cookieHeader) {
    const cookies = Object.fromEntries(
      cookieHeader.split('; ').map(c => c.split('='))
    );
    return cookies['accessToken'] || null;
  }

  return null;
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  const token = getTokenFromRequest(request);

  if (!token) {
    reply.status(401).send({ error: 'Unauthorized', message: 'No token provided' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; email?: string };
    request.userId = decoded.userId;
    request.email = decoded.email;

    let user;
    try {
      user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    } catch (dbError) {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev) {
        request.userRole = UserRole.DEVELOPER;
        return;
      }
      reply.status(503).send({ error: 'Service Unavailable', message: 'Database unreachable' });
      return;
    }

    if (!user) {
      const isDev = process.env.NODE_ENV === 'development';
      if (isDev && decoded.userId.startsWith('dev-')) {
        request.userRole = UserRole.DEVELOPER;
        return;
      }
      reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      return;
    }

    request.userRole = user.role as UserRole;
  } catch {
    reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userRole || !roles.includes(request.userRole)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `Required role: ${roles.join(' or ')}`,
      });
    }
  };
}

export function requirePermission(permission: string) {
  return (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.userRole || !hasPermission(request.userRole, permission)) {
      reply.status(403).send({
        error: 'Forbidden',
        message: `Permission required: ${permission}`,
      });
    }
  };
}

export const adminMiddleware = requireRole(UserRole.ADMIN);
export const managerMiddleware = requireRole(UserRole.ADMIN, UserRole.MANAGER);
export const billingMiddleware = requireRole(UserRole.ADMIN, UserRole.BILLING);
