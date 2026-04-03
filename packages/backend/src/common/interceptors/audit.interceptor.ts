import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, user } = request;

    // Only log state-changing operations
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap(async (response) => {
        if (user && user.tenantId) {
          try {
            const resourceMatch = url.match(/\/(\w+)\//);
            const resourceType = resourceMatch ? resourceMatch[1] : 'unknown';

            await this.prisma.auditLog.create({
              data: {
                tenantId: user.tenantId,
                userId: user.userId,
                action: `${resourceType}.${method.toLowerCase()}`,
                resourceType,
                resourceId: url.split('/').pop() || 'unknown',
                changes: JSON.stringify(request.body || {}),
                ipAddress: request.ip,
                userAgent: request.get('user-agent'),
              },
            });
          } catch (error) {
            console.error('Audit log error:', error);
          }
        }
      }),
    );
  }
}
