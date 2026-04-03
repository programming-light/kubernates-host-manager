import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { ClusterEncryptionService } from './cluster-encryption.service';
import { KubernetesClientService } from './kubernetes-client.service';
import {
  CreateClusterTokenDto,
  CreateClusterKubeconfigDto,
  UpdateClusterDto,
  ClusterDetailResponseDto,
  ClusterListResponseDto,
} from './dto/cluster.dto';

@Injectable()
export class ClustersService {
  constructor(
    private prisma: PrismaService,
    private encryptionService: ClusterEncryptionService,
    private k8sClient: KubernetesClientService,
  ) {}

  /**
   * Create cluster from token mode credentials
   */
  async createClusterToken(
    workspaceId: string,
    userId: string,
    dto: CreateClusterTokenDto,
  ): Promise<ClusterDetailResponseDto> {
    await this.checkWorkspacePermission(workspaceId, userId);

    // Check name uniqueness within workspace
    const existing = await this.prisma.cluster.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('A cluster with this name already exists in your workspace');
    }

    // Validate base64
    if (!this.encryptionService.isValidBase64(dto.caCertificateBase64)) {
      throw new BadRequestException('caCertificateBase64 must be valid base64');
    }

    // Test connectivity before saving
    const credentials = {
      apiEndpoint: dto.apiEndpoint,
      caCertificateBase64: dto.caCertificateBase64,
      token: dto.token,
    };

    try {
      await this.k8sClient.testConnection(credentials);
    } catch (error) {
      throw new BadRequestException(`Cluster connectivity test failed: ${error.message}`);
    }

    // Encrypt credentials
    const encryptedCaCert = this.encryptionService.encrypt(dto.caCertificateBase64);
    const encryptedToken = this.encryptionService.encrypt(dto.token);

    // Get cluster info
    const clusterInfo = await this.k8sClient.getClusterInfo(credentials);

