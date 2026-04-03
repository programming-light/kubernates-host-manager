import { Injectable, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bull';
import { PrismaService } from '../../common/prisma.service';
import { KubernetesClientService } from '../clusters/kubernetes-client.service';
import { PlanLimitService } from '../billing/plan-limit.service';
import { CreateProjectDto, UpdateProjectDto, DeployFromDockerImageDto, CreateEnvironmentVariableDto } from './dto/deployment.dto';

@Injectable()
export class DeploymentOrchestrationService {
  constructor(
    private prisma: PrismaService,
    private k8sClient: KubernetesClientService,
    private planLimitService: PlanLimitService,
    @InjectQueue('deployments') private deploymentQueue: Queue,
  ) {}

  /**
   * Create a new project
   */
  async createProject(
    workspaceId: string,
    userId: string,
    dto: CreateProjectDto,
  ) {
    // Check workspace permission
    await this.checkWorkspacePermission(workspaceId, userId);

    // Check plan limits
    const limits = await this.planLimitService.getWorkspacePlanLimits(workspaceId);
    const existingApps = await this.prisma.project.count({
      where: { workspaceId },
    });

    if (existingApps >= limits.maxApps) {
      throw new BadRequestException(
        `You have reached the maximum number of projects (${limits.maxApps}) for your plan`,
      );
    }

    // Validate cluster access
    const cluster = await this.prisma.cluster.findFirst({
      where: { id: dto.clusterId, workspaceId },
    });

    if (!cluster) {
      throw new NotFoundException('Cluster not found or not accessible');
    }

    // Validate that either imageUrl or gitUrl is provided
    if (!dto.imageUrl && !dto.gitUrl) {
      throw new BadRequestException('Either imageUrl or gitUrl must be provided');
    }

    // Create namespace name
    const namespace = `${workspaceId.substring(0, 8)}-${dto.slug}`.toLowerCase();

    // Create project
    const project = await this.prisma.project.create({
      data: {
        workspaceId,
        clusterId: dto.clusterId,
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        namespace,
        imageUrl: dto.imageUrl,
        imagePullSecret: dto.imagePullSecret,
        gitUrl: dto.gitUrl,
        gitBranch: dto.gitBranch || 'main',
        buildCommand: dto.buildCommand,
        startCommand: dto.startCommand,
        containerPort: dto.containerPort || 3000,
        cpuRequest: dto.cpuRequest || 0.1,
        cpuLimit: dto.cpuLimit || 0.5,
        memoryRequest: dto.memoryRequest || 128,
        memoryLimit: dto.memoryLimit || 512,
        storageGb: dto.storageGb || 0,
        replicas: dto.replicas || 1,
        minReplicas: dto.minReplicas || 1,
        maxReplicas: dto.maxReplicas || 5,
        autoscale: dto.autoscale || false,
        cpuThreshold: dto.cpuThreshold || 70,
        healthCheckEnabled: dto.healthCheckEnabled !== false,
        healthCheckPath: dto.healthCheckPath || '/health',
        healthCheckInterval: dto.healthCheckInterval || 10,
        healthCheckTimeout: dto.healthCheckTimeout || 5,
      },
    });

    // Create K8s namespace
    try {
      const credentials = await this.getClusterCredentials(cluster);
      await this.k8sClient.createNamespace(credentials, namespace);
    } catch (error) {
      // Log error but continue - namespace might already exist
      console.error('Failed to create namespace:', error);
    }

    // Audit log
    await this.logDeploymentEvent(project.id, 'project.created', `Project ${project.name} created`, {
      creator: userId,
    });

    return project;
  }

  /**
   * Update project configuration
   */
  async updateProject(
    workspaceId: string,
    userId: string,
    projectId: string,
    dto: UpdateProjectDto,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    const project = await this.getProjectInWorkspace(projectId, workspaceId);

    const updateData: any = {};
    if (dto.description !== undefined) updateData.description = dto.description;
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
    if (dto.gitBranch !== undefined) updateData.gitBranch = dto.gitBranch;
    if (dto.buildCommand !== undefined) updateData.buildCommand = dto.buildCommand;
    if (dto.startCommand !== undefined) updateData.startCommand = dto.startCommand;
    if (dto.containerPort !== undefined) updateData.containerPort = dto.containerPort;
    if (dto.cpuRequest !== undefined) updateData.cpuRequest = dto.cpuRequest;
    if (dto.cpuLimit !== undefined) updateData.cpuLimit = dto.cpuLimit;
    if (dto.memoryRequest !== undefined) updateData.memoryRequest = dto.memoryRequest;
    if (dto.memoryLimit !== undefined) updateData.memoryLimit = dto.memoryLimit;
    if (dto.replicas !== undefined) updateData.replicas = dto.replicas;
    if (dto.autoscale !== undefined) updateData.autoscale = dto.autoscale;
    if (dto.minReplicas !== undefined) updateData.minReplicas = dto.minReplicas;
    if (dto.maxReplicas !== undefined) updateData.maxReplicas = dto.maxReplicas;
    if (dto.healthCheckPath !== undefined) updateData.healthCheckPath = dto.healthCheckPath;

    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: updateData,
    });

    await this.logDeploymentEvent(projectId, 'project.updated', 'Project configuration updated', {
      updatedBy: userId,
      changes: updateData,
    });

    return updated;
  }

  /**
   * Deploy from Docker image
   */
  async deployFromDockerImage(
    workspaceId: string,
    userId: string,
    projectId: string,
    dto: DeployFromDockerImageDto,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    const project = await this.getProjectInWorkspace(projectId, workspaceId);

    // Check plan limits
    const limits = await this.planLimitService.getWorkspacePlanLimits(workspaceId);
    if (!limits.autoscalingEnabled && project.autoscale) {
      throw new BadRequestException('Autoscaling not enabled in your plan');
    }

    // Create deployment record
    const lastDeployment = await this.prisma.deployment.findFirst({
      where: { projectId },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });

    const nextRevision = (lastDeployment?.revision || 0) + 1;

    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        revision: nextRevision,
        status: 'PENDING',
        imageUrl: dto.imageUrl,
        deploymentSource: 'DOCKER_IMAGE',
        deployedBy: userId,
        imagePullPolicy: 'IfNotPresent',
      },
    });

    // Queue deployment job
    await this.deploymentQueue.add(
      'deploy-docker-image',
      {
        deploymentId: deployment.id,
        projectId,
        imageUrl: dto.imageUrl,
        imagePullSecret: project.imagePullSecret,
        namespace: project.namespace,
        clusterId: project.clusterId,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    await this.logDeploymentEvent(projectId, 'deployment.queued', 'Deployment queued', {
      deploymentId: deployment.id,
      imageUrl: dto.imageUrl,
    });

    return deployment;
  }

  /**
   * Deploy from Git repository
   */
  async deployFromGit(
    workspaceId: string,
    userId: string,
    projectId: string,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    const project = await this.getProjectInWorkspace(projectId, workspaceId);

    if (!project.gitUrl) {
      throw new BadRequestException('Project does not have a git repository configured');
    }

    // Create deployment record
    const lastDeployment = await this.prisma.deployment.findFirst({
      where: { projectId },
      orderBy: { revision: 'desc' },
      select: { revision: true },
    });

    const nextRevision = (lastDeployment?.revision || 0) + 1;

    const deployment = await this.prisma.deployment.create({
      data: {
        projectId,
        revision: nextRevision,
        status: 'PENDING',
        deploymentSource: 'GIT_REPOSITORY',
        deployedBy: userId,
      },
    });

    // Queue build job
    await this.deploymentQueue.add(
      'deploy-from-git',
      {
        deploymentId: deployment.id,
        projectId,
        gitUrl: project.gitUrl,
        gitBranch: project.gitBranch,
        buildCommand: project.buildCommand,
        namespace: project.namespace,
        clusterId: project.clusterId,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    await this.logDeploymentEvent(projectId, 'deployment.queued', 'Git deployment queued', {
      deploymentId: deployment.id,
      gitUrl: project.gitUrl,
    });

    return deployment;
  }

  /**
   * Get project deployment history
   */
  async getDeploymentHistory(
    workspaceId: string,
    userId: string,
    projectId: string,
    limit: number = 10,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    await this.getProjectInWorkspace(projectId, workspaceId);

    return this.prisma.deployment.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });
  }

  /**
   * Get deployment details
   */
  async getDeployment(
    workspaceId: string,
    userId: string,
    projectId: string,
    deploymentId: string,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    await this.getProjectInWorkspace(projectId, workspaceId);

    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: {
        events: { orderBy: { createdAt: 'desc' } },
        jobs: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!deployment || deployment.projectId !== projectId) {
      throw new NotFoundException('Deployment not found');
    }

    return deployment;
  }

  /**
   * Restart deployment with current image
   */
  async restartDeployment(
    workspaceId: string,
    userId: string,
    projectId: string,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    const project = await this.getProjectInWorkspace(projectId, workspaceId);

    // Get latest deployment
    const latestDeployment = await this.prisma.deployment.findFirst({
      where: { projectId, status: 'RUNNING' },
      orderBy: { createdAt: 'desc' },
    });

    if (!latestDeployment) {
      throw new BadRequestException('No running deployment found');
    }

    // Queue restart job
    await this.deploymentQueue.add(
      'restart-deployment',
      {
        deploymentId: latestDeployment.id,
        projectId,
        namespace: project.namespace,
        clusterId: project.clusterId,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    await this.logDeploymentEvent(projectId, 'deployment.restarted', 'Deployment restart queued', {
      deploymentId: latestDeployment.id,
    });

    return latestDeployment;
  }

  /**
   * Scale deployment
   */
  async scaleDeployment(
    workspaceId: string,
    userId: string,
    projectId: string,
    replicas: number,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    const project = await this.getProjectInWorkspace(projectId, workspaceId);

    // Validate replicas
    if (replicas < 1 || replicas > 100) {
      throw new BadRequestException('Replicas must be between 1 and 100');
    }

    // Update project
    const updated = await this.prisma.project.update({
      where: { id: projectId },
      data: { replicas },
    });

    // Queue scale job
    await this.deploymentQueue.add(
      'scale-deployment',
      {
        projectId,
        namespace: project.namespace,
        clusterId: project.clusterId,
        replicas,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    await this.logDeploymentEvent(projectId, 'deployment.scaled', `Scaled to ${replicas} replicas`, {
      replicas,
    });

    return updated;
  }

  /**
   * Stop deployment
   */
  async stopDeployment(
    workspaceId: string,
    userId: string,
    projectId: string,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    const project = await this.getProjectInWorkspace(projectId, workspaceId);

    // Queue stop job
    await this.deploymentQueue.add(
      'stop-deployment',
      {
        projectId,
        namespace: project.namespace,
        clusterId: project.clusterId,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    // Update project status
    await this.prisma.project.update({
      where: { id: projectId },
      data: { status: 'ARCHIVED' },
    });

    await this.logDeploymentEvent(projectId, 'deployment.stopped', 'Deployment stopped', {
      stoppedBy: userId,
    });

    return { message: 'Deployment stop queued' };
  }

  /**
   * Delete project
   */
  async deleteProject(
    workspaceId: string,
    userId: string,
    projectId: string,
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    const project = await this.getProjectInWorkspace(projectId, workspaceId);

    // Queue delete job
    await this.deploymentQueue.add(
      'delete-project',
      {
        projectId,
        namespace: project.namespace,
        clusterId: project.clusterId,
      },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    // Delete from database
    await this.prisma.project.delete({
      where: { id: projectId },
    });

    await this.logDeploymentEvent(projectId, 'project.deleted', 'Project deleted', {
      deletedBy: userId,
    });

    return { message: 'Project deletion queued' };
  }

  /**
   * Set environment variables
   */
  async setEnvironmentVariables(
    workspaceId: string,
    userId: string,
    projectId: string,
    variables: CreateEnvironmentVariableDto[],
  ) {
    await this.checkWorkspacePermission(workspaceId, userId);
    await this.getProjectInWorkspace(projectId, workspaceId);

    // Delete existing and create new
    await this.prisma.projectEnvironmentVariable.deleteMany({
      where: { projectId },
    });

    const created = await Promise.all(
      variables.map((v) =>
        this.prisma.projectEnvironmentVariable.create({
          data: {
            projectId,
            key: v.key,
            value: v.value,
            isSecret: v.isSecret || false,
          },
        }),
      ),
    );

    // Queue redeploy
    await this.deploymentQueue.add(
      'redeploy-with-env',
      { projectId },
      { attempts: 3, backoff: { type: 'exponential', delay: 2000 } },
    );

    await this.logDeploymentEvent(projectId, 'env.updated', 'Environment variables updated', {
      count: variables.length,
    });

    return created;
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
   * Helper: Get project in workspace
   */
  private async getProjectInWorkspace(projectId: string, workspaceId: string) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || project.workspaceId !== workspaceId) {
      throw new NotFoundException('Project not found');
    }

    return project;
  }

  /**
   * Helper: Get cluster credentials
   */
  private async getClusterCredentials(cluster: any) {
    // Implement credential retrieval from cluster (decrypted)
    return {
      apiEndpoint: cluster.apiEndpoint,
      caCertificateBase64: cluster.caCertificateBase64,
      token: cluster.token,
    };
  }

  /**
   * Helper: Log deployment event
   */
  private async logDeploymentEvent(
    projectId: string,
    type: string,
    message: string,
    metadata?: any,
  ) {
    try {
      const latestDeployment = await this.prisma.deployment.findFirst({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      if (latestDeployment) {
        await this.prisma.deploymentEvent.create({
          data: {
            projectId,
            deploymentId: latestDeployment.id,
            type,
            message,
            metadata: metadata ? JSON.stringify(metadata) : null,
          },
        });
      }
    } catch (error) {
      console.error('Failed to log deployment event:', error);
    }
  }
}
