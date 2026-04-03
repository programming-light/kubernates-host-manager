import { Process, Processor } from '@nestjs/bull';
import { Job } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { KubernetesClientService } from '../clusters/kubernetes-client.service';
import * as k8s from '@kubernetes/client-node';

@Processor('deployments')
@Injectable()
export class DeploymentProcessor {
  constructor(
    private prisma: PrismaService,
    private k8sClient: KubernetesClientService,
  ) {}

  @Process('deploy-docker-image')
  async handleDockerImageDeployment(job: Job) {
    const { deploymentId, projectId, imageUrl, imagePullSecret, namespace, clusterId } = job.data;

    try {
      // Update deployment status
      await this.updateDeploymentStatus(deploymentId, 'DEPLOYING');

      // Get project and cluster
      const [project, cluster] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.cluster.findUnique({ where: { id: clusterId } }),
      ]);

      if (!project || !cluster) {
        throw new Error('Project or cluster not found');
      }

      // Get environment variables
      const envVars = await this.prisma.projectEnvironmentVariable.findMany({
        where: { projectId },
      });

      // Create K8s Deployment
      const deployment = this.createKubernetesDeployment({
        name: project.slug,
        namespace,
        imageUrl,
        imagePullSecret,
        replicas: project.replicas,
        cpuRequest: project.cpuRequest,
        cpuLimit: project.cpuLimit,
        memoryRequest: project.memoryRequest,
        memoryLimit: project.memoryLimit,
        containerPort: project.containerPort,
        startCommand: project.startCommand,
        environment: envVars,
      });

      // Deploy to cluster
      const credentials = await this.getClusterCredentials(cluster);
      await this.k8sClient.createOrUpdateDeployment(credentials, deployment);

      // Create K8s Service
      const service = this.createKubernetesService({
        name: project.slug,
        namespace,
        port: project.containerPort,
      });

      await this.k8sClient.createOrUpdateService(credentials, service);

      // Create K8s ConfigMap for environment variables
      if (envVars.length > 0) {
        const configMap = this.createConfigMap({
          name: `${project.slug}-env`,
          namespace,
          data: envVars.reduce((acc, v) => {
            acc[v.key] = v.value;
            return acc;
          }, {}),
        });

        await this.k8sClient.createOrUpdateConfigMap(credentials, configMap);
      }

      // Create Ingress if needed
      // (Will be implemented based on domain configuration)

      // Update deployment status to PROVISIONING
      await this.updateDeploymentStatus(deploymentId, 'PROVISIONING');

      // Wait for pods to be ready
      await this.waitForPodsReady(credentials, namespace, project.slug, 300000); // 5 min timeout

      // Update deployment status to RUNNING
      await this.updateDeploymentStatus(deploymentId, 'RUNNING');

      await this.logDeploymentEvent(
        deploymentId,
        'deployment.completed',
        `Successfully deployed image ${imageUrl}`,
      );

