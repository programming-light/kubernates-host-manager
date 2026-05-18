import * as k8s from '@kubernetes/client-node';
import prisma from './prisma.js';
import log from './logger.js';
import { k8sConfigManager } from './k8s-config.js';
import { emitK8sEvent } from './socket.js';

export interface DeployConfig {
  image: string;
  tag?: string;
  port?: number;
  replicas?: number;
  env?: Array<{ name: string; value: string }>;
  resources?: {
    limits?: { cpu: string; memory: string };
    requests?: { cpu: string; memory: string };
  };
  domain?: string;
  healthCheck?: {
    path: string;
    port: number;
  };
}

export interface EnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
}

export interface EnvFile {
  [key: string]: EnvVar;
}

export class K8sDeployManager {
  private get appsApi() { return k8sConfigManager.appsApi; }
  private get coreApi() { return k8sConfigManager.coreApi; }
  private get networkingApi() { return k8sConfigManager.networkingApi; }
  private get batchApi() { return k8sConfigManager.batchApi; }

  private getDefaultDomainSuffix(): string {
    return process.env.DEFAULT_DOMAIN_SUFFIX || 'k8s-host.preview';
  }

  private async ensureDefaultDomain(projectId: string, slug: string, namespace: string): Promise<string> {
    const existing = await prisma.domain.findFirst({
      where: { projectId, isPrimary: true },
    });
    if (existing) return existing.domain;

    const anyDomain = await prisma.domain.findFirst({
      where: { projectId },
    });
    if (anyDomain) return anyDomain.domain;

    const suffix = this.getDefaultDomainSuffix();
    const previewDomain = `${slug}.${suffix}`;

    await prisma.domain.create({
      data: {
        projectId,
        domain: previewDomain,
        isPrimary: true,
        isCustom: false,
        sslEnabled: false,
        status: 'active',
      },
    });

    return previewDomain;
  }

