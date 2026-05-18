import * as k8s from '@kubernetes/client-node';
import path from 'path';
import os from 'os';
import { spawnSync, spawn, execSync } from 'child_process';
import fs from 'fs';
import log from './logger.js';
import { k8sConfigManager } from './k8s-config.js';
import { BuildConfig, generateDockerfileContent, detectProjectType, detectFromFiles } from './build-detector.js';

export interface BuildRequest {
  gitUrl: string;
  branch?: string;
  projectId: string;
  namespace: string;
  buildConfig?: BuildConfig;
  dockerfileContent?: string;
}

export interface BuildResult {
  imageName: string;
  imageTag: string;
  fullImage: string;
  buildConfig: BuildConfig;
  jobName: string;
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
  } catch (error) { log.warn(`[container-builder] walkDir failed: ${(error as Error).message}`); }
}

function dockerAvailable(): boolean {
  try { execSync('docker --version', { stdio: 'pipe', timeout: 5000 }); return true; }
  catch { return false; }
}

type LogCallback = (line: string) => void;

function spawnWithLog(cmd: string, args: string[], emit: LogCallback, opts?: { shell?: boolean; env?: NodeJS.ProcessEnv }): Promise<number> {
  return new Promise((resolve) => {
    const proc = spawn(cmd, args, { shell: opts?.shell ?? false, env: opts?.env ?? process.env });
    proc.stdout?.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter((l: string) => l.trim()).forEach(emit);
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      chunk.toString().split('\n').filter((l: string) => l.trim()).forEach((l: string) => {
        if (!l.startsWith('#')) emit(l);
      });
    });
    proc.on('close', (code) => resolve(code ?? 1));
    proc.on('error', () => resolve(1));
  });
}

export class ContainerBuilder {
  private get batchApi() { return k8sConfigManager.batchApi; }
  private get coreApi() { return k8sConfigManager.coreApi; }
  private get appsApi() { return k8sConfigManager.appsApi; }

  async buildFromGit(buildReq: BuildRequest, onLog?: LogCallback): Promise<BuildResult> {
    const { gitUrl, branch, projectId, namespace, buildConfig: providedConfig } = buildReq;

    const imageTag = `${projectId.slice(0, 12)}-${Date.now()}`;
    const imageName = `k8s-platform/${projectId}`;
    const fullImage = `${imageName}:${imageTag}`;

    const tmpDir = path.join(os.tmpdir(), `k8s-build-${projectId.slice(0, 8)}-${Date.now()}`);

    const emit = (line: string) => {
      log.info(line);
      onLog?.(line);
    };

    try {
      emit(`Cloning ${gitUrl} branch=${branch || 'main'}...`);
      const clone = spawnSync('git', ['clone', '--depth', '1', '--branch', branch || 'main', gitUrl, tmpDir], { timeout: 60000 });
      if (clone.status !== 0) {
        emit(`Git clone failed: ${clone.stderr.toString().trim()}`);
        return this.buildWithKaniko(buildReq, imageTag, providedConfig || detectProjectType(gitUrl).buildConfig, emit);
      }
      emit('Repository cloned');

      const files: string[] = [];
      walkDir(tmpDir, files);
      const buildConfig = providedConfig || detectFromFiles(files)?.buildConfig || detectProjectType(gitUrl).buildConfig;
      emit(`Detected: ${buildConfig.language}${buildConfig.framework ? ` (${buildConfig.framework})` : ''}`);

      const dockerOk = await this.tryLocalDockerBuild(tmpDir, fullImage, buildConfig, emit);
      if (dockerOk) return { imageName, imageTag, fullImage, buildConfig, jobName: 'local' };

      const nixpacksOk = await this.tryNixpacksBuild(tmpDir, fullImage, emit);
      if (nixpacksOk) return { imageName, imageTag, fullImage, buildConfig, jobName: 'local' };

      emit('Local builds unavailable, using Kaniko in-cluster build...');
      return this.buildWithKaniko(buildReq, imageTag, buildConfig, emit);
    } catch (err: any) {
      emit(`Build error: ${err.message}`);
      return this.buildWithKaniko(buildReq, imageTag, providedConfig || detectProjectType(gitUrl).buildConfig, emit);
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (error) { log.warn(`[container-builder] Failed to clean temp dir: ${(error as Error).message}`); }
    }
  }

