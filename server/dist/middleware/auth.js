import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { UserRole, hasPermission } from '../constants/roles.js';
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key';
function getTokenFromRequest(req) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
        return authHeader.split(' ')[1];
    }
    const cookieHeader = req.headers.cookie;
    if (cookieHeader) {
        const cookies = Object.fromEntries(cookieHeader.split('; ').map(c => c.split('=')));
        return cookies['accessToken'] || null;
    }
    return null;
}
export async function authMiddleware(req, res, next) {
    const token = getTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized', message: 'No token provided' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
        }
        req.userRole = user.role;
        next();
    }
    catch {
        return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }
}
export function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.userRole || !roles.includes(req.userRole)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Required role: ${roles.join(' or ')}`
            });
        }
        next();
    };
}
export function requirePermission(permission) {
    return (req, res, next) => {
        if (!req.userRole || !hasPermission(req.userRole, permission)) {
            return res.status(403).json({
                error: 'Forbidden',
                message: `Permission required: ${permission}`
            });
        }
        next();
    };
}
export const adminMiddleware = requireRole(UserRole.ADMIN);
export const managerMiddleware = requireRole(UserRole.ADMIN, UserRole.MANAGER);
export const billingMiddleware = requireRole(UserRole.ADMIN, UserRole.BILLING);