  async deployProject(
    projectId: string,
    namespace: string,
    config: DeployConfig
  ): Promise<{ deployment: any; service: any; ingress?: any }> {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { domains: true, workspace: true, user: true },
    });

    if (!project) throw new Error('Project not found');

    const userPrefix = project.user?.email
      ? project.user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20)
      : project.userId.slice(0, 8);
    const imageTag = config.tag || 'latest';
    const fullImage = `${config.image}:${imageTag}`;
    const appLabel = `app-${userPrefix}-${project.slug}`;
    const port = config.port || 80;
    const replicas = config.replicas || project.replicas || 1;

    const secretMap = new Map<string, string>();

    // Fetch all env vars from K8s Secrets (all stored as Secrets for security)
    try {
      const envFile = await this.getProjectEnvVars(namespace, project.slug);
      for (const [, v] of Object.entries(envFile)) {
        secretMap.set(v.key, v.value);
      }

      const workspaceEnvFile = await this.getWorkspaceEnvVars(namespace, project.workspaceId);
      for (const [, v] of Object.entries(workspaceEnvFile)) {
        secretMap.set(v.key, v.value);
      }
    } catch (e) {
      log.warn('Failed to fetch env vars from K8s, continuing without them');
    }

    if (config.env) {
      for (const e of config.env) {
        secretMap.set(e.name, e.value);
      }
    }

    const secretVars = Array.from(secretMap.entries()).map(([name]) => ({
      name,
      valueFrom: {
        secretKeyRef: {
          name: `${appLabel}-secrets`,
          key: name,
        },
      },
    }));

    await this.createOrUpdateSecret(namespace, appLabel, secretMap);

    const deployment = await this.createOrUpdateDeployment(
      namespace,
      appLabel,
      fullImage,
      port,
      replicas,
      secretVars,
      config.resources,
      config.healthCheck
    );

    const service = await this.createOrUpdateService(
      namespace,
      appLabel,
      port
    );

    let ingress;
    let domain = config.domain;
    const primaryDomain = project.domains.find(d => d.isPrimary) || project.domains[0];

    if (!domain) {
      if (primaryDomain) {
        domain = primaryDomain.domain;
      } else {
        domain = await this.ensureDefaultDomain(projectId, project.slug, namespace);
      }
    }

    if (domain) {
      ingress = await this.createOrUpdateIngress(
        namespace,
        appLabel,
        domain,
        service.metadata!.name!,
        port
      );
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { currentImageTag: imageTag },
    });

    return { deployment, service, ingress };
  }

  private async createOrUpdateConfigMap(
    namespace: string,
    appLabel: string,
    envMap: Map<string, string>
  ): Promise<void> {
    if (envMap.size === 0) return;

    const configMapName = `${appLabel}-config`;
    const data: Record<string, string> = {};
    envMap.forEach((value, key) => {
      data[key] = value;
    });

    const configMap: k8s.V1ConfigMap = {
      metadata: {
        name: configMapName,
        namespace,
      },
      data,
    };

    try {
      await this.coreApi.replaceNamespacedConfigMap(configMapName, namespace, configMap);
    } catch {
      await this.coreApi.createNamespacedConfigMap(namespace, configMap);
    }
  }

  async createOrUpdateSecret(
    namespace: string,
    appLabel: string,
    secretMap: Map<string, string>
  ): Promise<void> {
    if (secretMap.size === 0) return;

    const secretName = `${appLabel}-secrets`;
    const data: Record<string, string> = {};
    secretMap.forEach((value, key) => {
      data[key] = Buffer.from(value).toString('base64');
    });

    const secret: k8s.V1Secret = {
      metadata: {
        name: secretName,
        namespace,
      },
      type: 'Opaque',
      data,
    };

    try {
      await this.coreApi.replaceNamespacedSecret(secretName, namespace, secret);
    } catch {
      await this.coreApi.createNamespacedSecret(namespace, secret);
    }
  }

  /**
   * Get project-level env vars from K8s (stored as Secrets for security)
   */
  async getProjectEnvVars(namespace: string, appLabel: string): Promise<EnvFile> {
    const envFile: EnvFile = {};

    try {
      const secret = await this.coreApi.readNamespacedSecret(`${appLabel}-secrets`, namespace);
      if (secret.body.data) {
        for (const [key, value] of Object.entries(secret.body.data)) {
          const decoded = Buffer.from(value as string, 'base64').toString('utf-8');
          envFile[key] = { key, value: decoded, isSecret: true };
        }
      }
    } catch {
      // Secret might not exist yet
    }

    return envFile;
  }

  /**
   * Set project-level env vars in K8s (ALL stored as Secrets for security)
   */
  async setProjectEnvVars(namespace: string, appLabel: string, envFile: EnvFile): Promise<void> {
    const secretMap = new Map<string, string>();

    for (const [, v] of Object.entries(envFile)) {
      secretMap.set(v.key, v.value);
    }

    await this.createOrUpdateSecret(namespace, appLabel, secretMap);
  }

  /**
   * Get workspace-level shared env vars (stored as Secrets for security)
   */
  async getWorkspaceEnvVars(namespace: string, workspaceId: string): Promise<EnvFile> {
    const appLabel = `workspace-${workspaceId}`;
    const envFile: EnvFile = {};

    try {
      const secret = await this.coreApi.readNamespacedSecret(`${appLabel}-secrets`, namespace);
      if (secret.body.data) {
        for (const [key, value] of Object.entries(secret.body.data)) {
          const decoded = Buffer.from(value as string, 'base64').toString('utf-8');
          envFile[key] = { key, value: decoded, isSecret: true };
        }
      }
    } catch {
      // Secret might not exist yet
    }

    return envFile;
  }

  /**
   * Set workspace-level shared env vars (ALL stored as Secrets for security)
   */
  async setWorkspaceEnvVars(namespace: string, workspaceId: string, envFile: EnvFile): Promise<void> {
    const appLabel = `workspace-${workspaceId}`;
    const secretMap = new Map<string, string>();

    for (const [, v] of Object.entries(envFile)) {
      secretMap.set(v.key, v.value);
    }

    await this.createOrUpdateSecret(namespace, appLabel, secretMap);
  }

  async createOrUpdateProjectConfig(
    namespace: string,
    appLabel: string,
    config: { branch: string; buildCommand?: string | null; runCommand?: string | null; rootDir?: string | null }
  ): Promise<void> {
    const secretName = `${appLabel}-project-config`;
    const data: Record<string, string> = {
      branch: config.branch,
    };
    if (config.buildCommand) data.buildCommand = config.buildCommand;
    if (config.runCommand) data.runCommand = config.runCommand;
    if (config.rootDir) data.rootDir = config.rootDir;

    const secret: k8s.V1Secret = {
      metadata: { name: secretName, namespace, labels: { 'managed-by': 'k8s-platform', type: 'project-config' } },
      type: 'Opaque',
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, Buffer.from(v).toString('base64')])),
    };

    try {
      await this.coreApi.replaceNamespacedSecret(secretName, namespace, secret);
    } catch {
      await this.coreApi.createNamespacedSecret(namespace, secret);
    }
  }

  async getProjectConfig(namespace: string, appLabel: string): Promise<{ branch: string; buildCommand: string | null; runCommand: string | null; rootDir: string | null }> {
    const secretName = `${appLabel}-project-config`;
    const defaultConfig = { branch: 'main', buildCommand: null, runCommand: null, rootDir: null };
    try {
      const secret = await this.coreApi.readNamespacedSecret(secretName, namespace);
      if (secret.body.data) {
        const decode = (val: string | undefined) => val ? Buffer.from(val, 'base64').toString('utf-8') : null;
        return {
          branch: decode(secret.body.data['branch']) || 'main',
          buildCommand: decode(secret.body.data['buildCommand']),
          runCommand: decode(secret.body.data['runCommand']),
          rootDir: decode(secret.body.data['rootDir']),
        };
      }
      return defaultConfig;
    } catch {
      return defaultConfig;
    }
  }

  async deleteProjectConfig(namespace: string, appLabel: string): Promise<void> {
    const secretName = `${appLabel}-project-config`;
    try {
      await this.coreApi.deleteNamespacedSecret(secretName, namespace);
    } catch {
      // Secret might not exist
    }
  }

  async getEnvVarsFromK8s(namespace: string, appLabel: string): Promise<EnvFile> {
    const configMapName = `${appLabel}-config`;
    const secretName = `${appLabel}-secrets`;
    const envFile: EnvFile = {};

    try {
      const configMap = await this.coreApi.readNamespacedConfigMap(configMapName, namespace);
      if (configMap.body.data) {
        for (const [key, value] of Object.entries(configMap.body.data)) {
          envFile[key] = { key, value: value as string, isSecret: false };
        }
      }
    } catch {
      log.warn(`ConfigMap ${configMapName} not found in ${namespace}`);
    }

    try {
      const secret = await this.coreApi.readNamespacedSecret(secretName, namespace);
      if (secret.body.data) {
        for (const [key, value] of Object.entries(secret.body.data)) {
          envFile[key] = { key, value: Buffer.from(value as string, 'base64').toString(), isSecret: true };
        }
      }
    } catch {
      log.warn(`Secret ${secretName} not found in ${namespace}`);
    }

    return envFile;
  }

  async setEnvVarsToK8s(namespace: string, appLabel: string, envFile: EnvFile): Promise<void> {
    const envMap = new Map<string, string>();
    const secretMap = new Map<string, string>();

    for (const [, v] of Object.entries(envFile)) {
      if (v.isSecret) {
        secretMap.set(v.key, v.value);
      } else {
        envMap.set(v.key, v.value);
      }
    }

    await this.createOrUpdateConfigMap(namespace, appLabel, envMap);
    await this.createOrUpdateSecret(namespace, appLabel, secretMap);
  }

  async deleteEnvVarFromK8s(namespace: string, appLabel: string, key: string, isSecret: boolean): Promise<void> {
    if (isSecret) {
      const secretName = `${appLabel}-secrets`;
      try {
        const secret = await this.coreApi.readNamespacedSecret(secretName, namespace);
        if (secret.body.data) {
          delete secret.body.data[key];
          await this.coreApi.replaceNamespacedSecret(secretName, namespace, secret.body);
        }
      } catch (error) {
        log.warn(`Secret ${secretName} not found in ${namespace}`);
      }
    } else {
      const configMapName = `${appLabel}-config`;
      try {
        const configMap = await this.coreApi.readNamespacedConfigMap(configMapName, namespace);
        if (configMap.body.data) {
          delete configMap.body.data[key];
          await this.coreApi.replaceNamespacedConfigMap(configMapName, namespace, configMap.body);
        }
      } catch (error) {
        log.warn(`ConfigMap ${configMapName} not found in ${namespace}`);
      }
    }
  }

  private async createOrUpdateDeployment(
    namespace: string,
    appLabel: string,
    image: string,
    port: number,
    replicas: number,
    env: Array<{ name: string; value?: string; valueFrom?: any }>,
    resources?: any,
    healthCheck?: any
  ): Promise<k8s.V1Deployment> {
    const configMapEnv: Array<{ name: string; valueFrom: any }> = [];
    const secretEnv: Array<{ name: string; valueFrom: any }> = [];

    for (const e of env) {
      if (e.valueFrom) {
        if (e.valueFrom.secretKeyRef) {
          secretEnv.push(e as any);
        } else if (e.valueFrom.configMapKeyRef) {
          configMapEnv.push(e as any);
        }
      }
    }

    const regularEnv = env.filter(e => !e.valueFrom);

    const container: k8s.V1Container = {
      name: appLabel,
      image,
      ports: [{ containerPort: port }],
      env: [
        ...regularEnv,
        ...configMapEnv,
        ...secretEnv,
      ],
      resources: resources || {
        limits: { cpu: '500m', memory: '256Mi' },
        requests: { cpu: '100m', memory: '128Mi' },
      },
    };

    if (healthCheck) {
      container.livenessProbe = {
        httpGet: { path: healthCheck.path, port: healthCheck.port },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      };
      container.readinessProbe = {
        httpGet: { path: healthCheck.path, port: healthCheck.port },
        initialDelaySeconds: 5,
        periodSeconds: 5,
      };
    }

    const deployment: k8s.V1Deployment = {
      metadata: {
        name: appLabel,
        namespace,
        labels: { app: appLabel },
      },
      spec: {
        replicas,
        selector: { matchLabels: { app: appLabel } },
        template: {
          metadata: { labels: { app: appLabel } },
          spec: {
            containers: [container],
          },
        },
      },
    };

    try {
      const existing = await this.appsApi.readNamespacedDeployment(appLabel, namespace);
      await this.appsApi.replaceNamespacedDeployment(appLabel, namespace, deployment);
      log.info(`Updated deployment ${appLabel} in ${namespace}`);
    } catch {
      await this.appsApi.createNamespacedDeployment(namespace, deployment);
      log.info(`Created deployment ${appLabel} in ${namespace}`);
    }

    emitK8sEvent('k8s:deployment:updated', {
      name: appLabel,
      namespace,
      replicas,
      readyReplicas: 0,
      availableReplicas: 0,
      images: [image],
      type: 'MODIFIED',
    }, namespace);

    return deployment;
  }

  private async createOrUpdateService(
    namespace: string,
    appLabel: string,
    port: number
  ): Promise<k8s.V1Service> {
    const serviceName = `${appLabel}-svc`;
    const service: k8s.V1Service = {
      metadata: {
        name: serviceName,
        namespace,
        labels: { app: appLabel },
      },
      spec: {
        selector: { app: appLabel },
        ports: [{ port: 80, targetPort: port as any, protocol: 'TCP' }],
        type: 'ClusterIP',
      },
    };

    try {
      await this.coreApi.readNamespacedService(serviceName, namespace);
      await this.coreApi.replaceNamespacedService(serviceName, namespace, service);
    } catch {
      await this.coreApi.createNamespacedService(namespace, service);
    }

    return service;
  }

  async createOrUpdateIngress(
    namespace: string,
    appLabel: string,
    domain: string,
    serviceName: string,
    port: number
  ): Promise<k8s.V1Ingress> {
    const ingressName = `${appLabel}-ingress`;
    const ingress: k8s.V1Ingress = {
      metadata: {
        name: ingressName,
        namespace,
        annotations: {
          'kubernetes.io/ingress.class': 'nginx',
          'cert-manager.io/cluster-issuer': 'letsencrypt-prod',
          'nginx.ingress.kubernetes.io/ssl-redirect': 'true',
        },
      },
      spec: {
        tls: [{
          hosts: [domain],
          secretName: `${appLabel}-tls`,
        }],
        rules: [{
          host: domain,
          http: {
            paths: [{
              path: '/',
              pathType: 'Prefix',
              backend: {
                service: {
                  name: serviceName,
                  port: { number: 80 },
                },
              },
            }],
          },
        }],
      },
    };

    try {
      await this.networkingApi.readNamespacedIngress(ingressName, namespace);
      await this.networkingApi.replaceNamespacedIngress(ingressName, namespace, ingress);
    } catch {
      await this.networkingApi.createNamespacedIngress(namespace, ingress);
    }

    return ingress;
  }

  async rollback(projectId: string, deploymentId: string): Promise<void> {
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
    });

    if (!deployment || deployment.projectId !== projectId) {
      throw new Error('Deployment not found');
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) throw new Error('Project not found');

    if (deployment.imageTag) {
      await this.deployProject(projectId, project.namespace, {
        image: project.gitUrl.replace(/\.git$/, ''),
        tag: deployment.imageTag,
      });

      await prisma.deployment.update({
        where: { id: deploymentId },
        data: { status: 'SUCCESS', deployedAt: new Date() },
      });
    }
  }

  async buildImage(
    projectId: string,
    gitUrl: string,
    branch: string,
    imageTag: string,
    namespace: string
  ): Promise<string> {
    const registry = process.env.DOCKER_REGISTRY || 'localhost:5000';
    const imageName = `${registry}/${projectId}:${imageTag}`;

    const buildJob = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: `build-${projectId}-${Date.now()}`,
        namespace,
      },
      spec: {
        template: {
          spec: {
            containers: [{
              name: 'kaniko',
              image: 'gcr.io/kaniko-project/executor:latest',
              args: [
                `--context=${gitUrl}`,
                `--dockerfile=Dockerfile`,
                `--destination=${imageName}`,
                `--branch=${branch}`,
              ],
              volumeMounts: [{
                name: 'docker-config',
                mountPath: '/kaniko/.docker',
              }],
            }],
            volumes: [{
              name: 'docker-config',
              secret: { secretName: 'docker-config' },
            }],
            restartPolicy: 'Never',
          },
        },
        backoffLimit: 0,
      },
    };

    try {
      await this.batchApi.createNamespacedJob(namespace, buildJob as any);
      log.info(`Started image build for ${projectId}: ${imageTag}`);
    } catch (error) {
      log.error('Failed to start build job:', error);
      throw error;
    }

    return imageName;
  }

  async listDeployments(namespace: string): Promise<k8s.V1DeploymentList> {
    const response = await this.appsApi.listNamespacedDeployment(namespace);
    return response.body;
  }

  async deleteProject(namespace: string, appLabel: string): Promise<void> {
    try {
      await this.networkingApi.deleteNamespacedIngress(`${appLabel}-ingress`, namespace);
    } catch (e) {
      log.warn(`Ingress not found: ${appLabel}-ingress`);
    }

    try {
      await this.coreApi.deleteNamespacedService(`${appLabel}-svc`, namespace);
    } catch (e) {
      log.warn(`Service not found: ${appLabel}-svc`);
    }

    try {
      await this.appsApi.deleteNamespacedDeployment(appLabel, namespace);
    } catch (e) {
      log.warn(`Deployment not found: ${appLabel}`);
    }
  }

  async ensureNamespace(name: string, labels?: Record<string, string>): Promise<void> {
    try {
      await this.coreApi.readNamespace(name);
      log.info(`Namespace ${name} already exists`);
    } catch {
      await this.coreApi.createNamespace({
        metadata: {
          name,
          labels: {
            'managed-by': 'k8s-platform',
            ...labels,
          },
        },
      });
      log.info(`Namespace created: ${name}`);
    }
  }

  async deleteNamespace(name: string): Promise<void> {
    try {
      await this.coreApi.deleteNamespace(name);
      log.info(`Namespace deleted: ${name}`);
    } catch (e: any) {
      if (e?.response?.statusCode === 404) {
        log.warn(`Namespace not found: ${name}`);
      } else {
        throw e;
      }
    }
  }

  async setResourceQuota(namespace: string, quota: {
    cpu?: string;
    memory?: string;
    storage?: string;
    pods?: number;
    services?: number;
    configmaps?: number;
    secrets?: number;
    persistentvolumeclaims?: number;
  }): Promise<void> {
    const hard: Record<string, string> = {};
    if (quota.cpu) hard['limits.cpu'] = quota.cpu;
    if (quota.memory) hard['limits.memory'] = quota.memory;
    if (quota.storage) hard['requests.storage'] = quota.storage;
    if (quota.pods) hard['pods'] = String(quota.pods);
    if (quota.services) hard['services'] = String(quota.services);
    if (quota.configmaps) hard['configmaps'] = String(quota.configmaps);
    if (quota.secrets) hard['secrets'] = String(quota.secrets);
    if (quota.persistentvolumeclaims) hard['persistentvolumeclaims'] = String(quota.persistentvolumeclaims);

    if (Object.keys(hard).length === 0) return;

    const resourceQuota: k8s.V1ResourceQuota = {
      metadata: {
        name: 'project-quota',
        namespace,
      },
      spec: { hard },
    };

    try {
      await this.coreApi.replaceNamespacedResourceQuota('project-quota', namespace, resourceQuota);
      log.info(`ResourceQuota updated in ${namespace}`);
    } catch {
      await this.coreApi.createNamespacedResourceQuota(namespace, resourceQuota);
      log.info(`ResourceQuota created in ${namespace}`);
    }
  }

  async getDeploymentInfo(namespace: string, appLabel: string): Promise<k8s.V1Deployment | null> {
    try {
      const resp = await this.appsApi.readNamespacedDeployment(appLabel, namespace);
      return resp.body;
    } catch {
      return null;
    }
  }

  async deployFromImage(
    projectId: string,
    namespace: string,
    appLabel: string,
    image: string,
    config: {
      port?: number;
      replicas?: number;
      resources?: { limits?: { cpu?: string; memory?: string }; requests?: { cpu?: string; memory?: string } };
      env?: Array<{ name: string; value: string }>;
      healthCheck?: { path: string; port: number };
      domain?: string;
    }
  ): Promise<{ deployment: any; service: any; ingress?: any }> {
    const port = config.port || 80;
    const replicas = config.replicas || 1;

    const envVars = config.env || [];

    await this.createOrUpdateDeployment(
      namespace,
      appLabel,
      image,
      port,
      replicas,
      envVars,
      config.resources,
      config.healthCheck
    );

    const service = await this.createOrUpdateService(namespace, appLabel, port);

    let ingress;
    const deployDomain = config.domain || await this.ensureDefaultDomain(projectId, appLabel.replace('app-', ''), namespace);
    if (deployDomain) {
      ingress = await this.createOrUpdateIngress(namespace, appLabel, deployDomain, service.metadata!.name!, port);
    }

    await prisma.project.update({
      where: { id: projectId },
      data: { currentImageTag: image.split(':')[1] || 'latest', status: 'deployed' },
    });

    log.info(`Deployed from image ${image} for project ${projectId}`);
    return { deployment: await this.getDeploymentInfo(namespace, appLabel), service, ingress };
  }

  async scaleDeployment(
    namespace: string,
    appLabel: string,
    replicas: number
  ): Promise<void> {
    try {
      const current = await this.appsApi.readNamespacedDeployment(appLabel, namespace);
      const deployment = current.body;
      deployment.spec!.replicas = replicas;
      await this.appsApi.replaceNamespacedDeployment(appLabel, namespace, deployment);
      log.info(`Scaled deployment ${appLabel} in ${namespace} to ${replicas} replicas`);
    } catch (err: any) {
      log.error(`Failed to scale deployment ${appLabel}:`, err.message);
      throw err;
    }
  }

  async updateResourceLimits(
    namespace: string,
    appLabel: string,
    resources: {
      limits?: { cpu?: string; memory?: string };
      requests?: { cpu?: string; memory?: string };
    }
  ): Promise<void> {
    try {
      const current = await this.appsApi.readNamespacedDeployment(appLabel, namespace);
      const deployment = current.body;
      const container = deployment.spec!.template.spec!.containers[0];

      container.resources = {
        limits: {
          cpu: resources.limits?.cpu || container.resources?.limits?.cpu || '500m',
          memory: resources.limits?.memory || container.resources?.limits?.memory || '512Mi',
        },
        requests: {
          cpu: resources.requests?.cpu || container.resources?.requests?.cpu || '100m',
          memory: resources.requests?.memory || container.resources?.requests?.memory || '128Mi',
        },
      };

      await this.appsApi.replaceNamespacedDeployment(appLabel, namespace, deployment);
      log.info(`Updated resource limits for ${appLabel} in ${namespace}`);
    } catch (err: any) {
      log.error(`Failed to update resource limits for ${appLabel}:`, err.message);
      throw err;
    }
  }

  async createHPA(
    namespace: string,
    appLabel: string,
    config: {
      minReplicas?: number;
      maxReplicas: number;
      targetCPUUtilization?: number;
      targetMemoryUtilization?: number;
    }
  ): Promise<void> {
    const metrics: Array<{ type: string; resource?: any }> = [];

    if (config.targetCPUUtilization) {
      metrics.push({
        type: 'Resource',
        resource: {
          name: 'cpu',
          target: {
            type: 'Utilization',
            averageUtilization: config.targetCPUUtilization,
          },
        },
      });
    }

    if (config.targetMemoryUtilization) {
      metrics.push({
        type: 'Resource',
        resource: {
          name: 'memory',
          target: {
            type: 'Utilization',
            averageUtilization: config.targetMemoryUtilization,
          },
        },
      });
    }

    const hpa: any = {
      apiVersion: 'autoscaling/v2',
      kind: 'HorizontalPodAutoscaler',
      metadata: {
        name: `${appLabel}-hpa`,
        namespace,
      },
      spec: {
        scaleTargetRef: {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: appLabel,
        },
        minReplicas: config.minReplicas || 1,
        maxReplicas: config.maxReplicas,
        metrics,
      },
    };

    const autoscalingApi = k8sConfigManager.autoscalingApi;

    try {
      await autoscalingApi.readNamespacedHorizontalPodAutoscaler(`${appLabel}-hpa`, namespace);
      await autoscalingApi.replaceNamespacedHorizontalPodAutoscaler(`${appLabel}-hpa`, namespace, hpa);
      log.info(`Updated HPA for ${appLabel} in ${namespace}`);
    } catch {
      await autoscalingApi.createNamespacedHorizontalPodAutoscaler(namespace, hpa);
      log.info(`Created HPA for ${appLabel} in ${namespace}`);
    }
  }

  async deleteHPA(namespace: string, appLabel: string): Promise<void> {
    try {
      const autoscalingApi = k8sConfigManager.autoscalingApi;
      await autoscalingApi.deleteNamespacedHorizontalPodAutoscaler(`${appLabel}-hpa`, namespace);
      log.info(`Deleted HPA for ${appLabel} in ${namespace}`);
    } catch (err: any) {
      if (err.response?.statusCode !== 404) {
        log.warn(`Failed to delete HPA for ${appLabel}:`, err.message);
      }
    }
  }

  async getHPADetails(namespace: string, appLabel: string): Promise<any | null> {
    try {
      const autoscalingApi = k8sConfigManager.autoscalingApi;
      const resp = await autoscalingApi.readNamespacedHorizontalPodAutoscaler(`${appLabel}-hpa`, namespace);
      return resp.body;
    } catch {
      return null;
    }
  }

  async deleteIngress(namespace: string, appLabel: string, domain?: string): Promise<void> {
    try {
      const ingressName = domain ? `${appLabel}-${domain.split('.')[0]}-ingress` : `${appLabel}-ingress`;
      await this.networkingApi.deleteNamespacedIngress(ingressName, namespace);
      log.info(`Ingress ${ingressName} deleted from ${namespace}`);
    } catch (err: any) {
      if (err.response?.statusCode !== 404) {
        log.warn(`Failed to delete ingress: ${err.message}`);
      }
    }
  }

  async createGhcrDeployment(
    namespace: string,
    appLabel: string,
    image: string,
    port: number,
    replicas: number,
    env: Array<{ name: string; value?: string; valueFrom?: any }>,
    pullSecretName: string | null,
    resources?: any,
    healthCheck?: any,
  ): Promise<k8s.V1Deployment> {
    const container: k8s.V1Container = {
      name: appLabel,
      image,
      ports: [{ containerPort: port }],
      env: env || [],
      resources: resources || {
        limits: { cpu: '500m', memory: '256Mi' },
        requests: { cpu: '100m', memory: '128Mi' },
      },
    };

    if (healthCheck) {
      container.livenessProbe = {
        httpGet: { path: healthCheck.path, port: healthCheck.port },
        initialDelaySeconds: 30,
        periodSeconds: 10,
      };
      container.readinessProbe = {
        httpGet: { path: healthCheck.path, port: healthCheck.port },
        initialDelaySeconds: 5,
        periodSeconds: 5,
      };
    }

    const deployment: k8s.V1Deployment = {
      metadata: {
        name: appLabel,
        namespace,
        labels: { app: appLabel, 'image-source': 'ghcr' },
      },
      spec: {
        replicas,
        selector: { matchLabels: { app: appLabel } },
        template: {
          metadata: { labels: { app: appLabel } },
          spec: {
            containers: [container],
            imagePullSecrets: pullSecretName ? [{ name: pullSecretName }] : undefined,
          },
        },
      },
    };

    try {
      const existing = await this.appsApi.readNamespacedDeployment(appLabel, namespace);
      await this.appsApi.replaceNamespacedDeployment(appLabel, namespace, deployment);
      log.info(`Updated GHCR deployment ${appLabel} in ${namespace}`);
    } catch {
      await this.appsApi.createNamespacedDeployment(namespace, deployment);
      log.info(`Created GHCR deployment ${appLabel} in ${namespace}`);
    }

    emitK8sEvent('k8s:deployment:updated', {
      name: appLabel, namespace, replicas, images: [image], type: 'MODIFIED',
    }, namespace);

    return deployment;
  }

  async createRunDeployment(
    namespace: string,
    deployName: string,
    appLabel: string,
    image: string,
    env: Array<{ name: string; value?: string; valueFrom?: any }>,
    pullSecretName: string | null,
  ): Promise<k8s.V1Deployment> {
    const deployment: k8s.V1Deployment = {
      metadata: {
        name: deployName,
        namespace,
        labels: { app: appLabel, 'deploy-type': 'run', 'managed-by': 'k8s-platform' },
        annotations: { 'created-by': 'k8s-platform-run' },
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: appLabel, 'deploy-type': 'run' } },
        template: {
          metadata: { labels: { app: appLabel, 'deploy-type': 'run' } },
          spec: {
            containers: [{
              name: appLabel,
              image,
              env: env || [],
              resources: {
                limits: { cpu: '200m', memory: '256Mi' },
                requests: { cpu: '100m', memory: '128Mi' },
              },
            }],
            imagePullSecrets: pullSecretName ? [{ name: pullSecretName }] : undefined,
          },
        },
      },
    };

    try {
      await this.appsApi.createNamespacedDeployment(namespace, deployment);
      log.info(`Run deployment created: ${deployName} in ${namespace}`);
    } catch (err: any) {
      log.error(`Failed to create run deployment ${deployName}:`, err.message);
      throw err;
    }

    return deployment;
  }
}

export const k8sDeployManager = new K8sDeployManager();
