import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { SubscribePlanDto, WorkspacePlanResponseDto } from './dto/plan.dto';

@Injectable()
export class SubscriptionService {
  constructor(private prisma: PrismaService) {}

  /**
   * Subscribe workspace to a plan
   */
  async subscribeToPlan(
    workspaceId: string,
    userId: string,
    dto: SubscribePlanDto,
  ): Promise<WorkspacePlanResponseDto> {
    // Verify workspace exists and user has access
    const workspace = await this.prisma.workspace.findFirst({
      where: {
        id: workspaceId,
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found or access denied');
    }

    // Get plan
    const plan = await this.prisma.plan.findUnique({
      where: { id: dto.planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Cancel existing subscription if any
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: { workspaceId },
    });

    if (existingSubscription) {
      await this.prisma.subscription.delete({
        where: { id: existingSubscription.id },
      });
    }

    // Create new subscription
    const now = new Date();
    const periodEnd = new Date();
    periodEnd.setMonth(periodEnd.getMonth() + (dto.isYearly ? 12 : 1));

    const subscription = await this.prisma.subscription.create({
      data: {
        workspaceId,
        planId: dto.planId,
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      include: {
        plan: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        action: 'subscription.created',
        resourceType: 'subscription',
        resourceId: subscription.id,
      },
    });

    return this.mapSubscriptionToResponse(subscription, dto.isYearly);
  }

  /**
   * Get current subscription for workspace
   */
  async getWorkspaceSubscription(workspaceId: string): Promise<WorkspacePlanResponseDto> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        workspaceId,
        status: 'ACTIVE',
      },
      include: {
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    // Determine billing cycle from current period
    const monthInMs = 30 * 24 * 60 * 60 * 1000;
    const periodDurationMs =
      subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime();
    const isYearly = periodDurationMs > monthInMs * 6;

    return this.mapSubscriptionToResponse(subscription, isYearly);
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(workspaceId: string, userId: string): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found');
    }

    await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        action: 'subscription.cancelled',
        resourceType: 'subscription',
        resourceId: subscription.id,
      },
    });
  }

  /**
   * Downgrade/upgrade subscription
   */
  async changeSubscriptionPlan(
    workspaceId: string,
    userId: string,
    newPlanId: string,
  ): Promise<WorkspacePlanResponseDto> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException('No active subscription found');
    }

    const newPlan = await this.prisma.plan.findUnique({
      where: { id: newPlanId },
    });

    if (!newPlan) {
      throw new NotFoundException('New plan not found');
    }

    // Determine if yearly
    const monthInMs = 30 * 24 * 60 * 60 * 1000;
    const periodDurationMs =
      subscription.currentPeriodEnd.getTime() - subscription.currentPeriodStart.getTime();
    const isYearly = periodDurationMs > monthInMs * 6;

    // Update subscription
    const updated = await this.prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: newPlanId,
      },
      include: {
        plan: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        workspaceId,
        userId,
        action: 'subscription.plan_changed',
        resourceType: 'subscription',
        resourceId: subscription.id,
        changes: JSON.stringify({
          from: subscription.planId,
          to: newPlanId,
        }),
      },
    });

    return this.mapSubscriptionToResponse(updated, isYearly);
  }

  /**
   * Helper: Map subscription to response
   */
  private mapSubscriptionToResponse(
    subscription: any,
    isYearly: boolean,
  ): WorkspacePlanResponseDto {
    const monthlyPrice = subscription.plan.monthlyPriceCents / 100;
    const yearlyPrice = subscription.plan.yearlyPriceCents / 100;

    return {
      workspaceId: subscription.workspaceId,
      planId: subscription.planId,
      planName: subscription.plan.name,
      monthlyPrice,
      yearlyPrice,
      billingCycle: isYearly ? 'yearly' : 'monthly',
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      status: subscription.status,
      resourceUsage: {
        cpuUsed: 0, // Would be populated from metrics
        cpuLimit: subscription.plan.cpuLimit,
        memoryUsedMb: 0, // Would be populated from metrics
        memoryLimitMb: subscription.plan.memoryLimitMb,
        storageUsedGb: 0, // Would be populated from metrics
        storageLimitGb: subscription.plan.storageLimitGb,
      },
    };
  }
}
