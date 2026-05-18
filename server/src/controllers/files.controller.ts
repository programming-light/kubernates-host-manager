import { FastifyRequest, FastifyReply } from 'fastify';
import * as stream from 'stream';
import * as k8s from '@kubernetes/client-node';
import prisma from '../lib/prisma.js';
import log from '../lib/logger.js';
import { k8sConfigManager } from '../lib/k8s-config.js';

function getAppLabel(userEmail: string | undefined | null, slug: string): string {
  const userPrefix = userEmail
    ? userEmail.split('@')[0].toLowerCase().replace(/[^a-z0-9-]/g, '-').substring(0, 20)
    : 'user';
  return `app-${userPrefix}-${slug}`;
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

async function findPod(namespace: string, appLabel: string): Promise<string | null> {
  const coreApi = k8sConfigManager.coreApi;
  const pods = await coreApi.listNamespacedPod(
    namespace, undefined, undefined, undefined, undefined,
    `app=${appLabel}`
  );
  if (!pods.body.items.length) return null;
  return pods.body.items[0].metadata!.name!;
}

async function execInPod(namespace: string, podName: string, containerName: string, command: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const kc = k8sConfigManager.getConfig();
  if (!kc) throw new Error('KubeConfig not loaded');
  const exec = new k8s.Exec(kc);
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  await new Promise<void>((resolve, reject) => {
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

    exec.exec(
      namespace,
      podName,
      containerName,
      command,
      stdoutStream,
      stderrStream,
      null,
      false,
      (status: k8s.V1Status) => {
        if (status.status === 'Failure') {
          stderr += status.message || 'Command failed';
          exitCode = 1;
        }
        resolve();
      }
    );
  });

  return { stdout, stderr, exitCode };
}

export async function listFiles(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    let { path: dirPath = '/' } = request.query as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) return reply.status(access.status!).send({ error: access.error });

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) return reply.status(503).send({ error: 'Kubernetes not connected' });

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const podName = await findPod(project.namespace, appLabel);
    if (!podName) return reply.status(404).send({ error: 'No running pods found' });

    const containerName = appLabel;
    const escapedPath = dirPath.replace(/'/g, "'\\''");
    const { stdout, stderr, exitCode } = await execInPod(
      project.namespace, podName, containerName,
      ['sh', '-c', `ls -la '${escapedPath}' 2>/dev/null && echo '---ENTRY---' && (test -f '${escapedPath}' && wc -c < '${escapedPath}' || find '${escapedPath}' -maxdepth 1 -type d 2>/dev/null | wc -l)`]
    );

    if (exitCode !== 0) {
      return reply.send({ path: dirPath, entries: [], error: stderr || 'Failed to list files' });
    }

    const lines = stdout.split('\n').filter(l => l.trim());
    const entries: any[] = [];
    let sizeInfo = '';

    for (const line of lines) {
      if (line === '---ENTRY---') {
        sizeInfo = '';
        continue;
      }
      if (!sizeInfo) {
        sizeInfo = line;
        continue;
      }
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;
      const permissions = parts[0];
      const links = parts[1];
      const owner = parts[2];
      const group = parts[3];
      const size = parts[4];
      const name = parts.slice(8).join(' ');
      if (name === '.' || name === '..') continue;
      entries.push({
        name,
        permissions,
        owner,
        group,
        size: parseInt(size) || 0,
        isDirectory: permissions.startsWith('d'),
        isSymlink: permissions.startsWith('l'),
        path: dirPath === '/' ? `/${name}` : `${dirPath}/${name}`,
      });
    }

    reply.send({ path: dirPath, entries, total: entries.length });
  } catch (error: any) {
    log.error('List files error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function readFile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { path: filePath } = request.query as any;

    if (!filePath) return reply.status(400).send({ error: 'file path is required' });

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) return reply.status(access.status!).send({ error: access.error });

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) return reply.status(503).send({ error: 'Kubernetes not connected' });

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const podName = await findPod(project.namespace, appLabel);
    if (!podName) return reply.status(404).send({ error: 'No running pods found' });

    const containerName = appLabel;
    const escapedPath = filePath.replace(/'/g, "'\\''");
    const { stdout, stderr, exitCode } = await execInPod(
      project.namespace, podName, containerName,
      ['sh', '-c', `cat '${escapedPath}' 2>/dev/null || echo 'ERROR_FILE_NOT_FOUND'`]
    );

    if (exitCode !== 0 || stdout === 'ERROR_FILE_NOT_FOUND') {
      return reply.status(404).send({ error: 'File not found' });
    }

    reply.send({ path: filePath, content: stdout });
  } catch (error: any) {
    log.error('Read file error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function writeFile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { path: filePath, content } = request.body as any;

    if (!filePath || content === undefined) {
      return reply.status(400).send({ error: 'file path and content are required' });
    }

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) return reply.status(access.status!).send({ error: access.error });

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) return reply.status(503).send({ error: 'Kubernetes not connected' });

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const podName = await findPod(project.namespace, appLabel);
    if (!podName) return reply.status(404).send({ error: 'No running pods found' });

    const containerName = appLabel;

    const escapedContent = content.replace(/'/g, "'\\''");
    const escapedPath = filePath.replace(/'/g, "'\\''");

    const { stderr, exitCode } = await execInPod(
      project.namespace, podName, containerName,
      ['sh', '-c', `mkdir -p "$(dirname '${escapedPath}')" && cat > '${escapedPath}' << 'ENDOFFILE'\n${content}\nENDOFFILE`]
    );

    if (exitCode !== 0) {
      return reply.status(500).send({ error: stderr || 'Failed to write file' });
    }

    reply.send({ path: filePath, message: 'File saved successfully' });
  } catch (error: any) {
    log.error('Write file error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function deleteFile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { path: filePath, recursive } = request.body as any;

    if (!filePath) return reply.status(400).send({ error: 'file path is required' });

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) return reply.status(access.status!).send({ error: access.error });

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) return reply.status(503).send({ error: 'Kubernetes not connected' });

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const podName = await findPod(project.namespace, appLabel);
    if (!podName) return reply.status(404).send({ error: 'No running pods found' });

    const containerName = appLabel;
    const escapedPath = filePath.replace(/'/g, "'\\''");
    const rmCmd = recursive ? `rm -rf '${escapedPath}'` : `rm '${escapedPath}'`;

    const { stderr, exitCode } = await execInPod(
      project.namespace, podName, containerName,
      ['sh', '-c', rmCmd]
    );

    if (exitCode !== 0) {
      return reply.status(500).send({ error: stderr || 'Failed to delete file' });
    }

    reply.send({ path: filePath, message: 'File deleted successfully' });
  } catch (error: any) {
    log.error('Delete file error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function createDirectory(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { path: dirPath } = request.body as any;

    if (!dirPath) return reply.status(400).send({ error: 'directory path is required' });

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) return reply.status(access.status!).send({ error: access.error });

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) return reply.status(503).send({ error: 'Kubernetes not connected' });

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const podName = await findPod(project.namespace, appLabel);
    if (!podName) return reply.status(404).send({ error: 'No running pods found' });

    const containerName = appLabel;
    const escapedPath = dirPath.replace(/'/g, "'\\''");

    const { stderr, exitCode } = await execInPod(
      project.namespace, podName, containerName,
      ['sh', '-c', `mkdir -p '${escapedPath}'`]
    );

    if (exitCode !== 0) {
      return reply.status(500).send({ error: stderr || 'Failed to create directory' });
    }

    reply.send({ path: dirPath, message: 'Directory created successfully' });
  } catch (error: any) {
    log.error('Create directory error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function uploadFile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) return reply.status(access.status!).send({ error: access.error });

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) return reply.status(503).send({ error: 'Kubernetes not connected' });

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const podName = await findPod(project.namespace, appLabel);
    if (!podName) return reply.status(404).send({ error: 'No running pods found' });

    const containerName = appLabel;
    const data = request.body as any;
    const { path: destPath, content, fileName } = data;

    if (!destPath || !content) {
      return reply.status(400).send({ error: 'destination path and file content are required' });
    }

    const escapedDest = destPath.replace(/'/g, "'\\''");
    const escapedContent = content.replace(/'/g, "'\\''");

    const { stderr, exitCode } = await execInPod(
      project.namespace, podName, containerName,
      ['sh', '-c', `mkdir -p "$(dirname '${escapedDest}')" && cat > '${escapedDest}' << 'ENDOFFILE'\n${content}\nENDOFFILE`]
    );

    if (exitCode !== 0) {
      return reply.status(500).send({ error: stderr || 'Failed to upload file' });
    }

    reply.send({ path: destPath, fileName: fileName || destPath.split('/').pop(), message: 'File uploaded successfully' });
  } catch (error: any) {
    log.error('Upload file error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}

export async function getFileInfo(request: FastifyRequest, reply: FastifyReply) {
  try {
    const userId = (request as any).userId!;
    const { projectId } = request.params as any;
    const { path: filePath } = request.query as any;

    if (!filePath) return reply.status(400).send({ error: 'file path is required' });

    const access = await checkProjectAccess(projectId, userId);
    if (!access.allowed) return reply.status(access.status!).send({ error: access.error });

    const project = access.project!;
    const k8sConfig = await k8sConfigManager.loadConfig();
    if (!k8sConfig.connected) return reply.status(503).send({ error: 'Kubernetes not connected' });

    const appLabel = getAppLabel(project.user?.email, project.slug);
    const podName = await findPod(project.namespace, appLabel);
    if (!podName) return reply.status(404).send({ error: 'No running pods found' });

    const containerName = appLabel;
    const escapedPath = filePath.replace(/'/g, "'\\''");
    const { stdout, exitCode } = await execInPod(
      project.namespace, podName, containerName,
      ['sh', '-c', `stat '${escapedPath}' 2>/dev/null || echo 'NOT_FOUND'`]
    );

    if (exitCode !== 0 || stdout === 'NOT_FOUND') {
      return reply.status(404).send({ error: 'File not found' });
    }

    reply.send({ path: filePath, stat: stdout });
  } catch (error: any) {
    log.error('File info error:', error);
    reply.status(500).send({ error: 'Internal Server Error', message: error.message });
  }
}
