import { FastifyRequest, FastifyReply } from 'fastify';
import * as k8s from '@kubernetes/client-node';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { spawnSync, execSync } from 'child_process';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';
import { k8sDeployManager } from '../lib/k8s-deploy.js';
import { containerBuilder } from '../lib/container-builder.js';
import { detectProjectType, detectFromFiles, generateDockerfileContent, generateBuildConfig, type BuildConfig } from '../lib/build-detector.js';
import { streamBuildLogs, checkJobStatus } from '../lib/build-streamer.js';
import { emitBuildLog, emitK8sEvent } from '../lib/socket.js';
import { getGhcrCredentials, getGhcrImageName, ensureGhcrPullSecretForProject, getAppToken, getUserInstallationToken } from '../lib/ghcr-auth.js';

type BuildPack = 'nixpacks' | 'heroku' | 'dockerfile' | 'docker-compose' | 'docker';

interface BuildOptions {
  branch?: string;
  buildPack?: BuildPack;
  buildCommand?: string;
  runCommand?: string;
  rootDir?: string;
  port?: number;
  healthCheckPath?: string;
  envVars?: Array<{ name: string; value: string }>;
}

function walkDir(dir: string, files: string[]): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git' && !entry.name.startsWith('.')) {
        walkDir(path.join(dir, entry.name), files);
      } else if (entry.isFile()) {
        files.push(entry.name);
      }
    }
  } catch { }
}

async function checkProjectAccess(projectId: string, userId: string): Promise<{ allowed: boolean; project?: any; error?: string; status?: number }> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { workspace: true },
  });
  if (!project) return { allowed: false, error: 'Project not found', status: 404 };
  if (project.workspace.ownerId === userId || project.userId === userId) return { allowed: true, project };
  const membership = await prisma.workspaceMember.findFirst({ where: { workspaceId: project.workspaceId, userId } });
  if (membership && (membership.role === 'ADMIN' || membership.role === 'MANAGER')) return { allowed: true, project };
  return { allowed: false, error: 'Access denied', status: 403 };
}

function getGitCloneUrl(gitUrl: string, token: string): string {
  if (gitUrl.startsWith('https://')) return gitUrl.replace('https://', `https://token:${token}@`);
  return gitUrl;
}

type LogCallback = (line: string) => void;

function spawnWithLog(cmd: string, args: string[], emit: LogCallback, opts?: { shell?: boolean; env?: NodeJS.ProcessEnv }): Promise<number> {
  return new Promise((resolve) => {
    const { spawn } = require('child_process');
    const proc = spawn(cmd, args, { shell: opts?.shell ?? false, env: opts?.env ?? process.env });
    proc.stdout?.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter((l: string) => l.trim()).forEach(emit);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter((l: string) => l.trim()).forEach((l: string) => {
        if (!l.startsWith('#')) emit(l);
      });
    });
    proc.on('close', (code: number | null) => resolve(code ?? 1));
    proc.on('error', () => resolve(1));
  });
}

function dockerAvailable(): boolean {
  try { execSync('docker --version', { stdio: 'pipe', timeout: 5000 }); return true; }
  catch { return false; }
}

async function cloneRepo(tmpDir: string, gitUrl: string, branch: string, userId: string, emit: LogCallback): Promise<void> {
  const installToken = await getUserInstallationToken(userId);
  const cloneUrl = installToken ? getGitCloneUrl(gitUrl, installToken) : gitUrl;
  emit(`[CLONE] Cloning ${gitUrl} (branch: ${branch})...`);
  const clone = spawnSync('git', ['clone', '--depth', '1', '--branch', branch, cloneUrl, tmpDir], { timeout: 120000 });
  if (clone.status !== 0) throw new Error(`Git clone failed: ${clone.stderr.toString().trim() || 'unknown error'}`);
  emit('[CLONE] Repository cloned');
}

async function ghcrLogin(ghcrCreds: { username: string; password: string }, emit: LogCallback): Promise<void> {
  emit('[GHCR] Logging in...');
  const login = spawnSync('docker', ['login', 'ghcr.io', '-u', ghcrCreds.username, '--password-stdin'], {
    input: ghcrCreds.password,
    timeout: 30000,
  });
  if (login.status !== 0) throw new Error(`GHCR login failed: ${login.stderr.toString().trim() || 'unknown error'}`);
  emit('[GHCR] Login successful');
}

async function ghcrPush(fullImage: string, emit: LogCallback): Promise<void> {
  emit(`[GHCR] Pushing ${fullImage}...`);
  const push = spawnSync('docker', ['push', fullImage], { timeout: 300000 });
  if (push.status !== 0) throw new Error(`Push failed: ${push.stderr.toString().trim() || 'unknown error'}`);
  emit('[GHCR] Push complete');
}

// ==================== DETECT ====================