  private async tryLocalDockerBuild(tmpDir: string, fullImage: string, buildConfig: BuildConfig, emit: LogCallback): Promise<boolean> {
    if (!dockerAvailable()) return false;

    const dockerfilePath = path.join(tmpDir, 'Dockerfile');
    if (!fs.existsSync(dockerfilePath)) {
      fs.writeFileSync(dockerfilePath, generateDockerfileContent(buildConfig));
      emit('Generated Dockerfile');
    }

    const start = Date.now();
    emit('Building with Docker (BuildKit)...');

    const code = await spawnWithLog('docker', [
      'buildx', 'build',
      '--cache-from=type=local,src=/tmp/.buildx-cache',
      '--cache-to=type=local,dest=/tmp/.buildx-cache,mode=max',
      '-t', fullImage,
      tmpDir,
    ], emit, { env: { ...process.env, DOCKER_BUILDKIT: '1' } });

    if (code === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      emit(`Docker build done in ${elapsed}s`);
      return true;
    }
    emit('Docker build failed');
    return false;
  }

  private async tryNixpacksBuild(tmpDir: string, fullImage: string, emit: LogCallback): Promise<boolean> {
    if (!dockerAvailable()) return false;

    emit('Pulling Nixpacks builder...');
    try { execSync('docker pull railwayapp/nixpacks:latest', { stdio: 'pipe', timeout: 60000 }); }
    catch (e: any) { emit(`Nixpacks pull failed: ${e.message}`); return false; }

    const start = Date.now();
    emit('Building with Nixpacks...');

    const code = await spawnWithLog('docker', [
      'run', '--rm',
      '-v', `${tmpDir}:/app`,
      '-v', '/var/run/docker.sock:/var/run/docker.sock',
      'railwayapp/nixpacks', 'build', '/app',
      '--name', fullImage,
    ], emit);

    if (code === 0) {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      emit(`Nixpacks build done in ${elapsed}s`);
      return true;
    }
    emit('Nixpacks build failed');
    return false;
  }

  private async buildWithKaniko(buildReq: BuildRequest, imageTag: string, buildConfig: BuildConfig, emit: LogCallback): Promise<BuildResult> {
    const { gitUrl, branch, projectId, namespace, dockerfileContent } = buildReq;
    const dockerfile = dockerfileContent || generateDockerfileContent(buildConfig);

    const effectiveRegistry = await this.ensureRegistry(namespace);
    const imageName = `${effectiveRegistry}/${projectId}`;
    const fullImage = `${imageName}:${imageTag}`;

    const jobName = `build-${projectId.slice(0, 8)}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 63);

    await this.ensureDockerConfigSecret(namespace);

    const gitContext = gitUrl.startsWith('http') ? gitUrl : `https://${gitUrl}`;
    const jobArgs = [
      `--context=${gitContext}`,
      `--git=branch=${branch || 'main'}`,
      `--destination=${fullImage}`,
      `--dockerfile=Dockerfile`,
      `--cache=true`,
      `--cache-ttl=24h`,
    ];

    if (effectiveRegistry.startsWith('localhost:') || effectiveRegistry.startsWith('127.0.0.1:') || effectiveRegistry === 'docker-registry:5000') {
      jobArgs.push('--insecure', '--skip-tls-verify');
    }

    const job: k8s.V1Job = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: {
        name: jobName,
        namespace,
        labels: { 'project-id': projectId, 'build-type': 'git' },
      },
      spec: {
        template: {
          metadata: { labels: { 'project-id': projectId, 'job-type': 'build' } },
          spec: {
            containers: [{
              name: 'kaniko',
              image: 'gcr.io/kaniko-project/executor:latest',
              args: jobArgs,
              resources: { requests: { cpu: '100m', memory: '256Mi' }, limits: { cpu: '1', memory: '2Gi' } },
            }],
            restartPolicy: 'Never',
          },
        },
        backoffLimit: 0,
        ttlSecondsAfterFinished: 3600,
      },
    };

