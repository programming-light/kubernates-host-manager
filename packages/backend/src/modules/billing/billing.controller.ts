import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { PlanLimitService } from './plan-limit.service';
import { CreatePlanDto, UpdatePlanDto, SubscribePlanDto } from './dto/plan.dto';

@Controller('billing')
export class BillingController {
  constructor(
    private planService: PlanService,
    private subscriptionService: SubscriptionService,
    private planLimitService: PlanLimitService,
  ) {}

  // ===== Public Plan Endpoints (for pricing page) =====

  /**
   * Get all public plans
   * Used by Next.js ISR pricing page during build
   * No auth required
   */
  @Get('plans/public')
  async getPublicPlans() {
    const plans = await this.planService.getPublicPlans();
    return { plans };
  }

  /**
   * Get a specific public plan
   */
  @Get('plans/public/:slug')
  async getPublicPlan(@Param('slug') slug: string) {
    // Fetch plan by slug
    const plans = await this.planService.getPublicPlans();
    const plan = plans.find((p) => p.slug === slug);

    if (!plan) {
      return { error: 'Plan not found' };
    }

    return { plan };
  }

  // ===== Admin Plan Management Endpoints =====

  /**
   * Create a new plan (admin only)
   */
  @Post('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async createPlan(@Req() req: any, @Body() dto: CreatePlanDto) {
    const plan = await this.planService.createPlan(req.user.sub, dto);
    return { plan };
  }

  /**
   * Get all plans (admin)
   */
  @Get('plans')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getAllPlans() {
    const plans = await this.planService.getAllPlans();
    return { plans };
  }

  /**
   * Get a specific plan (admin)
   */
  @Get('plans/:planId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async getPlan(@Param('planId') planId: string) {
    const plan = await this.planService.getPlan(planId);
    return { plan };
  }

  /**
   * Update a plan (admin only)
   */
  @Put('plans/:planId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async updatePlan(
    @Req() req: any,
    @Param('planId') planId: string,
    @Body() dto: UpdatePlanDto,
  ) {
    const plan = await this.planService.updatePlan(req.user.sub, planId, dto);
    return { plan };
  }

  /**
   * Delete a plan (admin only)
   */
  @Delete('plans/:planId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN', 'ADMIN')
  async deletePlan(@Req() req: any, @Param('planId') planId: string) {
    await this.planService.deletePlan(req.user.sub, planId);
    return { message: 'Plan deleted successfully' };
  }

  // ===== Subscription Endpoints =====

  /**
   * Get current workspace subscription
   */
  @Get('workspaces/:workspaceId/subscription')
  @UseGuards(JwtAuthGuard)
  async getSubscription(@Param('workspaceId') workspaceId: string) {
    const subscription = await this.subscriptionService.getWorkspaceSubscription(workspaceId);
    return { subscription };
  }

  /**
   * Subscribe to a plan
   */
  @Post('workspaces/:workspaceId/subscription')
  @UseGuards(JwtAuthGuard)
  async subscribeToPlan(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: SubscribePlanDto,
  ) {
    const subscription = await this.subscriptionService.subscribeToPlan(
      workspaceId,
      req.user.sub,
      dto,
    );
    return { subscription };
  }

  /**
   * Change subscription plan
   */
  @Put('workspaces/:workspaceId/subscription/plan')
  @UseGuards(JwtAuthGuard)
  async changeSubscriptionPlan(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
    @Body() body: { planId: string },
  ) {
    const subscription = await this.subscriptionService.changeSubscriptionPlan(
      workspaceId,
      req.user.sub,
      body.planId,
    );
    return { subscription };
  }

  /**
   * Cancel subscription
   */
  @Post('workspaces/:workspaceId/subscription/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelSubscription(
    @Req() req: any,
    @Param('workspaceId') workspaceId: string,
  ) {
    await this.subscriptionService.cancelSubscription(workspaceId, req.user.sub);
    return { message: 'Subscription cancelled' };
  }

  // ===== Plan Limit Endpoints (for UI/quota display) =====

  /**
   * Get plan limits for a workspace
   */
  @Get('workspaces/:workspaceId/limits')
  @UseGuards(JwtAuthGuard)
  async getPlanLimits(@Param('workspaceId') workspaceId: string) {
    const limits = await this.planLimitService.getWorkspacePlanLimits(workspaceId);
    return { limits };
  }

  /**
   * Get resource quota for a workspace
   */
  @Get('workspaces/:workspaceId/quota')
  @UseGuards(JwtAuthGuard)
  async getResourceQuota(@Param('workspaceId') workspaceId: string) {
    const quota = await this.planLimitService.getResourceQuota(workspaceId);
    return { quota };
  }

  /**
   * Check if feature is enabled
   */
  @Get('workspaces/:workspaceId/features/:feature')
  @UseGuards(JwtAuthGuard)
  async checkFeature(
    @Param('workspaceId') workspaceId: string,
    @Param('feature') feature: string,
  ) {
    const enabled = await this.planLimitService.isFeatureEnabled(workspaceId, feature);
    return { enabled };
  }
}
