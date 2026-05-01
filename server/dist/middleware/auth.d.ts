import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../constants/roles.js';
interface AuthReq extends Request {
    userId?: string;
    userRole?: UserRole;
}
export type AuthRequest = AuthReq;
export declare function authMiddleware(req: AuthReq, res: Response, next: NextFunction): Promise<Response<any, Record<string, any>> | undefined>;
export declare function requireRole(...roles: UserRole[]): (req: AuthReq, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare function requirePermission(permission: string): (req: AuthReq, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const adminMiddleware: (req: AuthReq, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const managerMiddleware: (req: AuthReq, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const billingMiddleware: (req: AuthReq, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export {};
