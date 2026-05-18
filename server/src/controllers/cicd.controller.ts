import { FastifyRequest, FastifyReply } from 'fastify';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';
import { k8sDeployManager } from '../lib/k8s-deploy.js';
import { containerBuilder } from '../lib/container-builder.js';
import { streamBuildLogs, checkJobStatus } from '../lib/build-streamer.js';
import { emitBuildLog } from '../lib/socket.js';
import prisma from '../lib/prisma.js';

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

export async function getPipelines(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as any;
    const userId = (request as any).userId!;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.userId !== userId) {
      const isOwner = project.workspace.ownerId === userId;
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: project.workspaceId, userId },
      });
      if (!isOwner && membership?.role !== 'ADMIN' && membership?.role !== 'MANAGER') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      }
    }

    const pipelines = await prisma.cICDPipeline.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    reply.send(pipelines);
  } catch (error: any) {
    log.error('Failed to get pipelines:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function triggerPipeline(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as any;
    const { branch, commitSha, commitMsg } = request.body as any;
    const userId = (request as any).userId!;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (project.userId !== userId) {
      const isOwner = project.workspace.ownerId === userId;
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: project.workspaceId, userId },
      });
      if (!isOwner && membership?.role !== 'ADMIN' && membership?.role !== 'MANAGER') {
        return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
      }
    }

    const pipeline = await prisma.cICDPipeline.create({
      data: {
        projectId,
        userId,
        gitUrl: project.gitUrl,
        branch: branch || project.branch || 'main',
        status: 'IDLE',
        lastCommitSha: commitSha,
        lastCommitMsg: commitMsg,
        triggeredBy: 'manual',
      },
    });

    reply.status(201).send(pipeline);

    runPipelineAsync(pipeline.id, project, branch || project.branch || 'main');
  } catch (error: any) {
    log.error('Failed to trigger pipeline:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function runPipelineAsync(pipelineId: string, project: any, branch: string) {
  const startTime = Date.now();
  let buildLog = '';

  const logLine = (msg: string) => {
    buildLog += msg + '\n';
    emitBuildLog(project.id, 'build:log', { text: msg + '\n', projectId: project.id });
  };

  try {
    await prisma.cICDPipeline.update({
      where: { id: pipelineId },
      data: { status: 'BUILDING' },
    });
    emitBuildLog(project.id, 'build:status', { status: 'building', message: 'Pipeline started' });

    logLine(`[BUILD] Starting build for ${project.name}`);
    logLine(`[BUILD] Repository: ${project.gitUrl}`);
    logLine(`[BUILD] Branch: ${branch}`);

    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) {
      throw new Error('Kubernetes not connected');
    }

    const buildResult = await containerBuilder.buildFromGit({
      gitUrl: project.gitUrl,
      branch,
      projectId: project.id,
      namespace: project.namespace,
    });

    logLine(`[BUILD] Image: ${buildResult.fullImage}`);

    await prisma.cICDPipeline.update({
      where: { id: pipelineId },
      data: { status: 'BUILDING', buildLog, imageTag: buildResult.imageTag },
    });

    const jobName = buildResult.jobName;

    if (jobName === 'local') {
      logLine(`[BUILD] Local Docker build succeeded`);
      const streamedLog = await streamBuildLogs(project.namespace, jobName, project.id);
      if (streamedLog) buildLog += streamedLog;
    } else {
      const streamedLog = await streamBuildLogs(project.namespace, jobName, project.id);
      if (streamedLog) buildLog += streamedLog;

      const finalStatus = await checkJobStatus(project.namespace, jobName);
      if (finalStatus === 'failed') {
        throw new Error('Build failed. Check build logs for details.');
      }
      if (finalStatus === 'running') {
        throw new Error('Build timed out. Check cluster resources.');
      }
    }

    logLine(`[BUILD] Image built successfully`);
    logLine(`[DEPLOY] Deploying to Kubernetes...`);

    await prisma.cICDPipeline.update({
      where: { id: pipelineId },
      data: { status: 'DEPLOYING', buildLog },
    });
    emitBuildLog(project.id, 'build:status', { status: 'deploying', message: 'Deploying to Kubernetes...' });

    const deployResult = await k8sDeployManager.deployProject(
      project.id,
      project.namespace,
      {
        image: buildResult.imageName,
        tag: buildResult.imageTag,
        port: 80,
        replicas: project.replicas || 1,
      }
    );

    logLine(`[DEPLOY] Deployment created/updated`);
    if (deployResult.service) {
      logLine(`[DEPLOY] Service: ${deployResult.service.metadata!.name}`);
    }

    const duration = Math.floor((Date.now() - startTime) / 1000);

    await prisma.cICDPipeline.update({
      where: { id: pipelineId },
      data: {
        status: 'SUCCESS',
        deployLog: buildLog,
        duration,
        imageTag: buildResult.imageTag,
      },
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'deployed', currentImageTag: buildResult.imageTag },
    });

    logLine(`[DONE] Deployment completed in ${duration}s`);
    emitBuildLog(project.id, 'build:status', { status: 'success', message: 'Deployment completed', duration });
  } catch (error: any) {
    logLine(`[ERROR] ${error.message}`);

    const duration = Math.floor((Date.now() - startTime) / 1000);

    await prisma.cICDPipeline.update({
      where: { id: pipelineId },
      data: {
        status: 'FAILED',
        buildLog,
        deployLog: buildLog,
        duration,
      },
    });

    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'deployment_failed' },
    });

    emitBuildLog(project.id, 'build:status', { status: 'failed', message: error.message, duration });
    log.error(`Pipeline ${pipelineId} failed:`, error.message);
  }
}

