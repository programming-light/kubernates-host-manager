import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { PlanService } from './plan.service';
import { SubscriptionService } from './subscription.service';
import { PlanLimitService } from './plan-limit.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [BillingController],
  providers: [PlanService, SubscriptionService, PlanLimitService, PrismaService],
  exports: [PlanService, SubscriptionService, PlanLimitService],
})
export class BillingModule {}
