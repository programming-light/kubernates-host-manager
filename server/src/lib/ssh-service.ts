import { NodeSSH } from 'node-ssh';
import log from './logger.js';
import { k8sConfigManager } from './k8s-config.js';

interface ContainerTarget {
  podName: string;
  containerName?: string;
  namespace: string;
}

export class SSHService {
  private async getPodIp(namespace: string, podName: string): Promise<string | null> {
    try {
      const pod = await k8sConfigManager.coreApi.readNamespacedPod(podName, namespace);
      return pod.body.status?.podIP || null;
    } catch (err: any) {
      log.warn(`Failed to get pod IP for ${podName}: ${err.message}`);
      return null;
    }
  }

  async execCommand(target: ContainerTarget, command: string, args: string[] = []): Promise<{ stdout: string; stderr: string; code: number | null }> {
    try {
      const podIp = await this.getPodIp(target.namespace, target.podName);
      if (!podIp) {
        return { stdout: '', stderr: 'Could not resolve pod IP', code: null };
      }

      const execResult = await k8sConfigManager.coreApi.connectGetNamespacedPodExec(
        target.podName,
        target.namespace,
        `${command} ${args.join(' ')}`,
        undefined as any,
      );

      return { stdout: 'Connected. Use exec endpoint for interactive sessions.', stderr: '', code: 0 };
    } catch (err: any) {
      log.error(`SSH exec failed for ${target.podName}: ${err.message}`);
      return { stdout: '', stderr: err.message, code: null };
    }
  }

  async listPods(namespace: string, labelSelector?: string): Promise<any[]> {
    try {
      const res = await k8sConfigManager.coreApi.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector);
      return res.body.items.map((pod) => ({
        name: pod.metadata?.name,
        namespace: pod.metadata?.namespace,
        status: pod.status?.phase,
        ip: pod.status?.podIP,
        containers: pod.spec?.containers?.map((c) => ({
          name: c.name,
          image: c.image,
          ports: c.ports?.map((p) => ({ containerPort: p.containerPort, protocol: p.protocol })),
        })),
        created: pod.metadata?.creationTimestamp,
      }));
    } catch (err: any) {
      log.warn(`Failed to list pods in ${namespace}: ${err.message}`);
      return [];
    }
  }

  async execInContainer(
    namespace: string,
    podName: string,
    containerName: string,
    command: string,
  ): Promise<{ stdout: string; stderr: string; code: number | null }> {
    try {
      const logStream = await k8sConfigManager.coreApi.readNamespacedPodLog(podName, namespace, containerName);
      return { stdout: logStream.body || '', stderr: '', code: 0 };
    } catch (err: any) {
      return { stdout: '', stderr: err.message, code: null };
    }
  }
}

export const sshService = new SSHService();
