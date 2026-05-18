import * as k8s from '@kubernetes/client-node';
import { k8sConfigManager } from './k8s-config.js';
import { getIO } from './socket.js';
import log from './logger.js';

interface WatchEvent {
  type: 'ADDED' | 'MODIFIED' | 'DELETED' | 'ERROR';
  object: any;
}

export class K8sWatcher {
  private watchers: Map<string, AbortController> = new Map();
  private activeNamespaces: Set<string> = new Set();
  private reconnectDelay = 3000;

  async startWatching(namespace = 'all') {
    if (this.activeNamespaces.has(namespace)) return;
    this.activeNamespaces.add(namespace);

    const config = await k8sConfigManager.loadConfig();
    if (!config.connected) {
      log.warn('K8s not connected, cannot start watcher');
      return;
    }

    const kubeConfig = config.kubeConfig;
    this.watchPods(kubeConfig, namespace);
    this.watchDeployments(kubeConfig, namespace);
    this.watchServices(kubeConfig, namespace);
    log.info(`Started K8s watcher for namespace: ${namespace}`);
  }

  stopWatching(namespace: string) {
    const key = `pods-${namespace}`;
    this.watchers.get(key)?.abort();
    this.watchers.delete(key);
    this.activeNamespaces.delete(namespace);
  }

  stopAll() {
    for (const [, controller] of this.watchers) {
      controller.abort();
    }
    this.watchers.clear();
    this.activeNamespaces.clear();
    log.info('Stopped all K8s watchers');
  }

  private watchPods(kubeConfig: k8s.KubeConfig, namespace: string) {
    const watch = new k8s.Watch(kubeConfig);
    const key = `pods-${namespace}`;
    const controller = new AbortController();
    this.watchers.set(key, controller);

    const path = namespace === 'all'
      ? '/api/v1/pods'
      : `/api/v1/namespaces/${namespace}/pods`;

    this.startWatcher(watch, path, controller, (event: WatchEvent) => {
      const pod = event.object;
      const podName = pod.metadata?.name || 'unknown';
      const podNs = pod.metadata?.namespace || 'default';
      const status = pod.status?.phase || 'Unknown';
      const ready = pod.status?.containerStatuses
        ? pod.status.containerStatuses.filter((c: any) => c.ready).length
        : 0;
      const total = pod.status?.containerStatuses?.length || 0;

      const io = getIO();
      if (io) {
        const data = { name: podName, namespace: podNs, status, ready, total, type: event.type };
        io.to(`k8s-${podNs}`).emit('k8s:pod:updated', data);
        io.emit('k8s:pod:updated', data);
        if (process.env.K8S_WATCHER_LOG === 'true') {
          log.debug(`Pod ${event.type}: ${podName}/${podNs} - ${status} (${ready}/${total})`);
        }
      }
    });
  }

  private watchDeployments(kubeConfig: k8s.KubeConfig, namespace: string) {
    const watch = new k8s.Watch(kubeConfig);
    const key = `deployments-${namespace}`;
    const controller = new AbortController();
    this.watchers.set(key, controller);

    const path = namespace === 'all'
      ? '/apis/apps/v1/deployments'
      : `/apis/apps/v1/namespaces/${namespace}/deployments`;

    this.startWatcher(watch, path, controller, (event: WatchEvent) => {
      const dep = event.object;
      const depName = dep.metadata?.name || 'unknown';
      const depNs = dep.metadata?.namespace || 'default';
      const readyReplicas = dep.status?.readyReplicas || 0;
      const replicas = dep.spec?.replicas || 0;
      const availableReplicas = dep.status?.availableReplicas || 0;

      const io = getIO();
      if (io) {
        const data = {
          name: depName,
          namespace: depNs,
          replicas,
          readyReplicas,
          availableReplicas,
          type: event.type,
        };
        io.to(`k8s-${depNs}`).emit('k8s:deployment:updated', data);
        io.emit('k8s:deployment:updated', data);
        if (process.env.K8S_WATCHER_LOG === 'true') {
          log.debug(`Deployment ${event.type}: ${depName}/${depNs} - ${readyReplicas}/${replicas} ready`);
        }
      }
    });
  }

  private watchServices(kubeConfig: k8s.KubeConfig, namespace: string) {
    const watch = new k8s.Watch(kubeConfig);
    const key = `services-${namespace}`;
    const controller = new AbortController();
    this.watchers.set(key, controller);

    const path = namespace === 'all'
      ? '/api/v1/services'
      : `/api/v1/namespaces/${namespace}/services`;

    this.startWatcher(watch, path, controller, (event: WatchEvent) => {
      if (event.type === 'ERROR') return;
      const svc = event.object;
      const io = getIO();
      if (io) {
        const data = {
          name: svc.metadata?.name || 'unknown',
          namespace: svc.metadata?.namespace || 'default',
          type: svc.spec?.type || 'ClusterIP',
          clusterIP: svc.spec?.clusterIP || 'None',
          ports: svc.spec?.ports?.map((p: any) => `${p.port}/${p.protocol}`) || [],
          eventType: event.type,
        };
        io.to(`k8s-${data.namespace}`).emit('k8s:service:updated', data);
      }
    });
  }

  private startWatcher(
    watch: k8s.Watch,
    path: string,
    controller: AbortController,
    handler: (event: WatchEvent) => void,
  ) {
    const doWatch = () => {
      watch.watch(path, {}, (type: string, obj: any) => {
        if (controller.signal.aborted) return;
        handler({ type: type as WatchEvent['type'], object: obj });
      }, (err: any) => {
        if (controller.signal.aborted) return;
        log.warn(`Watcher disconnected for ${path}, reconnecting in ${this.reconnectDelay}ms: ${err?.message || 'unknown'}`);
        setTimeout(doWatch, this.reconnectDelay);
      });
    };
    doWatch();
  }
}

export const k8sWatcher = new K8sWatcher();
