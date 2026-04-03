import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Fetch user with tenant info
    const userWithTenant = await this.prisma.user.findUnique({
      where: { id: user.userId },
      include: { tenant: true },
    });

    if (!userWithTenant) {
      throw new ForbiddenException('User not found');
    }

    // Attach tenant to request
    request.tenant = userWithTenant.tenant;
    request.user = { ...user, tenantId: userWithTenant.tenantId };

    return true;
  }
}
