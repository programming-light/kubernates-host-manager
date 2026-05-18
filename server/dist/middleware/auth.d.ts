import { FastifyRequest, FastifyReply } from 'fastify';
import { UserRole } from '../constants/roles.js';
declare module 'fastify' {
    interface FastifyRequest {
        userId?: string;
        userRole?: UserRole;
    }
}
export declare function authMiddleware(request: FastifyRequest, reply: FastifyReply): Promise<void>;
export declare function requireRole(...roles: UserRole[]): (request: FastifyRequest, reply: FastifyReply) => void;
export declare function requirePermission(permission: string): (request: FastifyRequest, reply: FastifyReply) => void;
export declare const adminMiddleware: (request: FastifyRequest, reply: FastifyReply) => void;
export declare const managerMiddleware: (request: FastifyRequest, reply: FastifyReply) => void;
export declare const billingMiddleware: (request: FastifyRequest, reply: FastifyReply) => void;
