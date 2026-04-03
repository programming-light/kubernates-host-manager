import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { PlanLimitsDto } from './dto/plan.dto';

/**
 * PlanLimitService - Decoupled service for checking plan limits
 * 
 * Other modules (like deployments) should use this service to validate
 * that operations comply with the workspace's plan limits.
 * 
 * This avoids tight coupling between billing and deployment logic.
 */
@Injectable()
export class PlanLimitService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get the active plan limits for a workspace
   * Safe to call from any module that needs to validate limits
   */
  async getWorkspacePlanLimits(workspaceId: string): Promise<PlanLimitsDto> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
      include: {
        plan: {
          select: {
            cpuLimit: true,
            memoryLimitMb: true,
            storageLimitGb: true,
            bandwidthLimitGb: true,
            maxApps: true,
            maxDomains: true,
            autoscalingEnabled: true,
            backupEnabled: true,
            databaseEnabled: true,
            redisEnabled: true,
            supportLevel: true,
          },
        },
      },
    });

    if (!subscription || !subscription.plan) {
      throw new NotFoundException('No active subscription found for workspace');
    }

    return {
      cpuLimit: subscription.plan.cpuLimit,
      memoryLimitMb: subscription.plan.memoryLimitMb,
      storageLimitGb: subscription.plan.storageLimitGb,
      bandwidthLimitGb: subscription.plan.bandwidthLimitGb,
      maxApps: subscription.plan.maxApps,
      maxDomains: subscription.plan.maxDomains,
      autoscalingEnabled: subscription.plan.autoscalingEnabled,
      backupEnabled: subscription.plan.backupEnabled,
      databaseEnabled: subscription.plan.databaseEnabled,
      redisEnabled: subscription.plan.redisEnabled,
      supportLevel: subscription.plan.supportLevel,
    };
  }

  /**
   * Check if workspace has feature enabled
   */
  async isFeatureEnabled(workspaceId: string, feature: string): Promise<boolean> {
    const limits = await this.getWorkspacePlanLimits(workspaceId);

    const featureMap: Record<string, boolean> = {
      autoscaling: limits.autoscalingEnabled,
      backup: limits.backupEnabled,
      database: limits.databaseEnabled,
      redis: limits.redisEnabled,
    };

    return featureMap[feature] ?? false;
  }

  /**
   * Validate deployment can proceed based on plan limits
   * Called by deployment module before creating a deployment
   */
  async validateDeploymentLimits(
    workspaceId: string,
    deployment: {
      cpuRequested: number;
      memoryMbRequested: number;
    },
  ): Promise<{ valid: boolean; reason?: string }> {
    const limits = await this.getWorkspacePlanLimits(workspaceId);

    if (deployment.cpuRequested > limits.cpuLimit) {
      return {
        valid: false,
        reason: `Requested CPU (${deployment.cpuRequested} cores) exceeds plan limit of ${limits.cpuLimit} cores`,
      };
    }

    if (deployment.memoryMbRequested > limits.memoryLimitMb) {
      return {
        valid: false,
        reason: `Requested memory (${deployment.memoryMbRequested}MB) exceeds plan limit of ${limits.memoryLimitMb}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Check if workspace can add more domains
   */
  async canAddDomain(workspaceId: string): Promise<{ canAdd: boolean; reason?: string }> {
    const limits = await this.getWorkspacePlanLimits(workspaceId);

    const existingDomains = await this.prisma.domain.count({
      where: { workspaceId },
    });

    if (existingDomains >= limits.maxDomains) {
      return {
        canAdd: false,
        reason: `Domain limit reached. Plan allows ${limits.maxDomains} domains.`,
      };
    }

    return { canAdd: true };
  }

  /**
   * Check if workspace can add more projects/apps
   */
  async canAddProject(workspaceId: string): Promise<{ canAdd: boolean; reason?: string }> {
    const limits = await this.getWorkspacePlanLimits(workspaceId);

    const existingProjects = await this.prisma.project.count({
      where: { workspaceId },
    });

    if (existingProjects >= limits.maxApps) {
      return {
        canAdd: false,
        reason: `Project limit reached. Plan allows ${limits.maxApps} projects.`,
      };
    }

    return { canAdd: true };
  }

  /**
   * Get remaining quota for a workspace
   */
  async getResourceQuota(workspaceId: string) {
    const limits = await this.getWorkspacePlanLimits(workspaceId);

    const projectCount = await this.prisma.project.count({
      where: { workspaceId },
    });

    const domainCount = await this.prisma.domain.count({
      where: { workspaceId },
    });

    return {
      projects: {
        used: projectCount,
        limit: limits.maxApps,
        remaining: limits.maxApps - projectCount,
      },
      domains: {
        used: domainCount,
        limit: limits.maxDomains,
        remaining: limits.maxDomains - domainCount,
      },
      resources: {
        cpu: {
          limit: limits.cpuLimit,
        },
        memory: {
          limit: limits.memoryLimitMb,
        },
        storage: {
          limit: limits.storageLimitGb,
        },
        bandwidth: {
          limit: limits.bandwidthLimitGb,
        },
      },
      features: {
        autoscaling: limits.autoscalingEnabled,
        backup: limits.backupEnabled,
        database: limits.databaseEnabled,
        redis: limits.redisEnabled,
      },
    };
  }
}