export async function detectBuildConfig(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { projectId } = request.params as any;

  const access = await checkProjectAccess(projectId, userId);
  if (!access.allowed) return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });

  const project = access.project!;
  const tmpDir = path.join(os.tmpdir(), `k8s-detect-${project.id.slice(0, 8)}-${Date.now()}`);

  try {
    await cloneRepo(tmpDir, project.gitUrl, project.branch || 'main', userId, () => {});

    const files: string[] = [];
    walkDir(tmpDir, files);
    const fileSet = new Set(files.map(f => f.toLowerCase()));
    const detected = detectFromFiles(files);
    const buildConfig: BuildConfig = detected?.buildConfig || detectProjectType(project.gitUrl).buildConfig;

    const availableBuildPacks: Array<{ pack: BuildPack; label: string; description: string }> = [];
    availableBuildPacks.push({ pack: 'nixpacks', label: 'Nixpacks', description: 'Auto-detect & build with Nixpacks' });
    availableBuildPacks.push({ pack: 'heroku', label: 'Heroku Buildpacks', description: 'Build with Heroku buildpacks' });

    const hasDockerfile = fileSet.has('dockerfile');
    if (hasDockerfile) {
      availableBuildPacks.push({ pack: 'dockerfile', label: 'Dockerfile', description: 'Use existing Dockerfile' });
    }

    const hasDockerCompose = fileSet.has('docker-compose.yml') || fileSet.has('docker-compose.yaml') || fileSet.has('compose.yml') || fileSet.has('compose.yaml');
    if (hasDockerCompose) {
      availableBuildPacks.push({ pack: 'docker-compose', label: 'Docker Compose', description: 'Build via docker-compose' });
    }

    availableBuildPacks.push({ pack: 'docker', label: 'Docker (auto-generate)', description: 'Auto-generate Dockerfile & build' });

    let suggestedBuildPack: BuildPack = 'nixpacks';
    if (hasDockerfile && detected?.language === 'docker') suggestedBuildPack = 'dockerfile';
    else if (buildConfig.language !== 'unknown' && buildConfig.language !== 'git') suggestedBuildPack = 'docker';
    else if (hasDockerCompose) suggestedBuildPack = 'docker-compose';

    reply.send({
      language: buildConfig.language,
      framework: buildConfig.framework,
      port: buildConfig.port,
      healthCheckPath: buildConfig.healthCheckPath,
      hasDockerfile,
      hasDockerCompose,
      suggestedBuildPack,
      availableBuildPacks,
      buildConfig: {
        buildCommand: buildConfig.buildCommand,
        runCommand: buildConfig.runCommand,
        port: buildConfig.port,
      },
    });
  } catch (err: any) {
    reply.status(500).send({ error: 'Detection failed', message: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
  }
}

// ==================== DETECT (standalone, no projectId) ====================

export async function detectRepo(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { gitUrl, branch } = request.body as any;

  if (!gitUrl) return reply.status(400).send({ error: 'Bad Request', message: 'gitUrl is required' });

  const tmpDir = path.join(os.tmpdir(), `k8s-detect-${Date.now()}`);

  try {
    await cloneRepo(tmpDir, gitUrl, branch || 'main', userId, () => {});

    const files: string[] = [];
    walkDir(tmpDir, files);
    const fileSet = new Set(files.map(f => f.toLowerCase()));
    const detected = detectFromFiles(files);
    const buildConfig: BuildConfig = detected?.buildConfig || detectProjectType(gitUrl).buildConfig;

    const availableBuildPacks: Array<{ pack: BuildPack; label: string; description: string }> = [];
    availableBuildPacks.push({ pack: 'nixpacks', label: 'Nixpacks', description: 'Auto-detect & build with Nixpacks' });
    availableBuildPacks.push({ pack: 'heroku', label: 'Heroku Buildpacks', description: 'Build with Heroku buildpacks' });

    const hasDockerfile = fileSet.has('dockerfile');
    if (hasDockerfile) {
      availableBuildPacks.push({ pack: 'dockerfile', label: 'Dockerfile', description: 'Use existing Dockerfile' });
    }

    const hasDockerCompose = fileSet.has('docker-compose.yml') || fileSet.has('docker-compose.yaml') || fileSet.has('compose.yml') || fileSet.has('compose.yaml');
    if (hasDockerCompose) {
      availableBuildPacks.push({ pack: 'docker-compose', label: 'Docker Compose', description: 'Build via docker-compose' });
    }

    availableBuildPacks.push({ pack: 'docker', label: 'Docker (auto-generate)', description: 'Auto-generate Dockerfile & build' });

    let suggestedBuildPack: BuildPack = 'nixpacks';
    if (hasDockerfile && detected?.language === 'docker') suggestedBuildPack = 'dockerfile';
    else if (buildConfig.language !== 'unknown' && buildConfig.language !== 'git') suggestedBuildPack = 'docker';
    else if (hasDockerCompose) suggestedBuildPack = 'docker-compose';

    reply.send({
      language: buildConfig.language,
      framework: buildConfig.framework,
      port: buildConfig.port,
      healthCheckPath: buildConfig.healthCheckPath,
      hasDockerfile,
      hasDockerCompose,
      suggestedBuildPack,
      availableBuildPacks,
      buildConfig: {
        buildCommand: buildConfig.buildCommand,
        runCommand: buildConfig.runCommand,
        port: buildConfig.port,
      },
    });
  } catch (err: any) {
    reply.status(500).send({ error: 'Detection failed', message: err.message });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
  }
}

// ==================== BUILD ====================

export async function buildProject(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { projectId } = request.params as any;
  const body = request.body as BuildOptions;

  const access = await checkProjectAccess(projectId, userId);
  if (!access.allowed) return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });

  const project = access.project!;
  const ghcrCreds = await getGhcrCredentials(userId);
  if (!ghcrCreds) return reply.status(400).send({ error: 'Bad Request', message: 'GitHub not connected. Install the GitHub App first.' });

  const deployment = await prisma.deployment.create({
    data: { projectId, environment: 'production', version: `build-${Date.now()}`, status: 'building' },
  });

  const imageTag = deployment.id;
  const fullImage = getGhcrImageName(ghcrCreds.imageUser, project.name, imageTag);

  reply.status(202).send({ message: 'Build started', deploymentId: deployment.id, image: fullImage, buildPack: body.buildPack || 'nixpacks' });

  runBuild(project, ghcrCreds, fullImage, imageTag, deployment.id, body).catch((err: any) => {
    log.error(`Build failed for ${project.name}:`, err.message);
  });
}

