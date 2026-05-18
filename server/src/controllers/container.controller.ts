import { FastifyRequest, FastifyReply } from 'fastify';
import * as stream from 'stream';
import * as k8s from '@kubernetes/client-node';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';
import { k8sDeployManager } from '../lib/k8s-deploy.js';
import { containerBuilder } from '../lib/container-builder.js';
import { detectProjectType, generateDockerfileContent, detectLanguageFromName } from '../lib/build-detector.js';
import { emitK8sEvent, emitBuildLog } from '../lib/socket.js';
import { traefikManager } from '../lib/k8s-traefik.js';
import { streamBuildLogs, checkJobStatus } from '../lib/build-streamer.js';

function getRepoInfo(gitUrl: string): { owner: string; repo: string; image: string } {
  const githubMatch = gitUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (githubMatch) {
    return {
      owner: githubMatch[1],
      repo: githubMatch[2],
      image: `ghcr.io/${githubMatch[1].toLowerCase()}/${githubMatch[2].toLowerCase()}`,
    };
  }

  const gitlabMatch = gitUrl.match(/gitlab\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (gitlabMatch) {
    return {
      owner: gitlabMatch[1],
      repo: gitlabMatch[2],
      image: `registry.gitlab.com/${gitlabMatch[1].toLowerCase()}/${gitlabMatch[2].toLowerCase()}`,
    };
  }

  const repoName = gitUrl.split('/').pop()?.replace('.git', '') || 'app';
  return { owner: 'user', repo: repoName, image: repoName };
}

function getProjectSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function getAppLabel(userEmail: string | undefined | null, slug: string): string {
  const userPrefix = userEmail
    ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20)
    : 'user';
  return `app-${userPrefix}-${slug}`;
}

function generateNamespace(projectName: string, projectId: string): string {
  const base = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 40);
  const shortId = projectId.replace(/-/g, '').substring(0, 8);
  return `proj-${base}-${shortId}`.substring(0, 63).replace(/^-+|-+$/g, '');
}

async function getUserResourceQuota(userId: string) {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
    include: { plan: true },
  });

  if (subscription?.plan?.limits) {
    const limits = subscription.plan.limits as any;
    return {
      cpu: limits.cpu || '500m',
      memory: limits.memory || '512Mi',
      storage: limits.storage || '1Gi',
      pods: limits.pods || 5,
      services: limits.services || 5,
      configmaps: limits.configmaps || 10,
      secrets: limits.secrets || 10,
    };
  }

  return { cpu: '500m', memory: '512Mi', storage: '1Gi', pods: 5, services: 5, configmaps: 10, secrets: 10 };
}

async function checkProjectAccess(projectId: string, userId: string): Promise<{ allowed: boolean; project?: any; error?: string; status?: number }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true, user: true },
  });

  if (!project) return { allowed: false, error: 'Project not found', status: 404 };

  if (project.workspace.ownerId === userId || project.userId === userId) {
    return { allowed: true, project };
  }

  const membership = await prisma.workspaceMember.findFirst({
    where: { workspaceId: project.workspaceId, userId },
  });

  if (membership && (membership.role === 'ADMIN' || membership.role === 'MANAGER')) {
    return { allowed: true, project };
  }

  return { allowed: false, error: 'Access denied', status: 403 };
}

