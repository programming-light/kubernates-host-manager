import { FastifyRequest, FastifyReply } from 'fastify';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';
import { emitK8sEvent } from '../lib/socket.js';
import { k8sDeployManager } from '../lib/k8s-deploy.js';

function generateProjectNamespace(projectName: string, projectId: string): string {
  const base = projectName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').substring(0, 40);
  const shortId = projectId.replace(/-/g, '').substring(0, 8);
  return `proj-${base}-${shortId}`.substring(0, 63).replace(/^-+|-+$/g, '');
}

function getAppLabel(userEmail: string | undefined | null, slug: string): string {
  const userPrefix = userEmail
    ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20)
    : 'user';
  return `app-${userPrefix}-${slug}`;
}

async function getUserResourceQuota(userId: string): Promise<{
  cpu: string;
  memory: string;
  storage: string;
  pods: number;
  services: number;
  configmaps: number;
  secrets: number;
}> {
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

  return {
    cpu: '500m',
    memory: '512Mi',
    storage: '1Gi',
    pods: 5,
    services: 5,
    configmaps: 10,
    secrets: 10,
  };
}

function getRepoInfo(gitUrl: string): { owner: string; repo: string; image: string } {
  const match = gitUrl.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (match) {
    return {
      owner: match[1],
      repo: match[2],
      image: `ghcr.io/${match[1].toLowerCase()}/${match[2].toLowerCase()}`,
    };
  }
  const repoName = gitUrl.split('/').pop()?.replace('.git', '') || 'app';
  return { owner: 'user', repo: repoName, image: repoName };
}

async function getUserRole(userId: string, workspaceId?: string): Promise<{ role: string; isOwner: boolean; isSuperAdmin: boolean }> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { role: 'VIEWER', isOwner: false, isSuperAdmin: false };

  if (user.role === 'ADMIN') {
    return { role: 'ADMIN', isOwner: false, isSuperAdmin: true };
  }

  if (workspaceId) {
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (workspace) {
      if (workspace.ownerId === userId) {
        return { role: 'OWNER', isOwner: true, isSuperAdmin: false };
      }
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId, userId },
      });
      return { role: membership?.role || 'DEVELOPER', isOwner: false, isSuperAdmin: false };
    }
  }

  return { role: user.role, isOwner: false, isSuperAdmin: false };
}

interface EnvVar {
  key: string;
  value: string;
  isSecret?: boolean;
}

interface EnvFile {
  [key: string]: EnvVar;
}

function parseEnvContent(content: string): EnvVar[] {
  const lines = content.split('\n');
  const vars: EnvVar[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue;

    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      let key = match[1].trim();
      let value = match[2].trim();

      key = key.replace(/^export\s+/, '');

      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (key) {
        vars.push({ key, value });
      }
    }
  }

  return vars;
}

async function getProjectForEnv(projectId: string, userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const isSuperAdmin = user?.role === 'ADMIN';

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true, user: true },
  });

  if (!project) return { error: 'Project not found', status: 404 };

  if (!isSuperAdmin && project.userId !== userId) {
    return { error: 'Access denied. Only the project owner can manage environment variables.', status: 403 };
  }

  return { project };
}

export async function getProjects(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { workspaceId } = request.query as any;
    const userId = (request as any).userId!;
    const userRole = await getUserRole(userId);
    const where: any = {};

    if (userRole.isSuperAdmin) {
      if (workspaceId) where.workspaceId = workspaceId as string;
    } else if (userRole.isOwner || userRole.role === 'ADMIN' || userRole.role === 'MANAGER') {
      if (workspaceId) {
        where.workspaceId = workspaceId as string;
      } else {
        const userWorkspaceIds = await prisma.workspace.findMany({
          where: {
            OR: [
              { ownerId: userId },
              { members: { some: { userId } } },
            ],
          },
          select: { id: true },
        });
        const allowedIds = userWorkspaceIds.map((ws) => ws.id);
        if (allowedIds.length > 0) {
          where.workspaceId = { in: allowedIds };
        } else {
          reply.send([]); return;;
        }
      }
    } else {
      where.userId = userId;
      if (workspaceId) where.workspaceId = workspaceId as string;
    }

    const projectList = await prisma.project.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        workspace: { select: { name: true } },
        domains: true,
      },
    });

    const result = projectList.map(p => ({
      ...p,
      previewUrl: p.domains?.find(d => d.isPrimary)?.domain || p.domains?.[0]?.domain || null,
    }));

    reply.send(result);
  } catch (error) {
    log.error('Failed to list projects:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch projects' });
  }
}

