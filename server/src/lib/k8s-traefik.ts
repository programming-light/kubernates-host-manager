import * as k8s from '@kubernetes/client-node';
import log from './logger.js';
import { k8sConfigManager } from './k8s-config.js';

interface TraefikRoute {
  projectId: string;
  domain: string;
  serviceName: string;
  servicePort: number;
  namespace: string;
  tls: boolean;
  prefix?: string;
}

export class TraefikManager {
  private get coreApi() { return k8sConfigManager.coreApi; }
  private get appsApi() { return k8sConfigManager.appsApi; }
  private get rbacApi() { return k8sConfigManager.rbacApi; }
  private get customObjectsApi() { return k8sConfigManager.customObjectsApi; }

  async ensureTraefikInstalled(): Promise<boolean> {
    try {
      await this.coreApi.readNamespacedService('traefik', 'traefik-system');
      log.info('Traefik already installed');
      return true;
    } catch {
      log.info('Installing Traefik...');
    }

    try {
      await this.coreApi.createNamespace({ metadata: { name: 'traefik-system' } });
    } catch (error) { log.warn(`[k8s-traefik] Namespace may already exist: ${(error as Error).message}`); }

    const crbs: k8s.V1ClusterRoleBinding = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRoleBinding',
      metadata: { name: 'traefik' },
      roleRef: { apiGroup: 'rbac.authorization.k8s.io', kind: 'ClusterRole', name: 'traefik' },
      subjects: [{ kind: 'ServiceAccount', name: 'traefik', namespace: 'traefik-system' }],
    };

    const clusterRole: k8s.V1ClusterRole = {
      apiVersion: 'rbac.authorization.k8s.io/v1',
      kind: 'ClusterRole',
      metadata: { name: 'traefik' },
      rules: [
        { apiGroups: [''], resources: ['services', 'endpoints', 'secrets', 'pods'], verbs: ['get', 'list', 'watch'] },
        { apiGroups: ['networking.k8s.io'], resources: ['ingresses'], verbs: ['get', 'list', 'watch'] },
        { apiGroups: ['traefik.io'], resources: ['ingressroutes', 'middlewares', 'tlsoptions'], verbs: ['get', 'list', 'watch', 'create', 'update', 'delete'] },
        { apiGroups: ['discovery.k8s.io'], resources: ['endpointslices'], verbs: ['get', 'list', 'watch'] },
      ],
    };

    const sa: k8s.V1ServiceAccount = {
      apiVersion: 'v1',
      kind: 'ServiceAccount',
      metadata: { name: 'traefik', namespace: 'traefik-system' },
    };

    const staticConfig = {
      api: { dashboard: true, debug: true },
      entryPoints: {
        web: { address: ':80', http: { redirections: { entryPoint: { to: 'websecure', scheme: 'https' } } } },
        websecure: { address: ':443', http: { tls: { certResolver: 'letsencrypt' } } },
      },
      certificatesResolvers: {
        letsencrypt: {
          acme: {
            email: 'admin@k8s-platform.local',
            storage: '/data/acme.json',
            httpChallenge: { entryPoint: 'web' },
          },
        },
      },
      providers: { kubernetesCRD: true },
      log: { level: 'INFO' },
    };