async function runBuild(project: any, ghcrCreds: { username: string; password: string; imageUser: string }, fullImage: string, imageTag: string, deploymentId: string, opts: BuildOptions) {
  const emit = (line: string) => {
    emitBuildLog(project.id, 'build:log', { text: line + '\n', projectId: project.id });
  };

  const branch = opts.branch || project.branch || 'main';
  const buildPack: BuildPack = (opts.buildPack || project.buildPack || 'nixpacks') as BuildPack;
  const buildRef = `build-${project.id.slice(0, 8)}-${Date.now()}`;
  const tmpDir = path.join(os.tmpdir(), `k8s-build-${project.id.slice(0, 8)}-${Date.now()}`);

  try {
    emit(`[BUILD] Starting build for ${project.name}`);
    emit(`[BUILD] Build pack: ${buildPack}`);

    await cloneRepo(tmpDir, project.gitUrl, branch, project.userId, emit);

    const files: string[] = [];
    walkDir(tmpDir, files);
    const fileSet = new Set(files.map(f => f.toLowerCase()));
    const buildConfig: BuildConfig = (detectFromFiles(files)?.buildConfig || detectProjectType(project.gitUrl).buildConfig);
    emit(`[BUILD] Detected: ${buildConfig.language}${buildConfig.framework ? ` (${buildConfig.framework})` : ''}`);

    if (!dockerAvailable()) {
      emit('[BUILD] Docker not available locally, using Kaniko in-cluster build...');
      await buildWithKaniko(project, fullImage, project.gitUrl, branch, buildConfig, imageTag, emit);
      await finalizeBuild(project, deploymentId, imageTag, fullImage, buildRef, buildPack, emit);
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
      return;
    }

    switch (buildPack) {
      case 'nixpacks':
        await buildWithNixpacks(tmpDir, fullImage, emit);
        break;
      case 'heroku':
        await buildWithHeroku(tmpDir, fullImage, opts, emit);
        break;
      case 'dockerfile':
        await buildWithDockerfile(tmpDir, fullImage, emit);
        break;
      case 'docker-compose':
        await buildWithDockerCompose(tmpDir, fullImage, fileSet, emit);
        break;
      case 'docker':
        await buildWithAutoDocker(tmpDir, fullImage, buildConfig, fileSet, emit);
        break;
      default:
        await buildWithNixpacks(tmpDir, fullImage, emit);
    }

    await ghcrLogin(ghcrCreds, emit);
    await ghcrPush(fullImage, emit);
    await finalizeBuild(project, deploymentId, imageTag, fullImage, buildRef, buildPack, emit);

    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { }
  } catch (err: any) {
    emit(`[BUILD] ERROR: ${err.message}`);
    emitBuildLog(project.id, 'build:status', { status: 'failed', message: err.message });
    await prisma.deployment.update({ where: { id: deploymentId }, data: { status: 'failed', config: { error: err.message } as any } }).catch(() => {});
    await prisma.project.update({ where: { id: project.id }, data: { status: 'build_failed' } }).catch(() => {});
  }
}

async function finalizeBuild(project: any, deploymentId: string, imageTag: string, fullImage: string, buildRef: string, buildPack: string, emit: LogCallback) {
  emit(`[BUILD] Build completed: ${fullImage}`);
  emitBuildLog(project.id, 'build:status', { status: 'success', message: 'Build completed', image: fullImage, buildPack });
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: 'built', imageTag, config: { image: fullImage, buildRef, buildPack } as any },
  });
  await prisma.project.update({ where: { id: project.id }, data: { currentImageTag: imageTag, status: 'built' } });
}

