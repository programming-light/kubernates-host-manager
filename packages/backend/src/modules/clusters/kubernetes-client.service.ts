import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import * as k8s from '@kubernetes/client-node';
import { ClusterEncryptionService } from './cluster-encryption.service';

interface ClusterCredentials {
  apiEndpoint: string;
  caCertificateBase64?: string;
  token?: string;
  kubeconfigBase64?: string;
}

interface ClusterInfo {
  kubernetesVersion: string;
  nodeCount: number;
}

interface NodeInfo {
  name: string;
  status: string;
  roles: string[];
  cpuCapacity: string;
  memoryCapacity: string;
  kubeletVersion: string;
}

interface IngressClass {
  name: string;
}

interface StorageClass {
  name: string;
  provisioner: string;
  isDefault: boolean;
}

@Injectable()
export class KubernetesClientService {
  constructor(private encryptionService: ClusterEncryptionService) {}

  /**
   * Create a Kubernetes API client from stored credentials
   */
  private createClient(credentials: ClusterCredentials): k8s.KubeConfig {
    const kc = new k8s.KubeConfig();

    try {
      if (credentials.kubeconfigBase64) {
        // Load from kubeconfig
        const kubeconfigContent = this.encryptionService.decodeFromBase64(
          credentials.kubeconfigBase64,
        );
        kc.loadFromString(kubeconfigContent);
      } else if (credentials.apiEndpoint && credentials.token && credentials.caCertificateBase64) {
        // Load from individual components
        const caCert = this.encryptionService.decodeFromBase64(credentials.caCertificateBase64);

        kc.loadFromOptions({
          clusters: [
            {
              name: 'default',
              server: credentials.apiEndpoint,
              caData: caCert,
              skipTLSVerify: false,
            },
          ],
          contexts: [
            {
              name: 'default',
              cluster: 'default',
              user: 'default',
            },
          ],
          currentContext: 'default',
          users: [
            {
              name: 'default',
              user: {
                token: credentials.token,
              },
            },
          ],
        });
      } else {
        throw new Error('Invalid or incomplete cluster credentials');
      }

      return kc;
    } catch (error) {
      throw new BadRequestException(`Failed to create Kubernetes client: ${error.message}`);
    }
  }

  /**
   * Test connectivity to the cluster
   */
  async testConnection(credentials: ClusterCredentials): Promise<boolean> {
    try {
      const kc = this.createClient(credentials);
      const api = kc.makeApiClient(k8s.CoreV1Api);

      // Try to list namespaces to verify connectivity
      await api.listNamespace();
      return true;
    } catch (error) {
      throw new BadRequestException(
        `Failed to connect to cluster: ${error.message || 'Unknown error'}`,
      );
    }
  }

  /**
   * Get cluster information
   */
  async getClusterInfo(credentials: ClusterCredentials): Promise<ClusterInfo> {
    try {
      const kc = this.createClient(credentials);
      const api = kc.makeApiClient(k8s.CoreV1Api);
      const appsApi = kc.makeApiClient(k8s.AppsV1Api);

      // Get Kubernetes version
      const versionInfo = await kc.getCluster()?.getVersion?.();
      let kubernetesVersion = 'unknown';

      if (versionInfo) {
        kubernetesVersion = `${versionInfo.major}.${versionInfo.minor}`;
      }

      // Count nodes
      const nodes = await api.listNode();
      const nodeCount = nodes.body.items.length;

      return {
        kubernetesVersion,
        nodeCount,
      };
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to retrieve cluster info: ${error.message}`,
      );
    }
  }

  /**
   * List all namespaces
   */
  async listNamespaces(credentials: ClusterCredentials): Promise<string[]> {
    try {
      const kc = this.createClient(credentials);
      const api = kc.makeApiClient(k8s.CoreV1Api);

      const namespaces = await api.listNamespace();
      return namespaces.body.items.map((ns) => ns.metadata?.name || '').filter(Boolean);
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to list namespaces: ${error.message}`,
      );
    }
  }

  /**
   * List all nodes with detailed information
   */
  async listNodes(credentials: ClusterCredentials): Promise<NodeInfo[]> {
    try {
      const kc = this.createClient(credentials);
      const api = kc.makeApiClient(k8s.CoreV1Api);

      const nodes = await api.listNode();

      return nodes.body.items.map((node) => {
        const metadata = node.metadata || {};
        const status = node.status || {};
        const labels = metadata.labels || {};

        // Extract roles from labels
        const roles: string[] = [];
        if (labels['node-role.kubernetes.io/control-plane']) roles.push('control-plane');
        if (labels['node-role.kubernetes.io/master']) roles.push('master');
        if (labels['node-role.kubernetes.io/worker']) roles.push('worker');
        if (roles.length === 0) roles.push('worker'); // Default to worker

        // Get capacity and allocatable resources
        const capacity = status.capacity || {};
        const allocatable = status.allocatable || {};

        return {
          name: metadata.name || 'unknown',
          status: this.getNodeStatus(status.conditions || []),
          roles,
          cpuCapacity: capacity['cpu'] || 'unknown',
          memoryCapacity: capacity['memory'] || 'unknown',
          kubeletVersion: status.nodeInfo?.kubeletVersion || 'unknown',
        };
      });
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to list nodes: ${error.message}`,
      );
    }
  }

  /**
   * List all ingress classes
   */
  async listIngressClasses(credentials: ClusterCredentials): Promise<string[]> {
    try {
      const kc = this.createClient(credentials);
      const networkingApi = kc.makeApiClient(k8s.NetworkingV1Api);

      try {
        const ingressClasses = await networkingApi.listIngressClass();
        return ingressClasses.body.items
          .map((ic) => ic.metadata?.name || '')
          .filter(Boolean);
      } catch {
        // Older Kubernetes versions might not have IngressClass
        return [];
      }
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to list ingress classes: ${error.message}`,
      );
    }
  }

  /**
   * List all storage classes
   */
  async listStorageClasses(credentials: ClusterCredentials): Promise<StorageClass[]> {
    try {
      const kc = this.createClient(credentials);
      const storageApi = kc.makeApiClient(k8s.StorageV1Api);

      const storageClasses = await storageApi.listStorageClass();

      return storageClasses.body.items
        .map((sc) => ({
          name: sc.metadata?.name || '',
          provisioner: sc.provisioner || 'unknown',
          isDefault: sc.metadata?.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true',
        }))
        .filter((sc) => sc.name !== '');
    } catch (error) {
      throw new InternalServerErrorException(
        `Failed to list storage classes: ${error.message}`,
      );
    }
  }

  /**
   * Get cluster API server version via direct API call
   */
  async getServerVersion(credentials: ClusterCredentials): Promise<string> {
    try {
      const kc = this.createClient(credentials);
      const apiClient = kc.makeApiClient(k8s.CoreV1Api);

      // This is a simpler way to get version info
      const version = await kc.getCluster()?.getVersion?.();
      if (version) {
        return `${version.major}.${version.minor}`;
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Helper to determine node status from conditions
   */
  private getNodeStatus(
    conditions: Array<{ type?: string; status?: string }>,
  ): string {
    const readyCondition = conditions.find((c) => c.type === 'Ready');
    if (readyCondition?.status === 'True') return 'Ready';
    if (readyCondition?.status === 'False') return 'NotReady';
    return 'Unknown';
  }
}
