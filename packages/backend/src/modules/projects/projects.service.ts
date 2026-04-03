import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async listProjects(tenantId: string) {
    return this.prisma.project.findMany({
      where: { tenantId },
      include: {
        cluster: { select: { id: true, name: true } },
        deployments: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async createProject(tenantId: string, data: any) {
    return this.prisma.project.create({
      data: {
        tenantId,
        clusterId: data.clusterId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        gitUrl: data.gitUrl,
        namespace: `${tenantId}-${data.slug}`,
      },
    });
  }

  async getProject(id: string) {
    return this.prisma.project.findUnique({
      where: { id },
      include: {
        cluster: true,
        deployments: { orderBy: { createdAt: 'desc' }, take: 10 },
        domains: true,
        environments: true,
      },
    });
  }
}