export async function createProject(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { name, description, gitUrl, branch, buildCommand, runCommand, rootDir, replicas, autoDeploy, buildPack, port, healthCheckPath, workspaceId: reqWorkspaceId } = request.body as any;
    const userId = (request as any).userId!;

    if (!name) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Project name is required' });
    }

    const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return reply.status(404).send({ error: 'Not Found', message: 'User not found' });
    }

    let workspaceId = reqWorkspaceId;
    if (workspaceId) {
      const ws = await prisma.workspace.findFirst({
        where: {
          id: workspaceId,
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
      });
      if (!ws) return reply.status(403).send({ error: 'Forbidden', message: 'Workspace access denied' });
    } else {
      const userWorkspaceIds = await prisma.workspace.findMany({
        where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });
      if (userWorkspaceIds.length === 0) {
        return reply.status(400).send({ error: 'Bad Request', message: 'No workspace found. Please create a workspace first.' });
      }
      workspaceId = userWorkspaceIds[0].id;
    }

    let clusters = await prisma.cluster.findMany({
      where: { workspaceId },
      orderBy: { isDefault: 'desc' },
    });

    let clusterId = clusters.length > 0 ? clusters[0].id : null;

    if (!clusterId) {
      const defaultCluster = await prisma.cluster.create({
        data: {
          workspaceId,
          name: 'default',
          provider: 'minikube',
          region: 'local',
          isDefault: true,
        },
      });
      clusterId = defaultCluster.id;
    }

    if (!gitUrl || !gitUrl.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'GitHub repository URL is required for CI/CD' });
    }

    const tempId = `temp-${Date.now()}`;
    const namespace = generateProjectNamespace(name, tempId);

    const project = await prisma.project.create({
      data: {
        workspaceId,
        userId,
        clusterId,
        name,
        slug,
        description: description || null,
        gitUrl: gitUrl.trim(),
        status: 'creating',
        namespace,
        branch: branch || 'main',
        buildCommand: buildCommand || null,
        runCommand: runCommand || null,
        rootDir: rootDir || null,
        buildPack: buildPack || null,
        port: port || null,
        healthCheckPath: healthCheckPath || null,
        replicas: replicas || 1,
        autoDeploy: false,
      },
    });

    const finalNamespace = generateProjectNamespace(name, project.id);
    await prisma.project.update({
      where: { id: project.id },
      data: { namespace: finalNamespace },
    });

    const k8sConfig = await k8sConfigManager.loadConfig();
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

        log.info(`Namespace ${finalNamespace} created with resource quota for project ${project.name}`);
      } catch (nsError: any) {
        log.error(`Failed to create namespace for project ${name}:`, nsError.message);
      }
    } else {
      log.warn(`K8s not connected, skipping namespace creation for project ${name}`);
      await prisma.managedNamespace.create({
        data: {
          projectId: project.id,
          name: finalNamespace,
          status: 'pending',
          labels: { 'project-id': project.id, 'workspace-id': workspaceId, 'user-id': userId },
          resourceQuota: await getUserResourceQuota(userId) as any,
        },
      });
    }

    const { image } = getRepoInfo(gitUrl);

    const appLabel = getAppLabel(user.email, slug);
    if (k8sConfig.connected) {
      try {
        await k8sDeployManager.createOrUpdateProjectConfig(finalNamespace, appLabel, {
          branch: branch || 'main',
          buildCommand: buildCommand || null,
          runCommand: runCommand || null,
          rootDir: rootDir || null,
        });
      } catch (cfgError: any) {
        log.warn(`Failed to save project config to K8s Secret: ${cfgError.message}`);
      }
    }

    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'active' },
    });

    const createdProject = await prisma.project.findUnique({
      where: { id: project.id },
      include: { domains: true },
    });

    reply.status(201).send({
      ...createdProject,
      previewUrl: createdProject?.domains?.find(d => d.isPrimary)?.domain || createdProject?.domains?.[0]?.domain || null,
    });
  } catch (error: any) {
    log.error('Failed to create project:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to create project' });
  }
}

