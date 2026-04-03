import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tenantId: true,
        createdAt: true,
      },
    });
  }

  async listTenants() {
    return this.prisma.tenant.findMany({
      include: {
        _count: {
          select: { users: true, projects: true },
        },
      },
    });
  }

  async getStats() {
    const userCount = await this.prisma.user.count();
    const tenantCount = await this.prisma.tenant.count();
    const projectCount = await this.prisma.project.count();
    const deploymentCount = await this.prisma.deployment.count();

    return {
      users: userCount,
      tenants: tenantCount,
      projects: projectCount,
      deployments: deploymentCount,
    };
  }

  async getAuditLogs(limit = 100) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        user: { select: { email: true, name: true } },
        tenant: { select: { name: true } },
      },
    });
  }
}