// ----- Build Pack: Nixpacks -----

async function buildWithNixpacks(tmpDir: string, fullImage: string, emit: LogCallback): Promise<void> {
  emit('[NIXPACKS] Pulling builder image...');
  try { execSync('docker pull railwayapp/nixpacks:latest', { stdio: 'pipe', timeout: 60000 }); }
  catch (e: any) { throw new Error(`Nixpacks pull failed: ${e.message}`); }

  emit('[NIXPACKS] Building...');
  const start = Date.now();
  const code = await spawnWithLog('docker', [
    'run', '--rm',
    '-v', `${tmpDir}:/app`,
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    'railwayapp/nixpacks', 'build', '/app',
    '--name', fullImage,
  ], emit);

  if (code !== 0) throw new Error('Nixpacks build failed');
  emit(`[NIXPACKS] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

// ----- Build Pack: Heroku Buildpacks -----

async function buildWithHeroku(tmpDir: string, fullImage: string, opts: BuildOptions, emit: LogCallback): Promise<void> {
  const buildDir = opts.rootDir ? path.join(tmpDir, opts.rootDir) : tmpDir;

  emit('[HEROKU] Pulling herokuish builder...');
  try { execSync('docker pull gliderlabs/herokuish:latest', { stdio: 'pipe', timeout: 60000 }); }
  catch (e: any) { throw new Error(`herokuish pull failed: ${e.message}`); }

  emit('[HEROKU] Detecting buildpack...');
  const detect = spawnSync('docker', [
    'run', '--rm',
    '-v', `${buildDir}:/app`,
    'gliderlabs/herokuish', '/build',
  ], { timeout: 120000 });
  if (detect.status !== 0) {
    emit(`[HEROKU] Detect output: ${detect.stdout.toString().trim()}`);
    emit(`[HEROKU] Detect errors: ${detect.stderr.toString().trim()}`);
    throw new Error('Heroku buildpack detection failed');
  }

  emit('[HEROKU] Building...');
  const code = await spawnWithLog('docker', [
    'run', '--rm',
    '-v', `${buildDir}:/app`,
    '-v', '/var/run/docker.sock:/var/run/docker.sock',
    'gliderlabs/herokuish', '/build',
  ], emit);

  if (code !== 0) throw new Error('Heroku build failed');

  emit('[HEROKU] Building final image...');
  const dockerfile = `
FROM gliderlabs/herokuish:latest
COPY --from=0 /app /app
ENTRYPOINT ["/start"]
`;
  const dfPath = path.join(os.tmpdir(), `Dockerfile.heroku.${Date.now()}`);
  fs.writeFileSync(dfPath, dockerfile.trim());
  const buildCode = await spawnWithLog('docker', ['build', '-t', fullImage, '-f', dfPath, tmpDir], emit);
  try { fs.rmSync(dfPath); } catch { }

  if (buildCode !== 0) throw new Error('Heroku final image build failed');
  emit('[HEROKU] Build complete');
}

// ----- Build Pack: Dockerfile -----

async function buildWithDockerfile(tmpDir: string, fullImage: string, emit: LogCallback): Promise<void> {
  const dfPath = path.join(tmpDir, 'Dockerfile');
  if (!fs.existsSync(dfPath)) {
    const altDf = path.join(tmpDir, 'dockerfile');
    if (fs.existsSync(altDf)) {
      fs.renameSync(altDf, dfPath);
    } else {
      throw new Error('No Dockerfile found in repository');
    }
  }
  const content = fs.readFileSync(dfPath, 'utf-8').trim();
  if (!content || (!content.startsWith('FROM') && !content.startsWith('#'))) {
    throw new Error('Dockerfile is empty or invalid');
  }
  emit('[DOCKERFILE] Building with existing Dockerfile...');
  const start = Date.now();
  const code = await spawnWithLog('docker', ['build', '-t', fullImage, tmpDir], emit);
  if (code !== 0) throw new Error('Dockerfile build failed');
  emit(`[DOCKERFILE] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

// ----- Build Pack: Docker Compose -----

async function buildWithDockerCompose(tmpDir: string, fullImage: string, fileSet: Set<string>, emit: LogCallback): Promise<void> {
  const composeFiles = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];
  let composeFile = '';
  for (const f of composeFiles) {
    if (fileSet.has(f) || fs.existsSync(path.join(tmpDir, f))) {
      composeFile = path.join(tmpDir, f);
      break;
    }
  }
  if (!composeFile) throw new Error('No docker-compose file found');

  emit('[COMPOSE] Building via docker-compose...');
  const start = Date.now();

  const env = { ...process.env, COMPOSE_FILE: composeFile };
  const code = await spawnWithLog('docker-compose', ['build'], emit, { env });

  if (code !== 0) {
    const code2 = await spawnWithLog('docker', ['compose', 'build'], emit, { env });
    if (code2 !== 0) throw new Error('Docker Compose build failed');
  }

  emit(`[COMPOSE] Build done in ${((Date.now() - start) / 1000).toFixed(1)}s`);

  let mainService = '';
  try {
    const yaml = await import('yaml');
    const composeContent = fs.readFileSync(composeFile, 'utf-8');
    const parsed = yaml.parse(composeContent);
    const services = parsed.services || {};
    const serviceNames = Object.keys(services);
    mainService = serviceNames[0] || '';
  } catch { mainService = 'app'; }

  if (mainService) {
    emit(`[COMPOSE] Tagging service ${mainService} as ${fullImage}...`);
    const tagCode = await spawnWithLog('docker', ['tag', `${mainService}:latest`, fullImage], emit);
    if (tagCode !== 0) throw new Error(`Failed to tag ${mainService} as ${fullImage}`);
  }
}

// ----- Build Pack: Docker (auto-generate) -----

async function buildWithAutoDocker(tmpDir: string, fullImage: string, buildConfig: BuildConfig, fileSet: Set<string>, emit: LogCallback): Promise<void> {
  const dfPath = path.join(tmpDir, 'Dockerfile');
  let hasDockerfile = fs.existsSync(dfPath);

  if (hasDockerfile) {
    const content = fs.readFileSync(dfPath, 'utf-8').trim();
    if (content && (content.startsWith('FROM') || content.startsWith('#'))) {
      emit('[DOCKER] Using existing Dockerfile from repo');
      const code = await spawnWithLog('docker', ['build', '-t', fullImage, tmpDir], emit);
      if (code !== 0) throw new Error('Docker build failed');
      return;
    }
    hasDockerfile = false;
  }

  let config = buildConfig;
  let generated = generateDockerfileContent(config);
  if (generated === 'Dockerfile' || !generated.startsWith('FROM')) {
    config = generateBuildConfig('javascript', 'node');
    generated = generateDockerfileContent(config);
  }
  fs.writeFileSync(dfPath, generated);
  emit(`[DOCKER] Generated Dockerfile for ${config.language}${config.framework ? ` (${config.framework})` : ''}`);

  const start = Date.now();
  const code = await spawnWithLog('docker', ['build', '-t', fullImage, tmpDir], emit);
  if (code !== 0) throw new Error('Docker build failed');
  emit(`[DOCKER] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
}

// ----- Kaniko Fallback -----

async function buildWithKaniko(project: any, fullImage: string, cloneUrl: string, branch: string, buildConfig: BuildConfig, imageTag: string, emit: LogCallback): Promise<void> {
  const namespace = project.namespace;
  const jobName = `kaniko-build-${project.id.slice(0, 6)}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 63);
  emit(`[KANIKO] Starting in-cluster build: ${fullImage}`);

  const ghcrCreds = await getGhcrCredentials(project.userId);
  let dockerConfigMap: k8s.V1ConfigMap | undefined;
  if (ghcrCreds) {
    const dockerConfig = JSON.stringify({
      auths: { 'ghcr.io': { auth: Buffer.from(`${ghcrCreds.username}:${ghcrCreds.password}`).toString('base64') } },
    });
    dockerConfigMap = { metadata: { name: 'docker-config', namespace }, data: { 'config.json': dockerConfig } };
    const coreApi = k8sConfigManager.coreApi;
    try { await coreApi.readNamespacedConfigMap('docker-config', namespace); await coreApi.replaceNamespacedConfigMap('docker-config', namespace, dockerConfigMap); }
    catch { await coreApi.createNamespacedConfigMap(namespace, dockerConfigMap); }
  }

  const job: k8s.V1Job = {
    apiVersion: 'batch/v1', kind: 'Job',
    metadata: { name: jobName, namespace, labels: { 'project-id': project.id, 'build-type': 'kaniko-ghcr' } },
    spec: {
      template: {
        metadata: { labels: { 'project-id': project.id, 'job-type': 'build' } },
        spec: {
          containers: [{
            name: 'kaniko', image: 'gcr.io/kaniko-project/executor:latest',
            args: [
              `--context=git://${cloneUrl.replace(/^https?:\/\//, '')}`,
              `--git=branch=${branch}`, `--destination=${fullImage}`,
              '--cache=true', '--cache-ttl=24h',
            ],
            volumeMounts: dockerConfigMap ? [{ name: 'docker-config', mountPath: '/kaniko/.docker' }] : undefined,
            resources: { requests: { cpu: '100m', memory: '256Mi' }, limits: { cpu: '1', memory: '2Gi' } },
          }],
          volumes: dockerConfigMap ? [{ name: 'docker-config', configMap: { name: 'docker-config' } }] : undefined,
          restartPolicy: 'Never',
        },
      },
      backoffLimit: 0, ttlSecondsAfterFinished: 3600,
    },
  };

  const batchApi = k8sConfigManager.batchApi;
  try { await batchApi.createNamespacedJob(namespace, job); emit(`[KANIKO] Job created: ${jobName}`); }
  catch (err: any) { emit(`[KANIKO] Job creation failed: ${err.message}`); throw err; }

  const streamedLog = await streamBuildLogs(namespace, jobName, project.id);
  if (streamedLog) streamedLog.split('\n').forEach(l => l.trim() && emit(l));

  const finalStatus = await checkJobStatus(namespace, jobName);
  if (finalStatus === 'failed') throw new Error('Kaniko build failed');
  if (finalStatus !== 'success') {
    const waitResult = await containerBuilder.waitForBuild(jobName, namespace, 600000);
    if (!waitResult) throw new Error('Kaniko build timed out or failed');
  }
}

// ==================== DEPLOY ====================

export async function deployProject(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { projectId } = request.params as any;
  const { deploymentId, envVars, replicas, resources, domain } = request.body as any;

  const access = await checkProjectAccess(projectId, userId);
  if (!access.allowed) return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });

  const project = access.project!;

  let deployment;
  if (deploymentId) {
    deployment = await prisma.deployment.findUnique({ where: { id: deploymentId } });
    if (!deployment || deployment.projectId !== projectId) return reply.status(404).send({ error: 'Not Found', message: 'Deployment not found' });
  } else {
    deployment = await prisma.deployment.findFirst({ where: { projectId, status: 'built' }, orderBy: { createdAt: 'desc' } });
    if (!deployment) return reply.status(400).send({ error: 'Bad Request', message: 'No built deployment found. Run BUILD first.' });
  }

  const ghcrCreds = await getGhcrCredentials(userId);
  if (!ghcrCreds) return reply.status(400).send({ error: 'Bad Request', message: 'GitHub not connected.' });

  const fullImage = getGhcrImageName(ghcrCreds.imageUser, project.name, deployment.imageTag || deployment.id);
  reply.status(202).send({ message: 'Deploy started', image: fullImage });

  runDeploy(project, deployment, fullImage, envVars || [], replicas, resources, domain).catch((err: any) => {
    log.error(`Deploy failed for ${project.name}:`, err.message);
  });
}