      return { success: true, deploymentId };
    } catch (error) {
      await this.updateDeploymentStatus(deploymentId, 'FAILED');
      await this.logDeploymentEvent(deploymentId, 'deployment.failed', error.message);
      throw error;
    }
  }

  @Process('deploy-from-git')
  async handleGitDeployment(job: Job) {
    const { deploymentId, projectId, gitUrl, gitBranch, buildCommand, namespace, clusterId } = job.data;

    try {
      await this.updateDeploymentStatus(deploymentId, 'BUILDING');

      // Get project and cluster
      const [project, cluster] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.cluster.findUnique({ where: { id: clusterId } }),
      ]);

      if (!project || !cluster) {
        throw new Error('Project or cluster not found');
      }

      // Build Docker image
      const builtImageUrl = await this.buildDockerImage({
        gitUrl,
        gitBranch,
        buildCommand: buildCommand || 'docker build -t {image} .',
        projectId,
      });

      // Update deployment with image URL
      await this.prisma.deployment.update({
        where: { id: deploymentId },
        data: { imageUrl: builtImageUrl },
      });

      // Continue with Docker deployment flow
      // (Reuse the same deployment logic as docker-image)

      await this.updateDeploymentStatus(deploymentId, 'DEPLOYING');

      const credentials = await this.getClusterCredentials(cluster);

      // Get environment variables
      const envVars = await this.prisma.projectEnvironmentVariable.findMany({
        where: { projectId },
      });

      // Create deployment
      const deployment = this.createKubernetesDeployment({
        name: project.slug,
        namespace,
        imageUrl: builtImageUrl,
        replicas: project.replicas,
        cpuRequest: project.cpuRequest,
        cpuLimit: project.cpuLimit,
        memoryRequest: project.memoryRequest,
        memoryLimit: project.memoryLimit,
        containerPort: project.containerPort,
        startCommand: project.startCommand,
        environment: envVars,
      });

      await this.k8sClient.createOrUpdateDeployment(credentials, deployment);

      // Create service
      const service = this.createKubernetesService({
        name: project.slug,
        namespace,
        port: project.containerPort,
      });

      await this.k8sClient.createOrUpdateService(credentials, service);

      // Wait for pods ready
      await this.updateDeploymentStatus(deploymentId, 'PROVISIONING');
      await this.waitForPodsReady(credentials, namespace, project.slug, 300000);

      await this.updateDeploymentStatus(deploymentId, 'RUNNING');
      await this.logDeploymentEvent(
        deploymentId,
        'deployment.completed',
        `Successfully deployed from ${gitUrl}`,
      );

      return { success: true, deploymentId };
    } catch (error) {
      await this.updateDeploymentStatus(deploymentId, 'FAILED');
      await this.logDeploymentEvent(deploymentId, 'deployment.failed', error.message);
      throw error;
    }
  }

  @Process('restart-deployment')
  async handleRestartDeployment(job: Job) {
    const { deploymentId, projectId, namespace, clusterId } = job.data;

    try {
      const [project, cluster] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.cluster.findUnique({ where: { id: clusterId } }),
      ]);

      const credentials = await this.getClusterCredentials(cluster);
      await this.k8sClient.rolloutRestart(credentials, namespace, project.slug);

      await this.logDeploymentEvent(deploymentId, 'deployment.restarted', 'Deployment restarted');
      return { success: true };
    } catch (error) {
      await this.logDeploymentEvent(deploymentId, 'deployment.restart_failed', error.message);
      throw error;
    }
  }

  @Process('scale-deployment')
  async handleScaleDeployment(job: Job) {
    const { projectId, namespace, clusterId, replicas } = job.data;

    try {
      const [project, cluster] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.cluster.findUnique({ where: { id: clusterId } }),
      ]);

      const credentials = await this.getClusterCredentials(cluster);
      await this.k8sClient.scaleDeployment(credentials, namespace, project.slug, replicas);

      return { success: true };
    } catch (error) {
      console.error('Scale deployment failed:', error);
      throw error;
    }
  }

  @Process('stop-deployment')
  async handleStopDeployment(job: Job) {
    const { projectId, namespace, clusterId } = job.data;

    try {
      const [project, cluster] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId } }),
        this.prisma.cluster.findUnique({ where: { id: clusterId } }),
      ]);

      const credentials = await this.getClusterCredentials(cluster);
      await this.k8sClient.deleteDeployment(credentials, namespace, project.slug);

      return { success: true };
    } catch (error) {
      console.error('Stop deployment failed:', error);
      throw error;
    }
  }

  @Process('delete-project')
  async handleDeleteProject(job: Job) {
    const { projectId, namespace, clusterId } = job.data;

    try {
      const cluster = await this.prisma.cluster.findUnique({ where: { id: clusterId } });
      const credentials = await this.getClusterCredentials(cluster);

      // Delete entire namespace
      await this.k8sClient.deleteNamespace(credentials, namespace);

      return { success: true };
    } catch (error) {
      console.error('Delete project failed:', error);
      throw error;
    }
  }

  @Process('redeploy-with-env')
  async handleRedeployWithEnv(job: Job) {
    const { projectId } = job.data;

    try {
      const project = await this.prisma.project.findUnique({ where: { id: projectId } });
      const deployment = await this.prisma.deployment.findFirst({
        where: { projectId, status: 'RUNNING' },
        orderBy: { createdAt: 'desc' },
      });

      if (!deployment) {
        throw new Error('No running deployment found');
      }

      // Restart to pick up new environment variables
      await this.prisma.deploymentEvent.create({
        data: {
          projectId,
          deploymentId: deployment.id,
          type: 'env.redeploying',
          message: 'Redeploying with updated environment variables',
        },
      });

      // Queue restart
      return { success: true, deploymentId: deployment.id };
    } catch (error) {
      console.error('Redeploy with env failed:', error);
      throw error;
    }
  }

  // ===== Helper Methods =====

  private createKubernetesDeployment(opts: any): k8s.V1Deployment {
    const envVars = opts.environment.map((v: any) => ({
      name: v.key,
      value: v.value,
    }));

    if (opts.startCommand) {
      envVars.push({
        name: 'START_COMMAND',
        value: opts.startCommand,
      });
    }

    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: opts.name,
        namespace: opts.namespace,
      },
      spec: {
        replicas: opts.replicas,
        selector: {
          matchLabels: {
            app: opts.name,
          },
        },
        template: {
          metadata: {
            labels: {
              app: opts.name,
            },
          },
          spec: {
            containers: [
              {
                name: opts.name,
                image: opts.imageUrl,
                imagePullPolicy: 'IfNotPresent',
                ports: [{ containerPort: opts.containerPort }],
                env: envVars,
                resources: {
                  requests: {
                    cpu: `${opts.cpuRequest}m`,
                    memory: `${opts.memoryRequest}Mi`,
                  },
                  limits: {
                    cpu: `${opts.cpuLimit}m`,
                    memory: `${opts.memoryLimit}Mi`,
                  },
                },
              },
            ],
          },
        },
      },
    };
  }

  private createKubernetesService(opts: any): k8s.V1Service {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: opts.name,
        namespace: opts.namespace,
      },
      spec: {
        selector: {
          app: opts.name,
        },
        ports: [
          {
            port: 80,
            targetPort: opts.port,
          },
        ],
        type: 'ClusterIP',
      },
    };
  }

  private createConfigMap(opts: any) {
    return {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: opts.name,
        namespace: opts.namespace,
      },
      data: opts.data,
    };
  }

  private async buildDockerImage(opts: any): Promise<string> {
    // Implement Docker build logic
    // This would typically clone the repo, build, and push to registry
    return `${opts.projectId}:latest`;
  }

  private async waitForPodsReady(
    credentials: any,
    namespace: string,
    appName: string,
    timeoutMs: number,
  ) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const pods = await this.k8sClient.listPods(credentials, namespace, appName);
        if (pods.every((p: any) => p.status?.phase === 'Running')) {
          return;
        }
      } catch (error) {
        console.error('Error checking pod status:', error);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    throw new Error('Pods did not become ready within timeout');
  }

  private async getClusterCredentials(cluster: any) {
    // Implement credential retrieval
    return {
      apiEndpoint: cluster.apiEndpoint,
      caCertificateBase64: cluster.caCertificateBase64,
      token: cluster.token,
    };
  }

  private async updateDeploymentStatus(deploymentId: string, status: string) {
    await this.prisma.deployment.update({
      where: { id: deploymentId },
      data: { status },
    });
  }

  private async logDeploymentEvent(deploymentId: string, type: string, message: string) {
    const deployment = await this.prisma.deployment.findUnique({
      where: { id: deploymentId },
      select: { projectId: true },
    });

    if (deployment) {
      await this.prisma.deploymentEvent.create({
        data: {
          projectId: deployment.projectId,
          deploymentId,
          type,
          message,
        },
      });
    }
  }
}