    const cluster = await this.prisma.cluster.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description,
        provider: dto.provider,
        region: dto.region,
        environment: dto.environment || 'PRODUCTION',
        connectionMode: 'TOKEN',
        apiEndpoint: dto.apiEndpoint,
        caCertificateBase64: encryptedCaCert,
        token: encryptedToken,
        kubernetesVersion: clusterInfo.kubernetesVersion,
        nodeCount: clusterInfo.nodeCount,
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: 'HEALTHY',
      },
    });

    // Audit log
    await this.logClusterAudit(workspaceId, userId, cluster.id, 'create', 'SUCCESS', null);

    return this.mapClusterToResponse(cluster);
  }

  /**
   * Create cluster from kubeconfig
   */
  async createClusterKubeconfig(
    workspaceId: string,
    userId: string,
    dto: CreateClusterKubeconfigDto,
  ): Promise<ClusterDetailResponseDto> {
    await this.checkWorkspacePermission(workspaceId, userId);

    // Check name uniqueness within workspace
    const existing = await this.prisma.cluster.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: dto.name,
        },
      },
    });

    if (existing) {
      throw new BadRequestException('A cluster with this name already exists in your workspace');
    }

    // Validate base64
    if (!this.encryptionService.isValidBase64(dto.kubeconfigBase64)) {
      throw new BadRequestException('kubeconfigBase64 must be valid base64');
    }

    // Test connectivity before saving
    const credentials = {
      kubeconfigBase64: dto.kubeconfigBase64,
    };

    try {
      await this.k8sClient.testConnection(credentials);
    } catch (error) {
      throw new BadRequestException(`Cluster connectivity test failed: ${error.message}`);
    }

    // Encrypt kubeconfig
    const encryptedKubeconfig = this.encryptionService.encrypt(dto.kubeconfigBase64);

    // Get cluster info
    const clusterInfo = await this.k8sClient.getClusterInfo(credentials);

    const cluster = await this.prisma.cluster.create({
      data: {
        workspaceId,
        name: dto.name,
        description: dto.description,
        provider: dto.provider,
        region: dto.region,
        environment: dto.environment || 'PRODUCTION',
        connectionMode: 'KUBECONFIG',
        kubeconfigBase64: encryptedKubeconfig,
        kubernetesVersion: clusterInfo.kubernetesVersion,
        nodeCount: clusterInfo.nodeCount,
        lastHealthCheckAt: new Date(),
        lastHealthCheckStatus: 'HEALTHY',
      },
    });

    // Audit log
    await this.logClusterAudit(workspaceId, userId, cluster.id, 'create', 'SUCCESS', null);

    return this.mapClusterToResponse(cluster);
  }

  /**
   * Get cluster details
   */
  async getCluster(
    workspaceId: string,
    userId: string,
    clusterId: string,
  ): Promise<ClusterDetailResponseDto> {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    return this.mapClusterToResponse(cluster);
  }

  /**
   * List clusters in workspace
   */
  async listClusters(
    workspaceId: string,
    userId: string,
  ): Promise<ClusterListResponseDto[]> {
    await this.checkWorkspacePermission(workspaceId, userId);

    const clusters = await this.prisma.cluster.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'desc' },
    });

    return clusters.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      environment: c.environment,
      status: c.status,
      nodeCount: c.nodeCount,
      lastHealthCheckAt: c.lastHealthCheckAt,
      lastHealthCheckStatus: c.lastHealthCheckStatus,
      createdAt: c.createdAt,
    }));
  }

  /**
   * Update cluster
   */
  async updateCluster(
    workspaceId: string,
    userId: string,
    clusterId: string,
    dto: UpdateClusterDto,
  ): Promise<ClusterDetailResponseDto> {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    const updateData: any = {};

    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.environment !== undefined) updateData.environment = dto.environment;

    // If updating token credentials
    if (dto.apiEndpoint || dto.caCertificateBase64 || dto.token) {
      if (!dto.apiEndpoint || !dto.caCertificateBase64 || !dto.token) {
        throw new BadRequestException(
          'To update token credentials, provide apiEndpoint, caCertificateBase64, and token',
        );
      }

      // Test connectivity
      const credentials = {
        apiEndpoint: dto.apiEndpoint,
        caCertificateBase64: dto.caCertificateBase64,
        token: dto.token,
      };

      try {
        await this.k8sClient.testConnection(credentials);
      } catch (error) {
        throw new BadRequestException(`Cluster connectivity test failed: ${error.message}`);
      }

      updateData.apiEndpoint = dto.apiEndpoint;
      updateData.caCertificateBase64 = this.encryptionService.encrypt(dto.caCertificateBase64);
      updateData.token = this.encryptionService.encrypt(dto.token);
    }

    // If updating kubeconfig
    if (dto.kubeconfigBase64) {
      if (!this.encryptionService.isValidBase64(dto.kubeconfigBase64)) {
        throw new BadRequestException('kubeconfigBase64 must be valid base64');
      }

      // Test connectivity
      const credentials = { kubeconfigBase64: dto.kubeconfigBase64 };

      try {
        await this.k8sClient.testConnection(credentials);
      } catch (error) {
        throw new BadRequestException(`Cluster connectivity test failed: ${error.message}`);
      }

      updateData.kubeconfigBase64 = this.encryptionService.encrypt(dto.kubeconfigBase64);
    }

    const updated = await this.prisma.cluster.update({
      where: { id: clusterId },
      data: updateData,
    });

    // Audit log
    await this.logClusterAudit(workspaceId, userId, clusterId, 'update', 'SUCCESS', null);

    return this.mapClusterToResponse(updated);
  }

  /**
   * Test cluster connection (backend only, returns minimal info)
   */
  async testConnection(
    workspaceId: string,
    userId: string,
    clusterId: string,
  ): Promise<{ healthy: boolean; message: string }> {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    const credentials = this.getCredentials(cluster);

    try {
      await this.k8sClient.testConnection(credentials);
      
      // Update health status
      await this.prisma.cluster.update({
        where: { id: clusterId },
        data: {
          lastHealthCheckAt: new Date(),
          lastHealthCheckStatus: 'HEALTHY',
          status: 'ACTIVE',
        },
      });

      await this.logClusterAudit(workspaceId, userId, clusterId, 'test_connection', 'SUCCESS', null);

      return {
        healthy: true,
        message: 'Cluster is reachable and healthy',
      };
    } catch (error) {
      // Update health status
      await this.prisma.cluster.update({
        where: { id: clusterId },
        data: {
          lastHealthCheckAt: new Date(),
          lastHealthCheckStatus: error.message,
          status: 'ERROR',
        },
      });

      await this.logClusterAudit(workspaceId, userId, clusterId, 'test_connection', 'ERROR', error.message);

      return {
        healthy: false,
        message: error.message || 'Failed to connect to cluster',
      };
    }
  }

  /**
   * Perform health check on cluster
   */
  async healthCheck(
    workspaceId: string,
    userId: string,
    clusterId: string,
  ): Promise<{ healthy: boolean; kubernetesVersion: string; nodeCount: number }> {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    const credentials = this.getCredentials(cluster);

    try {
      const info = await this.k8sClient.getClusterInfo(credentials);

      // Update health status
      await this.prisma.cluster.update({
        where: { id: clusterId },
        data: {
          kubernetesVersion: info.kubernetesVersion,
          nodeCount: info.nodeCount,
          lastHealthCheckAt: new Date(),
          lastHealthCheckStatus: 'HEALTHY',
          status: 'ACTIVE',
        },
      });

      await this.logClusterAudit(workspaceId, userId, clusterId, 'health_check', 'SUCCESS', null);

      return {
        healthy: true,
        kubernetesVersion: info.kubernetesVersion,
        nodeCount: info.nodeCount,
      };
    } catch (error) {
      // Update health status
      await this.prisma.cluster.update({
        where: { id: clusterId },
        data: {
          lastHealthCheckAt: new Date(),
          lastHealthCheckStatus: error.message,
          status: 'ERROR',
        },
      });

      await this.logClusterAudit(workspaceId, userId, clusterId, 'health_check', 'ERROR', error.message);

      throw error;
    }
  }

  /**
   * Get cluster namespaces
   */
  async getNamespaces(
    workspaceId: string,
    userId: string,
    clusterId: string,
  ): Promise<string[]> {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    const credentials = this.getCredentials(cluster);
    return this.k8sClient.listNamespaces(credentials);
  }

  /**
   * Get cluster nodes
   */
  async getNodes(workspaceId: string, userId: string, clusterId: string) {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    const credentials = this.getCredentials(cluster);
    return this.k8sClient.listNodes(credentials);
  }

  /**
   * Get ingress classes
   */
  async getIngressClasses(
    workspaceId: string,
    userId: string,
    clusterId: string,
  ): Promise<string[]> {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    const credentials = this.getCredentials(cluster);
    return this.k8sClient.listIngressClasses(credentials);
  }

  /**
   * Get storage classes
   */
  async getStorageClasses(
    workspaceId: string,
    userId: string,
    clusterId: string,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    const credentials = this.getCredentials(cluster);
    return this.k8sClient.listStorageClasses(credentials);
  }

  /**
   * Delete cluster
   */
  async deleteCluster(
    workspaceId: string,
    userId: string,
    clusterId: string,
  ): Promise<void> {
    await this.checkWorkspacePermission(workspaceId, userId);

    const cluster = await this.prisma.cluster.findUnique({
      where: { id: clusterId },
    });

    if (!cluster || cluster.workspaceId !== workspaceId) {
      throw new NotFoundException('Cluster not found');
    }

    await this.prisma.cluster.delete({
      where: { id: clusterId },
    });

    await this.logClusterAudit(workspaceId, userId, clusterId, 'delete', 'SUCCESS', null);
  }

  /**
   * Helper: Check workspace permission
   */
  private async checkWorkspacePermission(workspaceId: string, userId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { members: { where: { userId } } },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.ownerId !== userId && workspace.members.length === 0) {
      throw new ForbiddenException('You do not have access to this workspace');
    }
  }

  /**
   * Helper: Get decrypted credentials
   */
  private getCredentials(cluster: any) {
    const credentials: any = {};

    if (cluster.kubeconfigBase64) {
      credentials.kubeconfigBase64 = this.encryptionService.decrypt(cluster.kubeconfigBase64);
    } else {
      if (cluster.apiEndpoint) credentials.apiEndpoint = cluster.apiEndpoint;
      if (cluster.caCertificateBase64) {
        credentials.caCertificateBase64 = this.encryptionService.decrypt(cluster.caCertificateBase64);
      }
      if (cluster.token) {
        credentials.token = this.encryptionService.decrypt(cluster.token);
      }
    }

    return credentials;
  }

  /**
   * Helper: Map cluster to response DTO
   */
  private mapClusterToResponse(cluster: any): ClusterDetailResponseDto {
    return {
      id: cluster.id,
      workspaceId: cluster.workspaceId,
      name: cluster.name,
      description: cluster.description,
      provider: cluster.provider,
      region: cluster.region,
      environment: cluster.environment,
      status: cluster.status,
      connectionMode: cluster.connectionMode,
      kubernetesVersion: cluster.kubernetesVersion,
      nodeCount: cluster.nodeCount,
      lastHealthCheckAt: cluster.lastHealthCheckAt,
      lastHealthCheckStatus: cluster.lastHealthCheckStatus,
      createdAt: cluster.createdAt,
      updatedAt: cluster.updatedAt,
    };
  }

  /**
   * Helper: Log cluster audit event
   */
  private async logClusterAudit(
    workspaceId: string,
    userId: string,
    clusterId: string,
    action: string,
    result: string,
    details: string | null,
  ): Promise<void> {
    try {
      await this.prisma.clusterAuditLog.create({
        data: {
          clusterId,
          workspaceId,
          userId: userId || undefined,
          action,
          result,
          details: details ? JSON.stringify({ error: details }) : null,
        },
      });
    } catch (error) {
      // Log audit failure but don't throw
      console.error('Failed to log cluster audit:', error);
    }
  }
}