async function runDeploy(project: any, deployment: any, fullImage: string, envVars: Array<{ name: string; value: string }>, replicas?: number, resources?: any, domain?: string) {
  const emit = (line: string) => {
    emitBuildLog(project.id, 'build:log', { text: line + '\n', projectId: project.id });
  };

  try {
    emit('[DEPLOY] Pull secret for GHCR...');
    const pullSecretName = await ensureGhcrPullSecretForProject(project.id, project.namespace);
    if (!pullSecretName) emit('[DEPLOY] WARNING: Could not create GHCR pull secret');

    const userPrefix = await getUserEmailPrefix(project.userId);
    const appLabel = `app-${userPrefix}-${project.slug}`;
    const deployConfig = (deployment?.config || {}) as any;
    const deployPort = deployConfig.port || project.port || 80;
    const healthCheckPath = deployConfig.healthCheckPath || project.healthCheckPath || '/';

    emit(`[DEPLOY] Deploying ${fullImage} to ${project.namespace}...`);

    const envMap = new Map<string, string>();
    for (const ev of envVars) envMap.set(ev.name, ev.value);
    try {
      const projectEnvFile = await k8sDeployManager.getProjectEnvVars(project.namespace, appLabel);
      for (const [, v] of Object.entries(projectEnvFile)) envMap.set(v.key, v.value);
    } catch { }

    const secretVars = Array.from(envMap.entries()).map(([name]) => ({
      name, valueFrom: { secretKeyRef: { name: `${appLabel}-secrets`, key: name } },
    }));

    await k8sDeployManager.createOrUpdateSecret(project.namespace, appLabel, envMap);

    const coreApi = k8sConfigManager.coreApi;
    const appsApi = k8sConfigManager.appsApi;

    const container: k8s.V1Container = {
      name: appLabel, image: fullImage, ports: [{ containerPort: deployPort }], env: secretVars,
      resources: resources || { limits: { cpu: '500m', memory: '256Mi' }, requests: { cpu: '100m', memory: '128Mi' } },
      livenessProbe: { httpGet: { path: healthCheckPath, port: deployPort }, initialDelaySeconds: 30, periodSeconds: 10 },
      readinessProbe: { httpGet: { path: healthCheckPath, port: deployPort }, initialDelaySeconds: 5, periodSeconds: 5 },
    };

    const deploymentManifest: k8s.V1Deployment = {
      metadata: { name: appLabel, namespace: project.namespace, labels: { app: appLabel, 'user-prefix': userPrefix } },
      spec: {
        replicas: replicas || project.replicas || 1,
        selector: { matchLabels: { app: appLabel } },
        template: {
          metadata: { labels: { app: appLabel } },
          spec: { containers: [container], imagePullSecrets: pullSecretName ? [{ name: pullSecretName }] : undefined },
        },
      },
    };

    try { await appsApi.readNamespacedDeployment(appLabel, project.namespace); await appsApi.replaceNamespacedDeployment(appLabel, project.namespace, deploymentManifest); emit('[DEPLOY] Deployment updated'); }
    catch { await appsApi.createNamespacedDeployment(project.namespace, deploymentManifest); emit('[DEPLOY] Deployment created'); }

    const serviceName = `${appLabel}-svc`;
    const service: k8s.V1Service = {
      metadata: { name: serviceName, namespace: project.namespace, labels: { app: appLabel } },
      spec: { selector: { app: appLabel }, ports: [{ port: 80, targetPort: deployPort, protocol: 'TCP' }], type: 'ClusterIP' },
    };

    try { await coreApi.readNamespacedService(serviceName, project.namespace); await coreApi.replaceNamespacedService(serviceName, project.namespace, service); }
    catch { await coreApi.createNamespacedService(project.namespace, service); }
    emit('[DEPLOY] Service created/updated');

    if (domain) {
      try { await k8sDeployManager.createOrUpdateIngress(project.namespace, appLabel, domain, serviceName, 80); emit(`[DEPLOY] Ingress created for ${domain}`); }
      catch (err: any) { emit(`[DEPLOY] Ingress setup skipped: ${err.message}`); }
    }

    await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'deployed', deployedAt: new Date(), config: { image: fullImage } as any } });
    await prisma.project.update({ where: { id: project.id }, data: { status: 'deployed', currentImageTag: deployment.imageTag || deployment.id } });

    emit(`[DEPLOY] Deployed: ${fullImage}`);
    emitBuildLog(project.id, 'build:status', { status: 'success', message: 'Deployment completed' });
    emitK8sEvent('k8s:deployment:created', { name: appLabel, namespace: project.namespace, image: fullImage }, project.namespace);
  } catch (err: any) {
    emit(`[DEPLOY] ERROR: ${err.message}`);
    emitBuildLog(project.id, 'build:status', { status: 'failed', message: err.message });
    await prisma.deployment.update({ where: { id: deployment.id }, data: { status: 'failed' } }).catch(() => {});
    await prisma.project.update({ where: { id: project.id }, data: { status: 'deployment_failed' } }).catch(() => {});
  }
}

