import { Injectable, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { CreatePlanDto, UpdatePlanDto, PlanResponseDto } from './dto/plan.dto';

@Injectable()
export class PlanService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new plan (admin only)
   */
  async createPlan(userId: string, dto: CreatePlanDto): Promise<PlanResponseDto> {
    // Check for duplicate slug
    const existing = await this.prisma.plan.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(`Plan with slug "${dto.slug}" already exists`);
    }

    const plan = await this.prisma.plan.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        monthlyPriceCents: dto.monthlyPriceCents,
        yearlyPriceCents: dto.yearlyPriceCents,
        cpuLimit: dto.cpuLimit,
        memoryLimitMb: dto.memoryLimitMb,
        storageLimitGb: dto.storageLimitGb,
        bandwidthLimitGb: dto.bandwidthLimitGb,
        maxApps: dto.maxApps,
        maxDomains: dto.maxDomains,
        autoscalingEnabled: dto.autoscalingEnabled,
        backupEnabled: dto.backupEnabled,
        databaseEnabled: dto.databaseEnabled,
        redisEnabled: dto.redisEnabled,
        supportLevel: dto.supportLevel,
        trialDays: dto.trialDays,
        isPublic: dto.isPublic,
        isDefault: dto.isDefault,
        sortOrder: dto.sortOrder,
        icon: dto.icon,
        color: dto.color,
      },
    });

    // Add features if provided
    if (dto.features && dto.features.length > 0) {
      await this.prisma.planFeature.createMany({
        data: dto.features.map((feature) => ({
          planId: plan.id,
          name: feature,
          included: true,
        })),
      });
    }

    // Add overage rules if provided
    if (dto.overages && dto.overages.length > 0) {
      await this.prisma.overageRule.createMany({
        data: dto.overages.map((overage) => ({
          planId: plan.id,
          overage: overage.overage,
          pricePerUnit: overage.pricePerUnit,
        })),
      });
    }

    // Audit log
    await this.logPlanAudit(plan.id, userId, 'created', null);

    return this.mapPlanToResponse(plan);
  }

  /**
   * Update a plan (admin only)
   */
  async updatePlan(userId: string, planId: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // If changing slug, check for duplicates
    if (dto.name && dto.name !== plan.name) {
      const existing = await this.prisma.plan.findUnique({
        where: { slug: dto.name?.toLowerCase().replace(/\s+/g, '-') || plan.slug },
      });
      if (existing && existing.id !== planId) {
        throw new ConflictException('Plan with this name already exists');
      }
    }

    const oldData = { ...plan };

    const updated = await this.prisma.plan.update({
      where: { id: planId },
      data: {
        name: dto.name,
        description: dto.description,
        monthlyPriceCents: dto.monthlyPriceCents,
        yearlyPriceCents: dto.yearlyPriceCents,
        cpuLimit: dto.cpuLimit,
        memoryLimitMb: dto.memoryLimitMb,
        storageLimitGb: dto.storageLimitGb,
        bandwidthLimitGb: dto.bandwidthLimitGb,
        maxApps: dto.maxApps,
        maxDomains: dto.maxDomains,
        autoscalingEnabled: dto.autoscalingEnabled,
        backupEnabled: dto.backupEnabled,
        databaseEnabled: dto.databaseEnabled,
        redisEnabled: dto.redisEnabled,
        supportLevel: dto.supportLevel,
        trialDays: dto.trialDays,
        isPublic: dto.isPublic,
        isDefault: dto.isDefault,
        sortOrder: dto.sortOrder,
        icon: dto.icon,
        color: dto.color,
      },
    });

    // Audit log
    const changes = this.getChangedFields(oldData, updated);
    await this.logPlanAudit(planId, userId, 'updated', changes);

    return this.mapPlanToResponse(updated);
  }

  /**
   * Get all plans (public and private)
   */
  async getAllPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.prisma.plan.findMany({
      include: {
        features: true,
        overages: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return plans.map((plan) => this.mapPlanToResponse(plan));
  }

  /**
   * Get public plans only (for pricing page)
   * Revalidated by Next.js ISR
   */
  async getPublicPlans(): Promise<PlanResponseDto[]> {
    const plans = await this.prisma.plan.findMany({
      where: { isPublic: true },
      include: {
        features: true,
        overages: true,
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });

    return plans.map((plan) => this.mapPlanToResponse(plan));
  }

  /**
   * Get a specific plan
   */
  async getPlan(planId: string): Promise<PlanResponseDto> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
      include: {
        features: true,
        overages: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    return this.mapPlanToResponse(plan);
  }

  /**
   * Delete a plan (admin only)
   * Cannot delete plans in use by active subscriptions
   */
  async deletePlan(userId: string, planId: string): Promise<void> {
    const plan = await this.prisma.plan.findUnique({
      where: { id: planId },
    });

    if (!plan) {
      throw new NotFoundException('Plan not found');
    }

    // Check if plan is in use
    const activeSubscriptions = await this.prisma.subscription.count({
      where: {
        planId,
        status: 'ACTIVE',
      },
    });

    if (activeSubscriptions > 0) {
      throw new BadRequestException(
        `Cannot delete plan with ${activeSubscriptions} active subscription(s)`,
      );
    }

    await this.prisma.plan.delete({
      where: { id: planId },
    });

    // Audit log
    await this.logPlanAudit(planId, userId, 'deleted', null);
  }

  /**
   * Get the default plan for new workspaces
   */
  async getDefaultPlan(): Promise<PlanResponseDto> {
    const plan = await this.prisma.plan.findFirst({
      where: { isDefault: true },
      include: {
        features: true,
        overages: true,
      },
    });

    if (!plan) {
      throw new NotFoundException('No default plan configured');
    }

    return this.mapPlanToResponse(plan);
  }

  /**
   * Helper: Map plan to response DTO
   */
  private mapPlanToResponse(plan: any): PlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      slug: plan.slug,
      description: plan.description,
      monthlyPriceCents: plan.monthlyPriceCents,
      yearlyPriceCents: plan.yearlyPriceCents,
      cpuLimit: plan.cpuLimit,
      memoryLimitMb: plan.memoryLimitMb,
      storageLimitGb: plan.storageLimitGb,
      bandwidthLimitGb: plan.bandwidthLimitGb,
      maxApps: plan.maxApps,
      maxDomains: plan.maxDomains,
      autoscalingEnabled: plan.autoscalingEnabled,
      backupEnabled: plan.backupEnabled,
      databaseEnabled: plan.databaseEnabled,
      redisEnabled: plan.redisEnabled,
      supportLevel: plan.supportLevel,
      trialDays: plan.trialDays,
      isPublic: plan.isPublic,
      isDefault: plan.isDefault,
      sortOrder: plan.sortOrder,
      icon: plan.icon,
      color: plan.color,
      features: plan.features?.map((f: any) => f.name) ?? [],
      overages: plan.overages?.map((o: any) => ({
        overage: o.overage,
        pricePerUnit: o.pricePerUnit,
      })) ?? [],
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  /**
   * Helper: Get fields that changed
   */
  private getChangedFields(oldData: any, newData: any): Record<string, any> {
    const changes: Record<string, any> = {};

    Object.keys(oldData).forEach((key) => {
      if (oldData[key] !== newData[key]) {
        changes[key] = {
          from: oldData[key],
          to: newData[key],
        };
      }
    });

    return Object.keys(changes).length > 0 ? changes : null;
  }

  /**
   * Helper: Audit log
   */
  private async logPlanAudit(
    planId: string,
    userId: string,
    action: string,
    changes: Record<string, any> | null,
  ): Promise<void> {
    try {
      await this.prisma.planAuditLog.create({
        data: {
          planId,
          userId,
          action,
          changes: changes ? JSON.stringify(changes) : null,
        },
      });
    } catch (error) {
      console.error('Failed to log plan audit:', error);
    }
  }
}