export async function getProjectEnv(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as any;
    const userId = (request as any).userId!;

    const result = await getProjectForEnv(projectId, userId);
    if ('error' in result) {
      return reply.status(result.status!).send({ error: 'Not Found', message: result.error });
    }
    const { project } = result;

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const projectEnvFile = await k8sDeployManager.getProjectEnvVars(project.namespace, appLabel);

    const workspaceEnvFile = await k8sDeployManager.getWorkspaceEnvVars(project.namespace, project.workspaceId);

    reply.send({
      project: projectEnvFile,
      workspace: workspaceEnvFile,
    });
  } catch (error: any) {
    log.error('Failed to fetch env vars:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function setProjectEnv(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as any;
    const { key, value, isSecret, envContent } = request.body as any;
    const userId = (request as any).userId!;

    const result = await getProjectForEnv(projectId, userId);
    if ('error' in result) {
      return reply.status(result.status!).send({ error: 'Not Found', message: result.error });
    }
    const { project } = result;

    let varsToAdd: EnvVar[] = [];

    if (envContent) {
      varsToAdd = parseEnvContent(envContent);
    } else if (key && value !== undefined) {
      varsToAdd = [{ key, value, isSecret }];
    } else {
      return reply.status(400).send({ error: 'Bad Request', message: 'Provide either key/value or envContent' });
    }

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const envFile = await k8sDeployManager.getProjectEnvVars(project.namespace, appLabel);

    for (const v of varsToAdd) {
      envFile[v.key] = { key: v.key, value: v.value, isSecret: v.isSecret };
    }

    await k8sDeployManager.setProjectEnvVars(project.namespace, appLabel, envFile);

    reply.send({ message: 'Environment variables updated', env: envFile });
  } catch (error: any) {
    log.error('Failed to set env var:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function updateProjectEnv(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId, key } = request.params as any;
    const { value, isSecret } = request.body as any;
    const userId = (request as any).userId!;

    const result = await getProjectForEnv(projectId, userId);
    if ('error' in result) {
      return reply.status(result.status!).send({ error: 'Not Found', message: result.error });
    }
    const { project } = result;

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const envFile = await k8sDeployManager.getProjectEnvVars(project.namespace, appLabel);

    if (!envFile[key]) {
      return reply.status(404).send({ error: 'Not Found', message: 'Environment variable not found' });
    }

    if (value !== undefined) envFile[key].value = value;
    if (isSecret !== undefined) envFile[key].isSecret = isSecret;

    await k8sDeployManager.setProjectEnvVars(project.namespace, appLabel, envFile);

    reply.send(envFile[key]);
  } catch (error: any) {
    log.error('Failed to update env var:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function deleteProjectEnv(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId, key } = request.params as any;
    const userId = (request as any).userId!;

    const result = await getProjectForEnv(projectId, userId);
    if ('error' in result) {
      return reply.status(result.status!).send({ error: 'Not Found', message: result.error });
    }
    const { project } = result;

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const envFile = await k8sDeployManager.getProjectEnvVars(project.namespace, appLabel);

    if (!envFile[key]) {
      return reply.status(404).send({ error: 'Not Found', message: 'Environment variable not found' });
    }

    delete envFile[key];

    await k8sDeployManager.setProjectEnvVars(project.namespace, appLabel, envFile);

    reply.send({ message: 'Environment variable deleted' });
  } catch (error: any) {
    log.error('Failed to delete env var:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getProjectById(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const project = await prisma.project.findUnique({
      where: { id: (request.params as any).id },
      include: { workspace: true, domains: true },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const userRole = await getUserRole(userId, project.workspaceId);

    if (!userRole.isSuperAdmin && !userRole.isOwner && project.userId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    reply.send({
      ...project,
      previewUrl: project.domains?.find(d => d.isPrimary)?.domain || project.domains?.[0]?.domain || null,
    });
  } catch (error) {
    log.error('Failed to get project:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch project' });
  }
}

export async function updateProject(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const project = await prisma.project.findUnique({
      where: { id: (request.params as any).id },
      include: { workspace: true, user: true },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const userRole = await getUserRole(userId, project.workspaceId);

    if (!userRole.isSuperAdmin && !userRole.isOwner && project.userId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    const { name, description, gitUrl, status, branch, buildCommand, runCommand, rootDir, replicas, imageTag, autoDeploy } = request.body as any;

    const slug = name ? name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') : undefined;

    const updated = await prisma.project.update({
      where: { id: (request.params as any).id },
      data: {
        ...(name !== undefined && { name, slug }),
        ...(description !== undefined && { description }),
        ...(gitUrl !== undefined && { gitUrl }),
        ...(status !== undefined && { status }),
        ...(branch !== undefined && { branch }),
        ...(buildCommand !== undefined && { buildCommand }),
        ...(runCommand !== undefined && { runCommand }),
        ...(rootDir !== undefined && { rootDir }),
        ...(replicas !== undefined && { replicas }),
        ...(imageTag !== undefined && { currentImageTag: imageTag }),
        ...(autoDeploy !== undefined && { autoDeploy }),
      },
    });

    if (branch !== undefined || buildCommand !== undefined || runCommand !== undefined || rootDir !== undefined) {
      try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (k8sConfig.connected) {
          const appLabel = getAppLabel(project.user?.email, updated.slug);
          await k8sDeployManager.createOrUpdateProjectConfig(updated.namespace, appLabel, {
            branch: updated.branch,
            buildCommand: updated.buildCommand,
            runCommand: updated.runCommand,
            rootDir: updated.rootDir,
          });
        }
      } catch (cfgError: any) {
        log.warn(`Failed to update project config Secret: ${cfgError.message}`);
      }
    }

    if ((replicas !== undefined || imageTag !== undefined) && project.status !== 'creating') {
      try {
        const k8sConfig = await k8sConfigManager.loadConfig();
        if (k8sConfig.connected) {
          const { image } = getRepoInfo(project.gitUrl);
          const deployConfig: any = {
            image: imageTag ? `${image.split(':')[0]}` : image,
            tag: imageTag || project.currentImageTag || 'latest',
            port: 80,
            replicas: replicas ?? project.replicas,
          };

          const nsRecord = await prisma.managedNamespace.findUnique({ where: { projectId: project.id } });
          if (nsRecord?.resourceQuota) {
            const quota = nsRecord.resourceQuota as any;
            await k8sDeployManager.setResourceQuota(project.namespace, quota);
          }

          await k8sDeployManager.deployProject(project.id, project.namespace, deployConfig);

          await prisma.project.update({
            where: { id: project.id },
            data: { status: 'deployed' },
          });
          updated.status = 'deployed';

          emitK8sEvent('k8s:deployment:updated', { name: project.slug, namespace: project.namespace, replicas: replicas ?? project.replicas }, project.namespace);
        }
      } catch (deployError: any) {
        log.error(`Failed to update deployment for project ${project.name}:`, deployError.message);
      }
    }

    reply.send(updated);
  } catch (error) {
    log.error('Failed to update project:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to update project' });
  }
}

export async function deleteProject(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const project = await prisma.project.findUnique({
      where: { id: (request.params as any).id },
      include: { workspace: true },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const userRole = await getUserRole(userId, project.workspaceId);

    if (!userRole.isSuperAdmin && !userRole.isOwner && project.userId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Only admins, managers, or the project owner can delete' });
    }

    try {
      await k8sDeployManager.deleteNamespace(project.namespace);
      log.info(`Namespace ${project.namespace} deleted for project ${project.name}`);
    } catch (k8sError: any) {
      log.warn(`Failed to delete namespace ${project.namespace}:`, k8sError.message);
    }

    await prisma.deployment.deleteMany({ where: { projectId: project.id } });
    await prisma.cICDPipeline.deleteMany({ where: { projectId: project.id } });
    await prisma.project.delete({ where: { id: (request.params as any).id } });

    reply.status(204).send();
  } catch (error) {
    log.error('Failed to delete project:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete project' });
  }
}

export async function addDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as any;
    const { domain, isCustom, isPrimary } = request.body as any;
    const userId = (request as any).userId!;

    if (!domain) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Domain is required' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.workspace.ownerId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    if (isPrimary) {
      await prisma.domain.updateMany({
        where: { projectId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const domainRecord = await prisma.domain.create({
      data: {
        projectId,
        domain,
        isCustom: isCustom || false,
        isPrimary: isPrimary || false,
      },
    });

    reply.status(201).send(domainRecord);
  } catch (error: any) {
    log.error('Failed to add domain:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getDomains(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as any;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    const domains = await prisma.domain.findMany({
      where: { projectId },
    });

    reply.send(domains);
  } catch (error) {
    log.error('Failed to list domains:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to fetch domains' });
  }
}

export async function deleteDomain(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId, domainId } = request.params as any;
    const userId = (request as any).userId!;

    const domain = await prisma.domain.findUnique({
      where: { id: domainId },
      include: { project: { include: { workspace: true } } },
    });

    if (!domain || domain.projectId !== projectId) {
      return reply.status(404).send({ error: 'Not Found', message: 'Domain not found' });
    }

    if (domain.project.workspace.ownerId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    await prisma.domain.delete({ where: { id: domainId } });
    reply.status(204).send();
  } catch (error) {
    log.error('Failed to delete domain:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to delete domain' });
  }
}