// ==================== RUN ====================

export async function runProject(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { projectId } = request.params as any;
  const { envVars, image: overrideImage } = request.body as any;

  const access = await checkProjectAccess(projectId, userId);
  if (!access.allowed) return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });

  const project = access.project!;
  const deployment = await prisma.deployment.findFirst({ where: { projectId, status: 'built' }, orderBy: { createdAt: 'desc' } });

  if (!deployment && !overrideImage) return reply.status(400).send({ error: 'Bad Request', message: 'No built image found. Run BUILD first or provide an image.' });

  let fullImage: string;
  if (overrideImage) fullImage = overrideImage;
  else {
    const ghcrCreds = await getGhcrCredentials(userId);
    if (!ghcrCreds) return reply.status(400).send({ error: 'Bad Request', message: 'GitHub not connected.' });
    fullImage = getGhcrImageName(ghcrCreds.imageUser, project.name, deployment!.imageTag || deployment!.id);
  }

  const pullSecretName = await ensureGhcrPullSecretForProject(project.id, project.namespace);
  reply.status(202).send({ message: 'Run pod starting', image: fullImage });

  runPod(project, fullImage, envVars || [], pullSecretName).catch((err: any) => {
    log.error(`Run pod failed for ${project.name}:`, err.message);
  });
}

