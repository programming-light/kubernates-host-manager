import { Module } from '@nestjs/common';
import { ClustersController } from './clusters.controller';
import { ClustersService } from './clusters.service';
import { ClusterEncryptionService } from './cluster-encryption.service';
import { KubernetesClientService } from './kubernetes-client.service';
import { PrismaService } from '../../common/prisma.service';

@Module({
  controllers: [ClustersController],
  providers: [ClustersService, ClusterEncryptionService, KubernetesClientService, PrismaService],
  exports: [ClustersService, ClusterEncryptionService, KubernetesClientService],
})
export class ClustersModule {}
