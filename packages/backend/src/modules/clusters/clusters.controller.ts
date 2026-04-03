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
import { ClustersService } from './clusters.service';
import {
  CreateClusterTokenDto,
  CreateClusterKubeconfigDto,
  UpdateClusterDto,
  TestClusterConnectionDto,
  ClusterHealthCheckDto,
} from './dto/cluster.dto';

@Controller('workspaces/:workspaceId/clusters')
@UseGuards(JwtAuthGuard)
export class ClustersController {
  constructor(private clustersService: ClustersService) {}

  /**
   * Create cluster with token credentials
   */
  @Post('token')
  async createToken(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
    @Body() dto: CreateClusterTokenDto,
  ) {
    return this.clustersService.createClusterToken(workspaceId, req.user.sub, dto);
  }

  /**
   * Create cluster with kubeconfig
   */
  @Post('kubeconfig')
  async createKubeconfig(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
    @Body() dto: CreateClusterKubeconfigDto,
  ) {
    return this.clustersService.createClusterKubeconfig(workspaceId, req.user.sub, dto);
  }

  /**
   * List clusters in workspace
   */
  @Get()
  async list(
    @Param('workspaceId') workspaceId: string,
    @Req() req: any,
  ) {
    return this.clustersService.listClusters(workspaceId, req.user.sub);
  }

  /**
   * Get cluster details
   */
  @Get(':clusterId')
  async get(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
  ) {
    return this.clustersService.getCluster(workspaceId, req.user.sub, clusterId);
  }

  /**
   * Update cluster
   */
  @Put(':clusterId')
  async update(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
    @Body() dto: UpdateClusterDto,
  ) {
    return this.clustersService.updateCluster(workspaceId, req.user.sub, clusterId, dto);
  }

  /**
   * Test cluster connection (backend-only endpoint)
   * Returns: { healthy: boolean, message: string }
   */
  @Post(':clusterId/test')
  async testConnection(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
  ) {
    return this.clustersService.testConnection(workspaceId, req.user.sub, clusterId);
  }

  /**
   * Health check cluster
   */
  @Post(':clusterId/health')
  async healthCheck(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
  ) {
    return this.clustersService.healthCheck(workspaceId, req.user.sub, clusterId);
  }

  /**
   * Get cluster namespaces
   */
  @Get(':clusterId/namespaces')
  async getNamespaces(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
  ) {
    const namespaces = await this.clustersService.getNamespaces(workspaceId, req.user.sub, clusterId);
    return { namespaces };
  }

  /**
   * Get cluster nodes
   */
  @Get(':clusterId/nodes')
  async getNodes(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
  ) {
    const nodes = await this.clustersService.getNodes(workspaceId, req.user.sub, clusterId);
    return { nodes };
  }

  /**
   * Get ingress classes
   */
  @Get(':clusterId/ingress-classes')
  async getIngressClasses(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
  ) {
    const ingressClasses = await this.clustersService.getIngressClasses(
      workspaceId,
      req.user.sub,
      clusterId,
    );
    return { ingressClasses };
  }

  /**
   * Get storage classes
   */
  @Get(':clusterId/storage-classes')
  async getStorageClasses(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
  ) {
    const storageClasses = await this.clustersService.getStorageClasses(
      workspaceId,
      req.user.sub,
      clusterId,
    );
    return { storageClasses };
  }

  /**
   * Delete cluster
   */
  @Delete(':clusterId')
  async delete(
    @Param('workspaceId') workspaceId: string,
    @Param('clusterId') clusterId: string,
    @Req() req: any,
  ) {
    await this.clustersService.deleteCluster(workspaceId, req.user.sub, clusterId);
    return { message: 'Cluster deleted successfully' };
  }
}