async function getUserEmailPrefix(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user?.email) return userId.slice(0, 8);
  return user.email.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20);
}

async function runPod(project: any, fullImage: string, envVars: Array<{ name: string; value: string }>, pullSecretName: string | null) {
  const emit = (line: string) => {
    emitBuildLog(project.id, 'build:log', { text: line + '\n', projectId: project.id });
  };

  try {
    const userPrefix = await getUserEmailPrefix(project.userId);
    const deployName = `run-${userPrefix}-${project.slug}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 63);
    const appLabel = `app-${userPrefix}-${project.slug}`;

    const envMap = new Map<string, string>();
    for (const ev of envVars) envMap.set(ev.name, ev.value);
    try {
      const projectEnvFile = await k8sDeployManager.getProjectEnvVars(project.namespace, appLabel);
      for (const [, v] of Object.entries(projectEnvFile)) { if (!envMap.has(v.key)) envMap.set(v.key, v.value); }
    } catch { }

    const secretKeyRefs: Array<{ name: string; valueFrom: any }> = [];
    const secretName = `${appLabel}-run-secrets`;
    await k8sDeployManager.createOrUpdateSecret(project.namespace, appLabel + '-run', envMap);
    for (const [name] of envMap) {
      secretKeyRefs.push({ name, valueFrom: { secretKeyRef: { name: secretName, key: name } } });
    }

    emit(`[RUN] Creating deployment: ${deployName}`);

    const container: k8s.V1Container = {
      name: appLabel,
      image: fullImage,
      env: secretKeyRefs,
      resources: { limits: { cpu: '200m', memory: '256Mi' }, requests: { cpu: '100m', memory: '128Mi' } },
    };

    const deployment: k8s.V1Deployment = {
      metadata: {
        name: deployName,
        namespace: project.namespace,
        labels: { app: appLabel, 'project-id': project.id, 'deploy-type': 'run', 'user-prefix': userPrefix },
        annotations: { 'created-by': 'k8s-platform-run' },
      },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: appLabel, 'deploy-type': 'run' } },
        template: {
          metadata: { labels: { app: appLabel, 'deploy-type': 'run' } },
          spec: {
            containers: [container],
            imagePullSecrets: pullSecretName ? [{ name: pullSecretName }] : undefined,
          },
        },
      },
    };

    const appsApi = k8sConfigManager.appsApi;
    const coreApi = k8sConfigManager.coreApi;
    await appsApi.createNamespacedDeployment(project.namespace, deployment);
    emit(`[RUN] Deployment created: ${deployName}`);

    let podIP = '';
    let phase = '';
    const startTime = Date.now();
    while (Date.now() - startTime < 60000) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const podList = await coreApi.listNamespacedPod(project.namespace, undefined, undefined, undefined, undefined, `app=${appLabel},deploy-type=run`);
        if (podList.body.items.length > 0) {
          const pod = podList.body.items[0];
          phase = pod.status?.phase || '';
          podIP = pod.status?.podIP || '';
          if (phase === 'Running') { emit(`[RUN] Pod running: IP=${podIP}`); break; }
          if (phase === 'Succeeded' || phase === 'Failed') { emit(`[RUN] Pod finished: ${phase}`); break; }
          emit(`[RUN] Pod status: ${phase}`);
        }
      } catch { break; }
    }

    const serviceName = `${appLabel}-svc`;
    const svc: k8s.V1Service = {
      metadata: { name: serviceName, namespace: project.namespace, labels: { app: appLabel } },
      spec: { selector: { app: appLabel }, ports: [{ port: 80, targetPort: 80, protocol: 'TCP' }] },
    };
    try { await coreApi.createNamespacedService(project.namespace, svc); } catch { }

    const runUrl = podIP ? `http://${podIP}:80` : `http://${serviceName}.${project.namespace}.svc.cluster.local:80`;
    emit(`[RUN] Access at: ${runUrl}`);

    await prisma.deployment.create({ data: { projectId: project.id, environment: 'run', version: `run-${Date.now()}`, status: 'running', imageTag: fullImage.split(':').pop() || '', config: { deployName, podIP, runUrl, envKeys: Array.from(envMap.keys()) } as any } });
    emitBuildLog(project.id, 'build:status', { status: 'running', message: `Run deployment active: ${deployName}`, url: runUrl, deployName });
  } catch (err: any) {
    emit(`[RUN] ERROR: ${err.message}`);
    emitBuildLog(project.id, 'build:status', { status: 'failed', message: err.message });
  }
}

