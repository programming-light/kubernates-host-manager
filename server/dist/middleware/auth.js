import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { UserRole, hasPermission } from '../constants/roles.js';
if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is required');
}
const JWT_SECRET = process.env.JWT_SECRET;
function getTokenFromRequest(request) {
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }
    const cookieHeader = request.headers.cookie;
    if (cookieHeader) {
        const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
        return cookies['accessToken'] || null;
    }
    return null;
}
export async function authMiddleware(request, reply) {
    const token = getTokenFromRequest(request);
    if (!token) {
        reply.status(401).send({ error: 'Unauthorized', message: 'No token provided' });
        return;
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        request.userId = decoded.userId;
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
            return;
        }
        request.userRole = user.role;
    }
    catch {
        reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
}
export function requireRole(...roles) {
    return (request, reply) => {
        if (!request.userRole || !roles.includes(request.userRole)) {
            reply.status(403).send({
                error: 'Forbidden',
                message: `Required role: ${roles.join(' or ')}`,
            });
        }
    };
}
export function requirePermission(permission) {
    return (request, reply) => {
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