    emit(`Starting Kaniko build job: ${jobName}`);
    try {
      await this.batchApi.createNamespacedJob(namespace, job);
      emit(`Kaniko build job created: ${fullImage}`);
    } catch (err: any) {
      emit(`Kaniko job failed: ${err.message}`);
      if (err.response?.statusCode === 403) {
        job.spec!.template.spec!.containers[0].resources = undefined;
        await this.batchApi.createNamespacedJob(namespace, job);
        emit('Kaniko job created (retry without resources)');
      } else throw err;
    }

    return { imageName, imageTag, fullImage, buildConfig, jobName };
  }

  async buildWithDockerfile(projectId: string, namespace: string, dockerfileContent: string, imageName?: string, onLog?: LogCallback): Promise<string> {
    const imageTag = `${projectId.slice(0, 12)}-${Date.now()}`;
    const fullImage = `${imageName || `k8s-platform/${projectId}`}:${imageTag}`;

    const emit = (line: string) => {
      log.info(line);
      onLog?.(line);
    };

    if (dockerAvailable()) {
      const tmpDir = path.join(os.tmpdir(), `k8s-df-${projectId.slice(0, 8)}-${Date.now()}`);
      try {
        fs.mkdirSync(tmpDir, { recursive: true });
        fs.writeFileSync(path.join(tmpDir, 'Dockerfile'), dockerfileContent);
        emit('Building with Docker...');
        const code = await spawnWithLog('docker', ['build', '-t', fullImage, tmpDir], emit);
        if (code === 0) {
          emit(`Docker build done: ${fullImage}`);
          return fullImage;
        }
        emit('Docker build failed, trying Kaniko');
      } finally { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (error) { log.warn(`[container-builder] Failed to clean temp dir: ${(error as Error).message}`); } }
    } else {
      emit('Docker unavailable, using Kaniko');
    }

    return this.buildDockerfileWithKaniko(projectId, namespace, dockerfileContent, imageName, fullImage, imageTag, emit);
  }

  private async buildDockerfileWithKaniko(projectId: string, namespace: string, dockerfileContent: string, imageName?: string, fullImage?: string, imageTag?: string, emit?: LogCallback): Promise<string> {
    if (!fullImage || !imageTag) {
      imageTag = `${projectId.slice(0, 12)}-${Date.now()}`;
      fullImage = `${imageName || `k8s-platform/${projectId}`}:${imageTag}`;
    }

    const emitLog = emit || ((line: string) => log.info(line));

    const configMapName = `dockerfile-${projectId.slice(0, 8)}`.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const configMap: k8s.V1ConfigMap = {
      metadata: { name: configMapName, namespace },
      data: { 'Dockerfile': dockerfileContent },
    };

    try { await this.coreApi.createNamespacedConfigMap(namespace, configMap); }
    catch { await this.coreApi.replaceNamespacedConfigMap(configMapName, namespace, configMap); }

    const effectiveRegistry = await this.ensureRegistry(namespace);
    const finalImage = `${imageName || `${effectiveRegistry}/${projectId}`}:${imageTag}`;
    const jobName = `df-build-${projectId.slice(0, 6)}-${Date.now()}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 63);

    await this.ensureDockerConfigSecret(namespace);

    const jobArgs = [
      `--context=dir:///workspace`,
      `--destination=${finalImage}`,
      `--cache=true`,
      `--cache-ttl=24h`,
    ];

    if (effectiveRegistry.startsWith('localhost:') || effectiveRegistry.startsWith('127.0.0.1:') || effectiveRegistry === 'docker-registry:5000') {
      jobArgs.push('--insecure', '--skip-tls-verify');
    }

    const job: k8s.V1Job = {
      apiVersion: 'batch/v1',
      kind: 'Job',
      metadata: { name: jobName, namespace, labels: { 'project-id': projectId, 'build-type': 'dockerfile' } },
      spec: {
        template: {
          metadata: { labels: { 'project-id': projectId, 'job-type': 'build' } },
          spec: {
            containers: [{
              name: 'kaniko',
              image: 'gcr.io/kaniko-project/executor:latest',
              args: jobArgs,
              volumeMounts: [{ name: 'dockerfile-volume', mountPath: '/workspace' }],
              resources: { requests: { cpu: '100m', memory: '256Mi' }, limits: { cpu: '1', memory: '2Gi' } },
            }],
            volumes: [{ name: 'dockerfile-volume', configMap: { name: configMapName, defaultMode: 420 } }],
            restartPolicy: 'Never',
          },
        },
        backoffLimit: 0,
        ttlSecondsAfterFinished: 3600,
      },
    };

    emitLog(`Starting Kaniko Dockerfile build job: ${jobName}`);
    try { await this.batchApi.createNamespacedJob(namespace, job); emitLog(`Kaniko job created -> ${finalImage}`); }
    catch (err: any) { emitLog(`Kaniko job failed: ${err.message}`); throw err; }

    return finalImage;
  }

  async waitForBuild(jobName: string, namespace: string, timeoutMs: number = 600000): Promise<boolean> {
    if (jobName === 'local') return true;
    const startTime = Date.now();
    while (Date.now() - startTime < timeoutMs) {
      try {
        const job = await this.batchApi.readNamespacedJob(jobName, namespace);
        const conditions = job.body.status?.conditions || [];
        if (conditions.some(c => c.type === 'Complete' && c.status === 'True')) return true;
        if (conditions.some(c => c.type === 'Failed' && c.status === 'True')) return false;
      } catch { return false; }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
    return false;
  }

  async getBuildLogs(jobName: string, namespace: string): Promise<string> {
    if (jobName === 'local') return 'Local Docker build completed';
    try {
      const pods = await this.coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, `job-name=${jobName}`);
      if (!pods.body.items.length) return 'No build pods found';
      const podName = pods.body.items[0].metadata!.name!;
      const logResponse = await this.coreApi.readNamespacedPodLog(podName, namespace);
      return logResponse.body || 'No logs available';
    } catch (err: any) { return `Logs unavailable: ${err.message}`; }
  }

  private async ensureDockerConfigSecret(namespace: string): Promise<void> {
    try { await this.coreApi.readNamespacedSecret('docker-config', namespace); }
    catch {
      const emptyConfig = JSON.stringify({ auths: {} });
      const secret: k8s.V1Secret = {
        metadata: { name: 'docker-config', namespace, labels: { 'managed-by': 'k8s-platform' } },
        type: 'Opaque',
        data: { 'config.json': Buffer.from(emptyConfig).toString('base64') },
      };
      try { await this.coreApi.createNamespacedSecret(namespace, secret); }
      catch (e: any) { log.warn(`Could not create docker-config secret in ${namespace}: ${e.message}`); }
    }
  }

  private async ensureRegistry(namespace: string): Promise<string> {
    const registryName = 'docker-registry';
    const configuredRegistry = process.env.DOCKER_REGISTRY || 'localhost:5000';

    if (!configuredRegistry.startsWith('localhost:') && !configuredRegistry.startsWith('127.0.0.1:')) return configuredRegistry;

    try { await this.coreApi.readNamespacedService(registryName, namespace); return `${registryName}:5000`; }
    catch (error) { log.warn(`[container-builder] Registry service not found: ${(error as Error).message}`); }

    try {
      const deployment: k8s.V1Deployment = {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        metadata: { name: registryName, namespace, labels: { app: registryName, 'managed-by': 'k8s-platform' } },
        spec: {
          replicas: 1,
          selector: { matchLabels: { app: registryName } },
          template: {
            metadata: { labels: { app: registryName } },
            spec: { containers: [{ name: registryName, image: 'registry:2', ports: [{ containerPort: 5000 }], env: [{ name: 'REGISTRY_STORAGE_DELETE_ENABLED', value: 'true' }] }] },
          },
        },
      };
      await this.appsApi.createNamespacedDeployment(namespace, deployment);
    } catch (e: any) { log.warn(`Could not create registry deployment: ${e.message}`); return configuredRegistry; }

    try {
      const service: k8s.V1Service = {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: { name: registryName, namespace, labels: { app: registryName, 'managed-by': 'k8s-platform' } },
        spec: { selector: { app: registryName }, ports: [{ port: 5000, targetPort: 5000, name: 'http' }] },
      };
      await this.coreApi.createNamespacedService(namespace, service);
    } catch (e: any) { log.warn(`Could not create registry service: ${e.message}`); }

    return `${registryName}:5000`;
  }

  getDockerfileForLanguage(buildConfig: BuildConfig): string { return generateDockerfileContent(buildConfig); }
}

export const containerBuilder = new ContainerBuilder();