// ==================== STATUS ====================

export async function getPipelineStatus(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { projectId } = request.params as any;
  const access = await checkProjectAccess(projectId, userId);
  if (!access.allowed) return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });
  const project = access.project!;
  const deployments = await prisma.deployment.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' }, take: 10 });
  reply.send({
    project: { id: project.id, name: project.name, status: project.status, currentImageTag: project.currentImageTag },
    deployments: deployments.map(d => ({ id: d.id, version: d.version, status: d.status, imageTag: d.imageTag, environment: d.environment, deployedAt: d.deployedAt, createdAt: d.createdAt })),
  });
}

export async function cancelRunPod(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).userId!;
  const { projectId } = request.params as any;
  const { deployName } = request.body as any;
  const access = await checkProjectAccess(projectId, userId);
  if (!access.allowed) return reply.status(access.status!).send({ error: 'Forbidden', message: access.error });

  const project = access.project!;
  const appsApi = k8sConfigManager.appsApi;
  const coreApi = k8sConfigManager.coreApi;
  try {
    const deployNames: string[] = [];
    if (deployName) deployNames.push(deployName);
    else {
      const deployList = await appsApi.listNamespacedDeployment(project.namespace, undefined, undefined, undefined, undefined, `project-id=${project.id},deploy-type=run`);
      for (const d of deployList.body.items) deployNames.push(d.metadata!.name!);
    }
    for (const dn of deployNames) {
      try {
        await appsApi.deleteNamespacedDeployment(dn, project.namespace);
        emitBuildLog(project.id, 'build:log', { text: `[RUN] Deployment deleted: ${dn}\n`, projectId });
      } catch { }
    }
    const userPrefix = await getUserEmailPrefix(userId);
    const appLabel = `app-${userPrefix}-${project.slug}`;
    try { await coreApi.deleteNamespacedService(`${appLabel}-svc`, project.namespace); } catch { }
    reply.send({ message: `Deleted ${deployNames.length} run deployment(s)` });
  } catch (err: any) { reply.status(500).send({ error: 'Internal Server Error', message: err.message }); }
}
