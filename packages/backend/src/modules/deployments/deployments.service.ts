import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/common/prisma.service';

@Injectable()
export class DeploymentsService {
  constructor(private prisma: PrismaService) {}

  async createDeployment(projectId: string, data: any, userId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    const latestDeployment = await this.prisma.deployment.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
    });

    return this.prisma.deployment.create({
      data: {
        projectId,
        version: (latestDeployment?.version || 0) + 1,
        status: 'QUEUED',
        commitSha: data.commitSha,
        commitMessage: data.commitMessage,
        deployedBy: userId,
        startedAt: new Date(),
      },
    });
  }

  async getDeployment(id: string) {
    return this.prisma.deployment.findUnique({
      where: { id },
      include: {
        project: true,
        deployedByUser: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async getDeploymentLogs(id: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id },
    });
    return { id, logs: deployment?.logs || '' };
  }
}