export async function handleWebhook(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { projectId } = request.params as any;
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: { workspace: true },
    });

    if (!project) {
      return reply.status(404).send({ error: 'Not Found', message: 'Project not found' });
    }

    if (!project.autoDeploy) {
      return reply.send({ message: 'Auto-deploy disabled, ignoring webhook' });
    }

    const commitSha = (request.body as any)?.after || (request.body as any)?.head_commit?.id || null;
    const commitMsg = (request.body as any)?.head_commit?.message || 'Auto-deploy via webhook';
    const ref = (request.body as any)?.ref || '';
    const branch = ref.replace('refs/heads/', '');

    if (branch && branch !== project.branch) {
      return reply.send({ message: `Branch ${branch} does not match project branch ${project.branch}, ignoring` });
    }

    const pipeline = await prisma.cICDPipeline.create({
      data: {
        projectId,
        userId: project.userId,
        gitUrl: project.gitUrl,
        branch: branch || project.branch || 'main',
        status: 'IDLE',
        lastCommitSha: commitSha,
        lastCommitMsg: commitMsg,
        triggeredBy: 'webhook',
      },
    });

    const projectForPipeline = {
      id: project.id,
      name: project.name,
      slug: project.slug,
      gitUrl: project.gitUrl,
      namespace: project.namespace,
      replicas: project.replicas,
      branch: project.branch,
      buildCommand: project.buildCommand,
      runCommand: project.runCommand,
      rootDir: project.rootDir,
      autoDeploy: project.autoDeploy,
    };

    runPipelineAsync(pipeline.id, projectForPipeline, branch || project.branch || 'main').catch((err: any) => {
      log.error(`Webhook pipeline failed for project ${project.name}:`, err.message);
    });

    reply.status(202).send({ message: 'Webhook received, pipeline triggered', pipelineId: pipeline.id });
  } catch (error: any) {
    log.error('Webhook handler error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function deletePipeline(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { pipelineId } = request.params as any;
    const userId = (request as any).userId!;

    const pipeline = await prisma.cICDPipeline.findUnique({
      where: { id: pipelineId },
      include: { project: true },
    });

    if (!pipeline) {
      return reply.status(404).send({ error: 'Not Found', message: 'Pipeline not found' });
    }

    if (pipeline.userId !== userId) {
      return reply.status(403).send({ error: 'Forbidden', message: 'Access denied' });
    }

    if (pipeline.status === 'BUILDING' || pipeline.status === 'DEPLOYING') {
      await prisma.cICDPipeline.update({
        where: { id: pipelineId },
        data: { status: 'CANCELLED' },
      });
    } else {
      await prisma.cICDPipeline.delete({ where: { id: pipelineId } });
    }

    reply.send({ message: 'Pipeline cancelled' });
  } catch (error: any) {
    log.error('Failed to delete pipeline:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
