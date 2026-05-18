import * as k8s from '@kubernetes/client-node';
import { k8sConfigManager } from './k8s-config.js';
import { getIO } from './socket.js';
import log from './logger.js';

function getCoreApi() { return k8sConfigManager.coreApi; }
function getBatchApi() { return k8sConfigManager.batchApi; }

async function getPodEvents(namespace: string, podName: string): Promise<string> {
  try {
    const events = await getCoreApi().listNamespacedEvent(namespace, undefined, undefined, undefined, `involvedObject.name=${podName}`);
    return events.body.items.map(e => `[${e.reason}] ${e.message}`).join('\n') || 'No events found';
  } catch {
    return 'Unable to fetch pod events';
  }
}

async function pollBuildLogs(
  namespace: string,
  jobName: string,
  projectId: string
): Promise<string> {
  if (jobName === 'local') {
    const io = getIO();
    if (io) {
      const room = `build-${projectId}`;
      const emit = (event: string, data: any) => io.to(room).emit(event, data);
      emit('build:log', { text: 'Local Docker build completed successfully\n', projectId });
      emit('build:status', { status: 'success', message: 'Local build completed' });
    }
    return 'Local build completed';
  }
  const io = getIO();
  if (!io) return 'no-socket-io';

  const room = `build-${projectId}`;
  const emit = (event: string, data: any) => io.to(room).emit(event, data);

  emit('build:status', { status: 'starting', message: 'Build job created, waiting for pod...' });

  let podName: string | null = null;
  let podPhase: string | null = null;
  const maxWaitForPod = 300_000;
  const startTime = Date.now();

  while (!podName && Date.now() - startTime < maxWaitForPod) {
    try {
      const pods = await getCoreApi().listNamespacedPod(namespace, undefined, undefined, undefined, undefined, `job-name=${jobName}`);
      const items = pods.body.items;
      if (items.length > 0) {
        podName = items[0].metadata!.name!;
        podPhase = items[0].status?.phase || 'Unknown';
        emit('build:log', { text: `Pod status: ${podPhase} (${podName})\n`, projectId });

        if (podPhase === 'Pending') {
          const events = await getPodEvents(namespace, podName);
          if (events) emit('build:log', { text: `Events:\n${events}\n`, projectId });
        }

        if (podPhase === 'Running') {
          emit('build:status', { status: 'running', message: `Build pod running` });
        }
      }
    } catch {
      // pod not ready yet
    }
    if (!podName) {
      await new Promise(r => setTimeout(r, 2000));
      if (Date.now() - startTime > 10000 && (Date.now() - startTime) % 20000 < 3000) {
        emit('build:log', { text: `Waiting for build pod... (${Math.floor((Date.now() - startTime) / 1000)}s)\n`, projectId });
      }
    }
  }

  if (!podName) {
    emit('build:log', { text: 'ERROR: Build pod never started. Check cluster resources and node availability.\n', projectId });
    emit('build:status', { status: 'error', message: 'Timed out waiting for build pod' });
    try {
      const job = await getBatchApi().readNamespacedJob(jobName, namespace);
      emit('build:log', { text: `Job status: ${JSON.stringify(job.body.status)}\n`, projectId });
    } catch (error) { log.warn(`[build-streamer] Failed to read job ${jobName}: ${(error as Error).message}`); }
    return '';
  }

  let lastLogLength = 0;
  let fullLog = '';
  let lastStatus: string | null = null;
  const pollInterval = 3000;
  const maxRuntime = 900_000;
  const runtimeStart = Date.now();

  while (Date.now() - runtimeStart < maxRuntime) {
    await new Promise(r => setTimeout(r, pollInterval));

    try {
      if (podPhase === 'Running') {
        const logResponse = await getCoreApi().readNamespacedPodLog(podName, namespace);
        const currentLog = logResponse.body || '';
        if (currentLog.length > lastLogLength) {
          const newChunk = currentLog.substring(lastLogLength);
          fullLog = currentLog;
          lastLogLength = currentLog.length;
          emit('build:log', { text: newChunk, projectId });
        }
      } else {
        const currentPod = await getCoreApi().readNamespacedPod(podName, namespace);
        podPhase = currentPod.body.status?.phase || podPhase;
        if (podPhase !== lastStatus) {
          emit('build:log', { text: `Pod status changed to: ${podPhase}\n`, projectId });
          lastStatus = podPhase;
          if (podPhase === 'Pending') {
            const events = await getPodEvents(namespace, podName);
            emit('build:log', { text: `Events:\n${events}\n`, projectId });
          }
        }
      }

      const jobStatus = await checkJobStatus(namespace, jobName);
      if (jobStatus !== 'running') {
        // Flush remaining logs
        try {
          const finalLog = await getCoreApi().readNamespacedPodLog(podName, namespace);
          const logBody = finalLog.body || '';
          if (logBody.length > lastLogLength) {
            emit('build:log', { text: logBody.substring(lastLogLength), projectId });
            fullLog = logBody;
          }
        } catch (error) { log.warn(`[build-streamer] Failed to read final pod logs: ${(error as Error).message}`); }

        if (jobStatus === 'success') {
          emit('build:status', { status: 'success', message: 'Build completed' });
        } else {
          emit('build:status', { status: 'failed', message: 'Build failed' });
        }
        return fullLog;
      }
    } catch (err: any) {
      if (err.statusCode === 404) {
        const finalStatus = await checkJobStatus(namespace, jobName);
        const message = finalStatus === 'success' ? 'Build completed' : 'Build finished';
        emit('build:status', { status: finalStatus === 'success' ? 'success' : 'completed', message });
        return fullLog;
      }
      log.warn(`Error polling logs for ${podName}:`, err.message);
    }
  }

  emit('build:status', { status: 'timeout', message: 'Build timed out after 15 minutes' });
  return fullLog;
}

async function checkJobStatus(namespace: string, jobName: string): Promise<'success' | 'failed' | 'running'> {
  try {
    const job = await getBatchApi().readNamespacedJob(jobName, namespace);
    const conditions = job.body.status?.conditions || [];
    if (conditions.some(c => c.type === 'Complete' && c.status === 'True')) return 'success';
    if (conditions.some(c => c.type === 'Failed' && c.status === 'True')) return 'failed';

    const failedPods = job.body.status?.failed || 0;
    if (failedPods > 0) return 'failed';

    return 'running';
  } catch {
    return 'running';
  }
}

export { pollBuildLogs as streamBuildLogs, checkJobStatus };
