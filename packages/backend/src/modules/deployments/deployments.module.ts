import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { DeploymentsController } from './deployments.controller';
import { DeploymentOrchestrationService } from './deployment-orchestration.service';
import { DeploymentProcessor } from './deployment.processor';
import { PrismaService } from '../../common/prisma.service';
import { KubernetesClientService } from '../clusters/kubernetes-client.service';
import { PlanLimitService } from '../billing/plan-limit.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'deployments',
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: true,
      },
    }),
  ],
  controllers: [DeploymentsController],
  providers: [
    DeploymentOrchestrationService,
    DeploymentProcessor,
    PrismaService,
    KubernetesClientService,
    PlanLimitService,
  ],
  exports: [DeploymentOrchestrationService],
})
export class DeploymentsModule {}