    const cm: k8s.V1ConfigMap = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: { name: 'traefik-config', namespace: 'traefik-system' },
      data: { 'traefik.yaml': JSON.stringify(staticConfig) },
    };

    const deployment: k8s.V1Deployment = {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name: 'traefik', namespace: 'traefik-system', labels: { app: 'traefik' } },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: 'traefik' } },
        template: {
          metadata: { labels: { app: 'traefik' } },
          spec: {
            serviceAccountName: 'traefik',
            containers: [{
              name: 'traefik',
              image: 'traefik:v3.3',
              args: ['--configFile=/config/traefik.yaml'],
              ports: [
                { containerPort: 80, name: 'web' },
                { containerPort: 443, name: 'websecure' },
                { containerPort: 9000, name: 'dashboard' },
              ],
              volumeMounts: [
                { name: 'config', mountPath: '/config' },
                { name: 'data', mountPath: '/data' },
              ],
              resources: { requests: { cpu: '100m', memory: '128Mi' }, limits: { cpu: '500m', memory: '256Mi' } },
            }],
            volumes: [
              { name: 'config', configMap: { name: 'traefik-config' } },
              { name: 'data', emptyDir: {} },
            ],
          },
        },
      },
    };

    const service: k8s.V1Service = {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name: 'traefik', namespace: 'traefik-system' },
      spec: {
        type: 'LoadBalancer',
        selector: { app: 'traefik' },
        ports: [
          { port: 80, targetPort: 80, name: 'web' },
          { port: 443, targetPort: 443, name: 'websecure' },
          { port: 9000, targetPort: 9000, name: 'dashboard' },
        ],
      },
    };

    try {
      await this.coreApi.createNamespacedServiceAccount('traefik-system', sa);
      await this.rbacApi.createClusterRole(clusterRole);
      await this.rbacApi.createClusterRoleBinding(crbs);
      await this.coreApi.createNamespacedConfigMap('traefik-system', cm);
      await this.appsApi.createNamespacedDeployment('traefik-system', deployment);
      await this.coreApi.createNamespacedService('traefik-system', service);
      log.info('Traefik installed successfully');
      return true;
    } catch (err: any) {
      log.error('Failed to install Traefik:', err.message);
      return false;
    }
  }

  async addRoute(route: TraefikRoute): Promise<boolean> {
    const ingressRoute: any = {
      apiVersion: 'traefik.io/v1alpha1',
      kind: 'IngressRoute',
      metadata: {
        name: `route-${route.projectId}`,
        namespace: route.namespace,
        labels: { 'project-id': route.projectId, 'managed-by': 'k8s-platform' },
      },
      spec: {
        entryPoints: ['websecure'],
        routes: [{
          match: route.prefix
            ? `Host(\`${route.domain}\`) && PathPrefix(\`${route.prefix}\`)`
            : `Host(\`${route.domain}\`)`,
          kind: 'Rule',
          services: [{ name: route.serviceName, port: route.servicePort }],
          middlewares: route.prefix ? [{ name: `strip-${route.projectId}`, namespace: route.namespace }] : undefined,
        }],
        tls: route.tls ? { certResolver: 'letsencrypt' } : undefined,
      },
    };

    if (route.prefix) {
      const middleware: any = {
        apiVersion: 'traefik.io/v1alpha1',
        kind: 'Middleware',
        metadata: { name: `strip-${route.projectId}`, namespace: route.namespace },
        spec: { stripPrefix: { prefixes: [route.prefix] } },
      };
      try {
        await this.customObjectsApi.createNamespacedCustomObject('traefik.io', 'v1alpha1', route.namespace, 'middlewares', middleware);
      } catch (error) { log.warn(`[k8s-traefik] Failed to create middleware: ${(error as Error).message}`); }
    }

    try {
      await this.customObjectsApi.createNamespacedCustomObject('traefik.io', 'v1alpha1', route.namespace, 'ingressroutes', ingressRoute);
      log.info(`Traefik route added for ${route.domain} -> ${route.serviceName}:${route.servicePort}`);
      return true;
    } catch (err: any) {
      try {
        await this.customObjectsApi.replaceNamespacedCustomObject('traefik.io', 'v1alpha1', route.namespace, 'ingressroutes', `route-${route.projectId}`, ingressRoute);
        log.info(`Traefik route updated for ${route.domain}`);
        return true;
      } catch (e: any) {
        log.error('Failed to add/update Traefik route:', e.message);
        return false;
      }
    }
  }

  async removeRoute(projectId: string, namespace: string): Promise<boolean> {
    try {
      await this.customObjectsApi.deleteNamespacedCustomObject('traefik.io', 'v1alpha1', namespace, 'ingressroutes', `route-${projectId}`);
      log.info(`Traefik route removed for project ${projectId}`);
      return true;
    } catch (err: any) {
      log.warn(`Failed to remove Traefik route: ${err.message}`);
      return false;
    }
  }

  async getDashboardUrl(): Promise<string | null> {
    try {
      const res = await this.coreApi.readNamespacedService('traefik', 'traefik-system');
      const ingress = res.body.status?.loadBalancer?.ingress?.[0];
      if (ingress?.ip || ingress?.hostname) {
        return `http://${ingress.ip || ingress.hostname}:9000/dashboard/`;
      }

      const svc = await this.coreApi.readNamespacedService('traefik', 'traefik-system');
      if (svc.body.spec?.ports?.find(p => p.nodePort)) {
        const nodePort = svc.body.spec.ports.find(p => p.name === 'dashboard')?.nodePort;
        return `http://localhost:${nodePort}/dashboard/`;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const traefikManager = new TraefikManager();