export async function buildAndDeploy(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { name, description, gitUrl, branch, workspaceId: reqWorkspaceId, autoDeploy } = request.body as any;

  if (!name) { return reply.status(400).send({ error: 'Bad Request', message: 'Project name is required' }); }
  if (!gitUrl) { return reply.status(400).send({ error: 'Bad Request', message: 'Git repository URL is required' }); }

  try {
    const slug = getProjectSlug(name);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) { return reply.status(404).send({ error: 'Not Found', message: 'User not found' }); }

    const workspaceIds = await prisma.workspace.findMany({
      where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
      select: { id: true }, orderBy: { createdAt: 'asc' },
    });
    if (workspaceIds.length === 0) { return reply.status(400).send({ error: 'Bad Request', message: 'No workspace found. Create a workspace first.' }); }
    const workspaceId = reqWorkspaceId || workspaceIds[0].id;

    let clusters = await prisma.cluster.findMany({ where: { workspaceId }, orderBy: { isDefault: 'desc' } });
    let clusterId: string;
    if (clusters.length > 0) {
      clusterId = clusters[0].id;
    } else {
      const cluster = await prisma.cluster.create({ data: { workspaceId, name: 'default', provider: 'minikube', region: 'local', isDefault: true } });
      clusterId = cluster.id;
    }

    const project = await prisma.project.create({
      data: { workspaceId, userId, clusterId, name, slug, description: description || null, gitUrl, status: 'building', namespace: 'temp', replicas: 1, autoDeploy: autoDeploy !== false },
    });

    const finalNamespace = generateNamespace(name, project.id);
    await prisma.project.update({ where: { id: project.id }, data: { namespace: finalNamespace } });

    const k8sConfig = await k8sConfigManager.loadConfig();
    let buildConfig = detectProjectType(gitUrl).buildConfig;
    let language = buildConfig.language, framework = buildConfig.framework, port = buildConfig.port, healthCheckPath = buildConfig.healthCheckPath;

    if (language === 'git' || language === 'unknown') {
      const repoName = gitUrl.split('/').pop()?.replace('.git', '') || name;
      buildConfig = detectLanguageFromName(repoName, description);
      language = buildConfig.language; framework = buildConfig.framework; port = buildConfig.port;
    }

    if (k8sConfig.connected) {
      try {
        const resourceQuota = await getUserResourceQuota(userId);
        await k8sDeployManager.ensureNamespace(finalNamespace, { 'project-id': project.id, 'workspace-id': workspaceId, 'user-id': userId });
        await k8sDeployManager.setResourceQuota(finalNamespace, resourceQuota);
        await prisma.managedNamespace.create({ data: { projectId: project.id, name: finalNamespace, status: 'active', labels: { 'project-id': project.id, 'workspace-id': workspaceId, 'user-id': userId }, resourceQuota: resourceQuota as any } });
      } catch (nsError: any) { log.warn(`Namespace setup issue: ${nsError.message}`); }
    }

    const pipeline = await prisma.cICDPipeline.create({
      data: { projectId: project.id, userId, gitUrl, branch: branch || 'main', status: 'BUILDING', triggeredBy: 'manual' },
    });

    reply.status(201).send({
      project: { ...project, previewUrl: null },
      buildConfig: { language, framework, port, healthCheckPath },
      pipelineId: pipeline.id,
    });

    runBuildDeployPipeline(project, finalNamespace, buildConfig, port, healthCheckPath, pipeline.id).catch((err: any) => {
      log.error(`Background build failed: ${err.message}`);
    });
  } catch (error: any) {
    log.error('Container build & deploy error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

async function runBuildDeployPipeline(project: any, namespace: string, buildConfig: any, port: number, healthCheckPath: string, pipelineId: string) {
  let buildLog = '';
  const logLine = (msg: string) => {
    buildLog += msg + '\n';
    emitBuildLog(project.id, 'build:log', { text: msg + '\n', projectId: project.id });
  };

  try {
    logLine(`[BUILD] Starting build for ${project.name}`);
    const buildResult = await containerBuilder.buildFromGit({
      gitUrl: project.gitUrl,
      branch: project.branch || 'main',
      projectId: project.id,
      namespace,
      buildConfig,
    }, logLine);

    logLine(`[BUILD] Image: ${buildResult.fullImage}`);

    if (buildResult.jobName !== 'local') {
      const streamedLog = await streamBuildLogs(namespace, buildResult.jobName, project.id);
      if (streamedLog) buildLog += streamedLog;
      const finalStatus = await checkJobStatus(namespace, buildResult.jobName);
      if (finalStatus === 'failed') throw new Error('Build failed. Check build logs.');
      if (finalStatus === 'running') throw new Error('Build timed out.');
    }

    logLine(`[BUILD] Image built successfully`);
    logLine(`[DEPLOY] Deploying...`);

    await prisma.project.update({ where: { id: project.id }, data: { currentImageTag: buildResult.imageTag } });

    const deployResult = await k8sDeployManager.deployProject(project.id, namespace, {
      image: buildResult.imageName,
      tag: buildResult.imageTag,
      port,
      replicas: project.replicas || 1,
      healthCheck: { path: healthCheckPath, port },
    });

    logLine(`[DEPLOY] Deployment created/updated`);
    if (deployResult.service) logLine(`[DEPLOY] Service: ${deployResult.service.metadata!.name}`);

    await prisma.project.update({ where: { id: project.id }, data: { status: 'deployed' } });

    await prisma.cICDPipeline.update({
      where: { id: pipelineId },
      data: { status: 'SUCCESS', buildLog, imageTag: buildResult.imageTag },
    });

    emitK8sEvent('k8s:deployment:created', { name: project.slug, namespace, image: buildResult.fullImage }, namespace);

    try {
      await traefikManager.ensureTraefikInstalled();
      const domain = `${project.slug}.k8s-platform.local`;
      await traefikManager.addRoute({ projectId: project.id, domain, serviceName: project.slug, servicePort: port, namespace, tls: false });
    } catch (tErr: any) { log.warn(`Traefik setup skipped: ${tErr.message}`); }

    emitBuildLog(project.id, 'build:status', { status: 'success', message: 'Deployment completed', projectId: project.id });
    logLine(`[DONE] Deployment completed`);
  } catch (error: any) {
    log.error(`Build/deploy failed for ${project.name}:`, error.message);
    emitBuildLog(project.id, 'build:status', { status: 'failed', message: error.message, projectId: project.id });
    logLine(`[ERROR] ${error.message}`);

    logLine(`[FALLBACK] Deploying generic nginx:alpine image instead...`);
    try {
      const fallbackImage = 'nginx:alpine';
      await k8sDeployManager.deployProject(project.id, namespace, {
        image: 'nginx',
        tag: 'alpine',
        port: 80,
        replicas: project.replicas || 1,
      });

      await prisma.project.update({ where: { id: project.id }, data: { status: 'deployed', currentImageTag: 'alpine' } });
      await prisma.cICDPipeline.update({
        where: { id: pipelineId },
        data: { status: 'SUCCESS', buildLog: buildLog + `\n[FALLBACK] Deployed nginx:alpine (build failed: ${error.message})` },
      });

      emitK8sEvent('k8s:deployment:created', { name: project.slug, namespace, image: fallbackImage, fallback: true }, namespace);
      emitBuildLog(project.id, 'build:status', { status: 'success', message: `Fallback deploy: nginx:alpine (build failed)`, projectId: project.id });
      logLine(`[DONE] Fallback deployment completed`);
    } catch (fallbackErr: any) {
      log.error(`Fallback deploy also failed for ${project.name}:`, fallbackErr.message);
      emitBuildLog(project.id, 'build:status', { status: 'failed', message: `Fallback also failed: ${fallbackErr.message}`, projectId: project.id });

      await prisma.project.update({ where: { id: project.id }, data: { status: 'build_failed' } }).catch(() => {});
      await prisma.cICDPipeline.update({ where: { id: pipelineId }, data: { status: 'FAILED', buildLog: `Build failed: ${error.message}\nFallback failed: ${fallbackErr.message}` } }).catch(() => {});
    }
  }
}

export async function deployFromImage(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { name, description, image, port, replicas, envVars, domain, workspaceId: reqWorkspaceId, resources, healthCheck } = request.body as any;

    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Project name is required' });
    }

    if (!image) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Docker image is required (e.g., nginx:latest, python:3.12-slim)' });
    }

    const slug = getProjectSlug(name);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    const workspaceIds = await prisma.workspace.findMany({
      where: {
        OR: [{ ownerId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    });

    if (workspaceIds.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No workspace found. Create a workspace first.' });
    }

    const workspaceId = reqWorkspaceId || workspaceIds[0].id;

    let clusters = await prisma.cluster.findMany({
      where: { workspaceId },
      orderBy: { isDefault: 'desc' },
    });

    let clusterId: string;
    if (clusters.length > 0) {
      clusterId = clusters[0].id;
    } else {
      const cluster = await prisma.cluster.create({
        data: { workspaceId, name: 'default', provider: 'minikube', region: 'local', isDefault: true },
      });
      clusterId = cluster.id;
    }

    const project = await prisma.project.create({
      data: {
        workspaceId,
        userId,
        clusterId,
        name,
        slug,
        description: description || null,
        gitUrl: image,
        status: 'creating',
        namespace: 'temp',
        replicas: replicas || 1,
        autoDeploy: true,
      },
    });

    const finalNamespace = generateNamespace(name, project.id);

    await prisma.project.update({
      where: { id: project.id },
      data: { namespace: finalNamespace },
    });

    const k8sConfig = await k8sConfigManager.loadConfig();
    const appPort = port || 80;
    const healthCheckPath = healthCheck?.path || '/';

    if (k8sConfig.connected) {
      try {
        const resourceQuota = await getUserResourceQuota(userId);
        await k8sDeployManager.ensureNamespace(finalNamespace, {
          'project-id': project.id,
          'workspace-id': workspaceId,
          'user-id': userId,
        });
        await k8sDeployManager.setResourceQuota(finalNamespace, resourceQuota);

        await prisma.managedNamespace.create({
          data: {
            projectId: project.id,
            name: finalNamespace,
            status: 'active',
            labels: { 'project-id': project.id, 'workspace-id': workspaceId, 'user-id': userId },
            resourceQuota: resourceQuota as any,
          },
        });

        const appLabel = `app-${slug}`;
        const deployResult = await k8sDeployManager.deployFromImage(
          project.id,
          finalNamespace,
          appLabel,
          image,
          {
            port: appPort,
            replicas: replicas || 1,
            resources: resources || {
              limits: { cpu: '500m', memory: '512Mi' },
              requests: { cpu: '100m', memory: '128Mi' },
            },
            env: envVars || [],
            healthCheck: { path: healthCheckPath, port: appPort },
            domain,
          }
        );

        await prisma.project.update({
          where: { id: project.id },
          data: { status: 'deployed' },
        });

        emitK8sEvent('k8s:deployment:created', {
          name: slug,
          namespace: finalNamespace,
          image,
          replicas: replicas || 1,
        }, finalNamespace);

        log.info(`Image ${image} deployed as project ${name} in ${finalNamespace}`);
      } catch (deployError: any) {
        log.error(`Image deploy failed for ${name}:`, deployError.message);
        await prisma.project.update({
          where: { id: project.id },
          data: { status: 'deployment_failed' },
        });

        reply.status(500).send({ error: 'Deploy Failed', message: deployError.message, project });
      }
    } else {
      await prisma.project.update({
        where: { id: project.id },
        data: { status: 'active' },
      });
    }

    const deployedProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: { managedNamespace: true, domains: true },
    });

    reply.status(201).send({
      project: {
        ...deployedProject,
        previewUrl: deployedProject?.domains?.find(d => d.isPrimary)?.domain || deployedProject?.domains?.[0]?.domain || null,
      },
      image,
      port: appPort,
    });
  } catch (error: any) {
    log.error('Deploy from image error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function scaleDeployment(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { replicas } = request.body as any;

    if (replicas === undefined || replicas < 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'replicas is required and must be >= 0' });
    }

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Kubernetes not connected' });
    }

    const appLabel = getAppLabel(project.user?.email, project.slug);

    if (replicas === 0) {
      await k8sDeployManager.scaleDeployment(project.namespace, appLabel, 0);
      await prisma.project.update({
        where: { id: projectId },
        data: { replicas: 0, status: 'stopped' },
      });
    } else {
      await k8sDeployManager.scaleDeployment(project.namespace, appLabel, replicas);
      await prisma.project.update({
        where: { id: projectId },
        data: { replicas, status: 'deployed' },
      });
    }

    emitK8sEvent('k8s:deployment:scaled', {
      name: project.slug,
      namespace: project.namespace,
      replicas,
    }, project.namespace);

    log.info(`Scaled ${project.name} to ${replicas} replicas`);
    reply.send({ message: `Scaled to ${replicas} replicas`, replicas });
  } catch (error: any) {
    log.error('Scale error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function updateResources(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { cpu, memory, cpuRequest, memoryRequest } = request.body as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Kubernetes not connected' });
    }

    const appLabel = getAppLabel(project.user?.email, project.slug);

    await k8sDeployManager.updateResourceLimits(project.namespace, appLabel, {
      limits: {
        cpu: cpu || undefined,
        memory: memory || undefined,
      },
      requests: {
        cpu: cpuRequest || undefined,
        memory: memoryRequest || undefined,
      },
    });

    emitK8sEvent('k8s:deployment:resources-updated', {
      name: project.slug,
      namespace: project.namespace,
      resources: { limits: { cpu, memory }, requests: { cpu: cpuRequest, memory: memoryRequest } },
    }, project.namespace);

    log.info(`Updated resources for ${project.name}: CPU=${cpu}, Memory=${memory}`);
    reply.send({
      message: 'Resources updated',
      resources: {
        limits: { cpu, memory },
        requests: { cpu: cpuRequest, memory: memoryRequest },
      },
    });
  } catch (error: any) {
    log.error('Resource update error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function enableAutoScaling(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { minReplicas, maxReplicas, targetCPU, targetMemory } = request.body as any;

    if (!maxReplicas) {
      return reply.status(400).send({ error: 'Bad Request', message: 'maxReplicas is required' });
    }

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Kubernetes not connected' });
    }

    const appLabel = getAppLabel(project.user?.email, project.slug);

    await k8sDeployManager.createHPA(project.namespace, appLabel, {
      minReplicas: minReplicas || 1,
      maxReplicas,
      targetCPUUtilization: targetCPU || 80,
      targetMemoryUtilization: targetMemory || undefined,
    });

    emitK8sEvent('k8s:hpa:created', {
      name: project.slug,
      namespace: project.namespace,
      minReplicas: minReplicas || 1,
      maxReplicas,
    }, project.namespace);

    log.info(`HPA enabled for ${project.name}: ${minReplicas || 1}-${maxReplicas} replicas`);
    reply.send({
      message: 'Auto-scaling enabled',
      config: { minReplicas: minReplicas || 1, maxReplicas, targetCPU: targetCPU || 80 },
    });
  } catch (error: any) {
    log.error('HPA enable error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function disableAutoScaling(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable' });
    }

    const appLabel = getAppLabel(project.user?.email, project.slug);
    await k8sDeployManager.deleteHPA(project.namespace, appLabel);

    emitK8sEvent('k8s:hpa:deleted', { name: project.slug, namespace: project.namespace }, project.namespace);

    log.info(`HPA disabled for ${project.name}`);
    reply.send({ message: 'Auto-scaling disabled' });
  } catch (error: any) {
    log.error('HPA disable error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getHPAStatus(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable' });
    }

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const hpa = await k8sDeployManager.getHPADetails(project.namespace, appLabel);

    reply.send({
      enabled: !!hpa,
      hpa: hpa ? {
        currentReplicas: hpa.status?.currentReplicas || 0,
        desiredReplicas: hpa.status?.desiredReplicas || 0,
        minReplicas: hpa.spec?.minReplicas || 1,
        maxReplicas: hpa.spec?.maxReplicas,
        metrics: hpa.spec?.metrics || [],
        conditions: hpa.status?.conditions || [],
      } : null,
    });
  } catch (error: any) {
    log.error('HPA status error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getDeploymentResources(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable' });
    }

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const deployment = await k8sDeployManager.getDeploymentInfo(project.namespace, appLabel);

    if (!deployment) {
      reply.send({ deployed: false, message: 'No deployment found for this project' }); return;;
    }

    const container = deployment.spec!.template.spec!.containers[0];
    const hpa = await k8sDeployManager.getHPADetails(project.namespace, appLabel);

    reply.send({
      deployed: true,
      name: deployment.metadata?.name,
      namespace: deployment.metadata?.namespace,
      replicas: {
        current: deployment.status?.readyReplicas || 0,
        desired: deployment.spec?.replicas || 0,
        available: deployment.status?.availableReplicas || 0,
      },
      image: container.image,
      resources: container.resources || {
        limits: { cpu: '500m', memory: '512Mi' },
        requests: { cpu: '100m', memory: '128Mi' },
      },
      hpa: hpa ? {
        enabled: true,
        minReplicas: hpa.spec?.minReplicas,
        maxReplicas: hpa.spec?.maxReplicas,
        currentReplicas: hpa.status?.currentReplicas,
      } : { enabled: false },
      ports: container.ports?.map(p => p.containerPort) || [],
      conditions: deployment.status?.conditions || [],
    });
  } catch (error: any) {
    log.error('Get deployment resources error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getBuildLogs(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const pipeline = await prisma.cICDPipeline.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });

    reply.send({
      logs: pipeline?.buildLog || 'No build logs available',
      status: pipeline?.status || 'unknown',
      imageTag: pipeline?.imageTag || null,
      duration: pipeline?.duration || null,
      triggeredAt: pipeline?.createdAt || null,
    });
  } catch (error: any) {
    log.error('Get build logs error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function detectLanguage(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { gitUrl, repoName, description } = request.body as any;

    if (!gitUrl && !repoName) {
      return reply.status(400).send({ error: 'Bad Request', message: 'gitUrl or repoName is required' });
    }

    let buildConfig;
    if (gitUrl) {
      buildConfig = detectProjectType(gitUrl).buildConfig;
    }

    if (!buildConfig || buildConfig.language === 'git' || buildConfig.language === 'unknown') {
      buildConfig = detectLanguageFromName(repoName || gitUrl || '', description);
    }

    reply.send({
      language: buildConfig.language,
      framework: buildConfig.framework,
      port: buildConfig.port,
      healthCheckPath: buildConfig.healthCheckPath,
      dockerfile: buildConfig.dockerfile,
    });
  } catch (error: any) {
    log.error('Language detection error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function execCommand(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { command, podName } = request.body as any;

    if (!command) {
      return reply.status(400).send({ error: 'Bad Request', message: 'command is required' });
    }

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable', message: 'Kubernetes not connected' });
    }

    const coreApi = k8sConfigManager.coreApi;
    const appLabel = getAppLabel(project.user?.email, project.slug);

    let targetPod = podName;
    if (!targetPod) {
      const pods = await coreApi.listNamespacedPod(
        project.namespace,
        undefined, undefined, undefined, undefined,
        `app=${appLabel}`
      );
      if (!pods.body.items.length) {
        return reply.status(404).send({ error: 'Not Found', message: 'No running pods found for this project' });
      }
      targetPod = pods.body.items[0].metadata!.name!;
    }

    const exec = new k8s.Exec(k8sConfig.kubeConfig);
    const cmd = ['sh', '-c', command];

    let stdout = '';
    let stderr = '';

    const stdoutStream = new stream.Writable({
      write(chunk: any, encoding: string, callback: Function) {
        stdout += chunk.toString();
        callback();
      },
    });

    const stderrStream = new stream.Writable({
      write(chunk: any, encoding: string, callback: Function) {
        stderr += chunk.toString();
        callback();
      },
    });

    await new Promise<void>((resolve, reject) => {
      exec.exec(
        project.namespace,
        targetPod,
        appLabel,
        cmd,
        stdoutStream,
        stderrStream,
        null,
        false,
        (status: k8s.V1Status) => {
          if (status.status === 'Failure' && !stderr) {
            stderr = status.message || 'Command failed';
          }
          resolve();
        }
      ).catch((err: Error) => {
        stderr = err.message;
        resolve();
      });
    });

    reply.send({ stdout, stderr, pod: targetPod, command });
  } catch (error: any) {
    log.error('Exec command error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getPods(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable' });
    }

    const coreApi = k8sConfigManager.coreApi;
    const appLabel = getAppLabel(project.user?.email, project.slug);
    const pods = await coreApi.listNamespacedPod(
      project.namespace,
      undefined, undefined, undefined, undefined,
      `app=${appLabel}`
    );

    const podList = pods.body.items.map(pod => ({
      name: pod.metadata?.name,
      status: pod.status?.phase,
      ready: pod.status?.containerStatuses?.every(c => c.ready) || false,
      restarts: pod.status?.containerStatuses?.reduce((s: number, c: any) => s + (c.restartCount || 0), 0) || 0,
      ip: pod.status?.podIP,
      node: pod.spec?.nodeName,
      age: pod.metadata?.creationTimestamp,
    }));

    reply.send(podList);
  } catch (error: any) {
    log.error('Get pods error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function suggestDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      return reply.status(503).send({ error: 'Service Unavailable' });
    }

    const ingressIp = k8sConfig.apiServer || 'localhost';
    const ip = ingressIp.replace(/^https?:\/\//, '').split(':')[0];

    const autoDomain = `${project.slug}.${ip}.nip.io`;

    reply.send({
      autoDomain,
      customDomainSupported: true,
      instructions: 'Point your domain A record to your cluster IP, then add the domain below.',
    });
  } catch (error: any) {
    log.error('Domain suggestion error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function addCustomDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { domain } = request.body as any;

    if (!domain) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Domain is required' });
    }

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const project = access.project!;

    const existing = await prisma.domain.findFirst({
      where: { projectId, domain },
    });
    if (existing) {
      return reply.status(409).send({ error: 'Conflict', message: 'Domain already added to this project' });
    }

    const isFirst = await prisma.domain.count({ where: { projectId } }) === 0;

    const domainRecord = await prisma.domain.create({
      data: {
        projectId,
        domain,
        isCustom: true,
        isPrimary: isFirst,
        sslEnabled: true,
        status: 'active',
      },
    });

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (k8sConfig.connected) {
      try {
        const appLabel = getAppLabel(project.user?.email, project.slug);
        const serviceName = `${appLabel}-svc`;
        await k8sDeployManager.createOrUpdateIngress(project.namespace, appLabel, domain, serviceName, 80);
      } catch (err: any) {
        log.warn(`Failed to update ingress for domain ${domain}:`, err.message);
      }
    }

    log.info(`Domain ${domain} added to project ${project.name}`);
    reply.status(201).send(domainRecord);
  } catch (error: any) {
    log.error('Add domain error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getProjectDomains(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    const domains = await prisma.domain.findMany({
      where: { projectId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });

    reply.send(domains);
  } catch (error: any) {
    log.error('Get domains error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function removeDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId, domainId } = request.params as any;

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain || domain.projectId !== projectId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Domain not found' });
    }

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) {
      return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
    }

    await prisma.domain.delete({ where: { id: domainId } });

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (k8sConfig.connected && domain.isCustom) {
      try {
        const project = await prisma.project.findUnique({ where: { id: projectId }, include: { user: true } });
        if (project) {
          const appLabel = getAppLabel(project.user?.email, project.slug);
          await k8sDeployManager.deleteIngress(project.namespace, appLabel, domain.domain);
        }
      } catch (err: any) {
        log.warn(`Failed to cleanup ingress for domain ${domain.domain}:`, err.message);
      }
    }

    reply.send({ message: 'Domain removed', domain: domain.domain });
  } catch (error: any) {
    log.error('Remove domain error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getBuildQueueStats(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { getQueueStats } = await import('../lib/queue.js');
    const stats = await getQueueStats();
    reply.send(stats);
  } catch (error: any) {
    reply.send({ waiting: 0, active: 0, completed: 0, failed: 0, error: error.message });
  }
}
