import * as k8s from '@kubernetes/client-node';
import * as fs from 'fs';
import * as path from 'path';
import log from './logger.js';

export type K8sProvider = 
  | 'minikube' 
  | 'kind' 
  | 'k3s' 
  | 'k3d' 
  | 'docker-desktop' 
  | 'microk8s' 
  | 'kubeadm' 
  | 'rancher' 
  | 'eks' 
  | 'gke' 
  | 'aks' 
  | 'custom';

export interface K8sConfig {
  provider: K8sProvider;
  kubeConfig: k8s.KubeConfig;
  apiServer: string;
  namespace: string;
  connected: boolean;
}

const REQUEST_TIMEOUT = parseInt(process.env.K8S_REQUEST_TIMEOUT || '60000', 10);
const CONNECT_TIMEOUT = parseInt(process.env.K8S_CONNECT_TIMEOUT || '30000', 10);

interface CachedApis {
  coreApi?: k8s.CoreV1Api;
  appsApi?: k8s.AppsV1Api;
  networkingApi?: k8s.NetworkingV1Api;
  batchApi?: k8s.BatchV1Api;
  versionApi?: k8s.VersionApi;
  autoscalingApi?: any;
  customObjectsApi?: any;
  rbacApi?: k8s.RbacAuthorizationV1Api;
}

class KubernetesConfigManager {
  private kc: k8s.KubeConfig | null = null;
  private cachedConfig: K8sConfig | null = null;
  private apis: CachedApis = {};

  get coreApi(): k8s.CoreV1Api {
    if (!this.apis.coreApi) this.apis.coreApi = this.makeApi(k8s.CoreV1Api);
    return this.apis.coreApi;
  }

  get appsApi(): k8s.AppsV1Api {
    if (!this.apis.appsApi) this.apis.appsApi = this.makeApi(k8s.AppsV1Api);
    return this.apis.appsApi;
  }

  get networkingApi(): k8s.NetworkingV1Api {
    if (!this.apis.networkingApi) this.apis.networkingApi = this.makeApi(k8s.NetworkingV1Api);
    return this.apis.networkingApi;
  }

  get batchApi(): k8s.BatchV1Api {
    if (!this.apis.batchApi) this.apis.batchApi = this.makeApi(k8s.BatchV1Api);
    return this.apis.batchApi;
  }

  get versionApi(): k8s.VersionApi {
    if (!this.apis.versionApi) this.apis.versionApi = this.makeApi(k8s.VersionApi);
    return this.apis.versionApi;
  }

  get autoscalingApi(): any {
    if (!this.apis.autoscalingApi) this.apis.autoscalingApi = this.makeApi(k8s.AutoscalingV2Api);
    return this.apis.autoscalingApi;
  }

  get customObjectsApi(): any {
    if (!this.apis.customObjectsApi) this.apis.customObjectsApi = this.makeApi(k8s.CustomObjectsApi);
    return this.apis.customObjectsApi;
  }

  get rbacApi(): k8s.RbacAuthorizationV1Api {
    if (!this.apis.rbacApi) this.apis.rbacApi = this.makeApi(k8s.RbacAuthorizationV1Api);
    return this.apis.rbacApi;
  }

  private makeApi<T>(ctor: any): T {
    if (!this.kc) throw new Error('KubeConfig not loaded');
    return this.kc.makeApiClient(ctor) as T;
  }

  clearCache() {
    this.cachedConfig = null;
    this.apis = {};
  }

  async loadConfig(): Promise<K8sConfig> {
    if (this.cachedConfig) {
      return this.cachedConfig;
    }

    const explicitProvider = process.env.K8S_PROVIDER;
    
    this.kc = new k8s.KubeConfig();

    let provider: K8sProvider;
    let configLoaded = false;

    if (explicitProvider && explicitProvider !== 'auto') {
      provider = explicitProvider as K8sProvider;
      log.info(`Using explicit provider: ${provider}`);
      configLoaded = await this.loadProviderConfig(provider);
    } else {
      log.info('Auto-detecting Kubernetes provider...');
      const detected = await this.autoDetectProvider();
      if (detected) {
        provider = detected.provider;
        configLoaded = detected.success;
        log.info(`Detected provider: ${provider}, config loaded: ${configLoaded}`);
      } else {
        provider = 'custom';
        configLoaded = false;
        log.warn('No Kubernetes cluster detected');
      }
    }

    if (configLoaded && this.kc) {
      this.applyTimeoutSettings();
      const cluster = this.kc.getCurrentCluster();
      log.info(`Kubernetes config loaded for ${provider}: ${cluster?.server}`);

      let isConnected = false;
      try {
        await this.testConnection();
        isConnected = true;
        log.info(`Kubernetes connection test passed for ${provider}`);
      } catch (error: any) {
        log.warn(`Kubernetes cluster not reachable for ${provider}: ${error.message}`);
      }

      this.cachedConfig = {
        provider,
        kubeConfig: this.kc,
        apiServer: cluster?.server || '',
        namespace: process.env.DEFAULT_NAMESPACE || 'default',
        connected: isConnected,
      };
      return this.cachedConfig;
    }

    this.cachedConfig = {
      provider,
      kubeConfig: this.kc,
      apiServer: '',
      namespace: 'default',
      connected: false,
    };
    return this.cachedConfig;
  }

  private async loadProviderConfig(provider: K8sProvider): Promise<boolean> {
    try {
      switch (provider) {
        case 'minikube':
          this.loadMinikubeConfig();
          return true;
        case 'kind':
          this.loadKindConfig();
          return true;
        case 'k3s':
          this.loadK3sConfig();
          return true;
        case 'k3d':
          this.loadK3dConfig();
          return true;
        case 'docker-desktop':
          this.loadDockerDesktopConfig();
          return true;
        case 'microk8s':
          this.loadMicroK8sConfig();
          return true;
        case 'kubeadm':
          this.loadKubeadmConfig();
          return true;
        case 'rancher':
          this.loadRancherConfig();
          return true;
        case 'eks':
          this.loadEKSConfig();
          return true;
        case 'gke':
          this.loadGKEConfig();
          return true;
        case 'aks':
          this.loadAKSConfig();
          return true;
        case 'custom':
          this.loadCustomConfig();
          return true;
        default:
          return false;
      }
    } catch (error) {
      log.error(`Failed to load ${provider} config:`, error);
      return false;
    }
  }

  private async autoDetectProvider(): Promise<{ provider: K8sProvider; success: boolean } | null> {
    log.info('Starting auto-detection of Kubernetes provider');

    // Try to find kubeconfig in common Windows locations
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const windowsKubeConfigPaths = [
      path.join(home, '.kube', 'config'),
      path.join(home, '.kube', 'kubeconfig'),
    ];

    for (const kubeConfigPath of windowsKubeConfigPaths) {
      try {
        log.info(`Trying Windows kubeconfig path: ${kubeConfigPath}`);
        if (fs.existsSync(kubeConfigPath)) {
          this.kc!.loadFromFile(kubeConfigPath);
          const context = this.kc!.getCurrentContext();
          const cluster = this.kc!.getCurrentCluster();
          log.info(`Kubeconfig loaded from ${kubeConfigPath} - context: ${context}, server: ${cluster?.server}`);
          
          await this.testConnection();
          log.info('Connection test successful!');
          
          // Detect provider from context name
          let detectedProvider: K8sProvider = 'custom';
          if (context) {
            if (context.includes('minikube')) detectedProvider = 'minikube';
            else if (context.includes('k3s') && !context.includes('k3d')) detectedProvider = 'k3s';
            else if (context.includes('k3d')) detectedProvider = 'k3d';
            else if (context.includes('kind')) detectedProvider = 'kind';
            else if (context.includes('docker-desktop') || context.includes('docker-for-desktop')) detectedProvider = 'docker-desktop';
            else if (context.includes('microk8s')) detectedProvider = 'microk8s';
          }
          return { provider: detectedProvider, success: true };
        }
      } catch (error) {
        log.debug(`Failed to load from ${kubeConfigPath}:`, error);
      }
      this.kc = new k8s.KubeConfig();
    }

    // Try minikube first on Windows - use exec to get kubeconfig
    if (process.platform === 'win32') {
      try {
        log.info('Trying minikube on Windows...');
        const { execSync } = require('child_process');
        const kubeconfigStr = execSync('minikube config view --flatten --merge', { encoding: 'utf8', timeout: 10000 });
        if (kubeconfigStr && kubeconfigStr.trim()) {
          this.kc!.loadFromString(kubeconfigStr);
          const context = this.kc!.getCurrentContext();
          const cluster = this.kc!.getCurrentCluster();
          log.info(`Minikube kubeconfig loaded - context: ${context}, server: ${cluster?.server}`);
          
          await this.testConnection();
          log.info('Connection test successful!');
          return { provider: 'minikube', success: true };
        }
      } catch (error) {
        log.debug('Failed with minikube command:', error);
        this.kc = new k8s.KubeConfig();
      }
    }

    // First, try to load from default kubeconfig (works for most setups)
    try {
      log.info('Trying default kubeconfig...');
      this.kc!.loadFromDefault();
      const context = this.kc!.getCurrentContext();
      const cluster = this.kc!.getCurrentCluster();
      log.info(`Default kubeconfig loaded - context: ${context}, server: ${cluster?.server}`);
      
      await this.testConnection();
      log.info('Connection test successful!');
      
      // Detect provider from context name
      let detectedProvider: K8sProvider = 'custom';
      if (context) {
        if (context.includes('minikube')) detectedProvider = 'minikube';
        else if (context.includes('k3s') && !context.includes('k3d')) detectedProvider = 'k3s';
        else if (context.includes('k3d')) detectedProvider = 'k3d';
        else if (context.includes('kind')) detectedProvider = 'kind';
        else if (context.includes('docker-desktop') || context.includes('docker-for-desktop')) detectedProvider = 'docker-desktop';
        else if (context.includes('microk8s')) detectedProvider = 'microk8s';
      }
      return { provider: detectedProvider, success: true };
    } catch (error: any) {
      log.debug('Failed with default kubeconfig:', error);
      this.kc = new k8s.KubeConfig();
    }

    // Try specific providers (minikube first for Windows)
    try {
      log.info('Trying minikube...');
      if (this.tryLoadMinikube()) {
        await this.testConnection();
        return { provider: 'minikube', success: true };
      }
    } catch (error) {
      log.debug('Failed with default kubeconfig:', error);
      this.kc = new k8s.KubeConfig();
    }

    // Try specific providers
    const detectionMethods: Array<{ name: K8sProvider; fn: () => boolean }> = [
      { name: 'k3s', fn: () => this.tryLoadK3s() },
      { name: 'k3d', fn: () => this.tryLoadK3d() },
      { name: 'kind', fn: () => this.tryLoadKind() },
      { name: 'docker-desktop', fn: () => this.tryLoadDockerDesktop() },
      { name: 'microk8s', fn: () => this.tryLoadMicroK8s() },
    ];

    for (const method of detectionMethods) {
      try {
        log.info(`Trying to detect: ${method.name}`);
        const success = method.fn();
        if (success) {
          await this.testConnection();
          return { provider: method.name, success: true };
        }
      } catch (error) {
        log.debug(`Failed to load ${method.name}:`, error);
      }
      this.kc = new k8s.KubeConfig();
    }

    return null;
  }

  private async testConnection(): Promise<void> {
    if (!this.kc) throw new Error('No kubeconfig');
    
    const user = this.kc.getCurrentUser();
    const cluster = this.kc.getCurrentCluster();
    log.info(`Testing connection - user: ${user?.name}, cluster: ${cluster?.server}, hasCert: ${!!user?.certData}, hasToken: ${!!user?.token}`);
    
    if (!user) {
      throw new Error('No user credentials in kubeconfig');
    }
    
    const coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    try {
      await coreApi.listNamespace();
    } catch (err: any) {
      log.error(`Connection test failed: ${err.message}`);
      throw err;
    }
  }

  private tryLoadDockerDesktop(): boolean {
    try {
      const kubeConfigPath = process.env.DOCKER_DESKTOP_KUBECONFIG || '~/.kube/config';
      const expandedPath = this.expandPath(kubeConfigPath);
      if (fs.existsSync(expandedPath)) {
        this.kc!.loadFromFile(expandedPath);
        return true;
      }
      this.kc!.loadFromDefault();
      const context = this.kc!.getCurrentContext();
      return context.includes('docker-desktop') || context.includes('docker-for-desktop');
    } catch {
      return false;
    }
  }

  private tryLoadK3s(): boolean {
    try {
      const k3sUrl = process.env.K3S_URL || 'https://localhost:6443';
      const k3sToken = process.env.K3S_TOKEN || this.getK3sToken();
      const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

      if (k3sToken) {
        this.kc!.loadFromOptions({
          clusters: [{ name: 'k3s', server: k3sUrl, skipTLSVerify: skipTls }],
          users: [{ name: 'k3s-user', token: k3sToken }],
          contexts: [{ name: 'k3s', cluster: 'k3s', user: 'k3s-user' }],
          currentContext: 'k3s',
        });
        return true;
      }

      const kubeConfigPath = process.env.K3S_KUBECONFIG || '/etc/rancher/k3s/k3s.yaml';
      if (fs.existsSync(kubeConfigPath)) {
        this.kc!.loadFromFile(kubeConfigPath);
        return true;
      }

      this.kc!.loadFromDefault();
      const context = this.kc!.getCurrentContext();
      return context.includes('k3s');
    } catch {
      return false;
    }
  }

  private getK3sToken(): string | null {
    const tokenPaths = [
      '/var/lib/rancher/k3s/server/agent-token',
      '/var/lib/rancher/k3s/server/cluster-secret',
    ];
    for (const p of tokenPaths) {
      if (fs.existsSync(p)) {
        try {
          return fs.readFileSync(p, 'utf8').trim();
        } catch (error) { log.warn(`[k8s-config] Failed to read K3s token from ${p}: ${(error as Error).message}`); }
      }
    }
    return null;
  }

  private tryLoadK3d(): boolean {
    try {
      const kubeConfigPath = process.env.K3D_KUBECONFIG || '~/.kube/config';
      const expandedPath = this.expandPath(kubeConfigPath);
      if (fs.existsSync(expandedPath)) {
        this.kc!.loadFromFile(expandedPath);
        const context = this.kc!.getCurrentContext();
        return context.includes('k3d');
      }
      return false;
    } catch {
      return false;
    }
  }

  private tryLoadMinikube(): boolean {
    try {
      const ip = process.env.MINIKUBE_IP;
      const port = process.env.MINIKUBE_PORT;
      const token = process.env.MINIKUBE_TOKEN;
      const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

      if (token && ip) {
        this.kc!.loadFromOptions({
          clusters: [{ name: 'minikube', server: `https://${ip}:${port || '8443'}`, skipTLSVerify: skipTls }],
          users: [{ name: 'minikube-user', token }],
          contexts: [{ name: 'minikube', cluster: 'minikube', user: 'minikube-user' }],
          currentContext: 'minikube',
        });
        return true;
      }

      // Try Windows default location
      const home = process.env.USERPROFILE || process.env.HOME || '';
      const windowsPaths = [
        path.join(home, '.kube', 'config'),
        'C:\\Program Files\\Minikube\\kubeconfig',
        '~/.kube/config',
      ];

      for (const kubeConfigPath of windowsPaths) {
        const expandedPath = this.expandPath(kubeConfigPath);
        if (fs.existsSync(expandedPath)) {
          this.kc!.loadFromFile(expandedPath);
          const context = this.kc!.getCurrentContext();
          if (context?.includes('minikube')) {
            return true;
          }
        }
      }

      // Try with explicit minikube kubeconfig
      const minikubeKubeConfigPath = process.env.MINIKUBE_KUBECONFIG;
      if (minikubeKubeConfigPath && fs.existsSync(minikubeKubeConfigPath)) {
        this.kc!.loadFromFile(minikubeKubeConfigPath);
        this.kc!.setCurrentContext('minikube');
        return true;
      }

      // Try minikube profile if installed
      try {
        const { execSync } = require('child_process');
        const kubeconfig = execSync('minikube kubeconfig', { encoding: 'utf8' });
        if (kubeconfig) {
          this.kc!.loadFromString(kubeconfig);
          return true;
        }
      } catch (error) { log.warn(`[k8s-config] Failed to exec minikube kubeconfig: ${(error as Error).message}`); }

      return false;
    } catch {
      return false;
    }
  }

  private tryLoadKind(): boolean {
    try {
      const kubeConfigPath = process.env.KIND_KUBECONFIG || '~/.kube/config';
      const expandedPath = this.expandPath(kubeConfigPath);
      if (fs.existsSync(expandedPath)) {
        this.kc!.loadFromFile(expandedPath);
        const context = this.kc!.getCurrentContext();
        return context.includes('kind');
      }
      return false;
    } catch {
      return false;
    }
  }

  private tryLoadMicroK8s(): boolean {
    try {
      const kubeConfigPath = process.env.MICROK8S_KUBECONFIG || '~/.kube/config';
      const expandedPath = this.expandPath(kubeConfigPath);
      if (fs.existsSync(expandedPath)) {
        this.kc!.loadFromFile(expandedPath);
        const context = this.kc!.getCurrentContext();
        return context.includes('microk8s');
      }

      const microk8sConfig = path.join(process.env.HOME || process.env.USERPROFILE || '', '.kube', 'config');
      if (fs.existsSync(microk8sConfig)) {
        this.kc!.loadFromFile(microk8sConfig);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  private tryLoadKubeadm(): boolean {
    try {
      const apiServer = process.env.KUBEADM_API_SERVER;
      const token = process.env.KUBEADM_TOKEN;

      if (apiServer && token) {
        this.kc!.loadFromOptions({
          clusters: [{ name: 'kubeadm', server: apiServer, skipTLSVerify: process.env.K8S_SKIP_TLS_VERIFY === 'true' }],
          users: [{ name: 'kubeadm-user', token }],
          contexts: [{ name: 'kubeadm', cluster: 'kubeadm', user: 'kubeadm-user' }],
          currentContext: 'kubeadm',
        });
        return true;
      }

      this.kc!.loadFromDefault();
      return true;
    } catch {
      return false;
    }
  }

  private applyTimeoutSettings(): void {
    // Timeout settings can be applied per-request if needed
  }

  private expandPath(p: string): string {
    if (p.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '';
      return path.join(home, p.slice(1));
    }
    return p;
  }

  private loadKubeConfigFile(filePath: string): void {
    const expandedPath = this.expandPath(filePath);
    log.info(`Attempting to load kubeconfig from: ${expandedPath}`);
    log.info(`File exists: ${fs.existsSync(expandedPath)}`);
    if (fs.existsSync(expandedPath)) {
      this.kc!.loadFromFile(expandedPath);
    } else {
      log.info('Kubeconfig file not found, trying loadFromDefault()');
      this.kc!.loadFromDefault();
    }
  }

  private loadMinikubeConfig(): void {
    const ip = process.env.MINIKUBE_IP;
    const port = process.env.MINIKUBE_PORT;
    const token = process.env.MINIKUBE_TOKEN;
    const caCert = process.env.MINIKUBE_CA_CERT;
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    if (token && ip) {
      this.kc!.loadFromOptions({
        clusters: [{
          name: 'minikube',
          server: `https://${ip}:${port || '8443'}`,
          caData: caCert,
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: 'minikube-user',
          token: token,
        }],
        contexts: [{
          name: 'minikube',
          cluster: 'minikube',
          user: 'minikube-user',
        }],
        currentContext: 'minikube',
      });
    } else {
      const kubeConfigPath = process.env.MINIKUBE_KUBECONFIG || '~/.kube/config';
      log.info(`Loading minikube config from: ${kubeConfigPath}`);
      this.loadKubeConfigFile(kubeConfigPath);
      
      this.kc!.setCurrentContext('minikube');
    }
  }

  private loadKindConfig(): void {
    const kubeConfigPath = process.env.KIND_KUBECONFIG || '~/.kube/config';
    const clusterName = process.env.KIND_CLUSTER_NAME || 'kind';
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    const expandedPath = this.expandPath(kubeConfigPath);
    if (fs.existsSync(expandedPath)) {
      this.kc!.loadFromFile(expandedPath);
    } else {
      this.kc!.loadFromOptions({
        clusters: [{
          name: clusterName,
          server: 'https://localhost:6443',
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: 'kind-user',
          exec: {
            command: 'kind',
            args: ['get', 'kubeconfig', '--name', clusterName],
            apiVersion: 'client.authentication.k8s.io/v1beta1',
          },
        }],
        contexts: [{
          name: clusterName,
          cluster: clusterName,
          user: 'kind-user',
        }],
        currentContext: clusterName,
      });
    }
  }

  private loadK3sConfig(): void {
    const k3sUrl = process.env.K3S_URL || 'https://localhost:6443';
    const k3sToken = process.env.K3S_TOKEN;
    const k3sCaCert = process.env.K3S_CA_CERT;
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    if (k3sToken) {
      this.kc!.loadFromOptions({
        clusters: [{
          name: 'k3s',
          server: k3sUrl,
          caData: k3sCaCert,
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: 'k3s-user',
          token: k3sToken,
        }],
        contexts: [{
          name: 'k3s',
          cluster: 'k3s',
          user: 'k3s-user',
        }],
        currentContext: 'k3s',
      });
    } else {
      this.loadKubeConfigFile(process.env.K3S_KUBECONFIG || '~/.kube/config');
    }
  }

  private loadK3dConfig(): void {
    const kubeConfigPath = process.env.K3D_KUBECONFIG || '~/.kube/config';
    const clusterName = process.env.K3D_CLUSTER_NAME || 'k3s-default';
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    const expandedPath = this.expandPath(kubeConfigPath);
    if (fs.existsSync(expandedPath)) {
      this.kc!.loadFromFile(expandedPath);
    } else {
      this.kc!.loadFromOptions({
        clusters: [{
          name: clusterName,
          server: 'https://localhost:6443',
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: 'k3d-user',
          exec: {
            command: 'k3d',
            args: ['kubeconfig', 'get', clusterName],
            apiVersion: 'client.authentication.k8s.io/v1beta1',
          },
        }],
        contexts: [{
          name: clusterName,
          cluster: clusterName,
          user: 'k3d-user',
        }],
        currentContext: clusterName,
      });
    }
  }

  private loadDockerDesktopConfig(): void {
    const kubeConfigPath = process.env.DOCKER_DESKTOP_KUBECONFIG || '~/.kube/config';

    const expandedPath = this.expandPath(kubeConfigPath);
    if (fs.existsSync(expandedPath)) {
      this.kc!.loadFromFile(expandedPath);
    } else {
      this.kc!.loadFromDefault();
    }
  }

  private loadMicroK8sConfig(): void {
    const kubeConfigPath = process.env.MICROK8S_KUBECONFIG || '~/.kube/config';
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    const expandedPath = this.expandPath(kubeConfigPath);
    if (fs.existsSync(expandedPath)) {
      this.kc!.loadFromFile(expandedPath);
    } else {
      this.kc!.loadFromOptions({
        clusters: [{
          name: 'microk8s',
          server: 'https://localhost:16443',
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: 'microk8s-user',
          exec: {
            command: 'microk8s',
            args: ['kubectl', 'config', 'view', '--raw'],
            apiVersion: 'client.authentication.k8s.io/v1beta1',
          },
        }],
        contexts: [{
          name: 'microk8s',
          cluster: 'microk8s',
          user: 'microk8s-user',
        }],
        currentContext: 'microk8s',
      });
    }
  }

  private loadKubeadmConfig(): void {
    const apiServer = process.env.KUBEADM_API_SERVER;
    const caCert = process.env.KUBEADM_CA_CERT;
    const token = process.env.KUBEADM_TOKEN;
    const nodeName = process.env.KUBEADM_NODE_NAME || 'kubeadm-node';
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    if (apiServer && token) {
      this.kc!.loadFromOptions({
        clusters: [{
          name: 'kubeadm',
          server: apiServer,
          caData: caCert,
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: nodeName,
          token: token,
        }],
        contexts: [{
          name: 'kubeadm',
          cluster: 'kubeadm',
          user: nodeName,
          namespace: process.env.DEFAULT_NAMESPACE || 'default',
        }],
        currentContext: 'kubeadm',
      });
    } else {
      this.kc!.loadFromDefault();
    }
  }

  private loadRancherConfig(): void {
    const rancherUrl = process.env.RANCHER_URL;
    const rancherToken = process.env.RANCHER_TOKEN;
    const clusterId = process.env.RANCHER_CLUSTER_ID;

    if (rancherUrl && rancherToken) {
      this.kc!.loadFromOptions({
        clusters: [{
          name: 'rancher',
          server: rancherUrl,
          skipTLSVerify: false,
        }],
        users: [{
          name: 'rancher-user',
          token: rancherToken,
        }],
        contexts: [{
          name: clusterId || 'default',
          cluster: 'rancher',
          user: 'rancher-user',
        }],
        currentContext: clusterId || 'default',
      });
    } else {
      this.kc!.loadFromDefault();
    }
  }

  private loadEKSConfig(): void {
    const region = process.env.AWS_REGION || 'us-east-1';
    const clusterName = process.env.EKS_CLUSTER_NAME;
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    if (clusterName) {
      this.kc!.loadFromOptions({
        clusters: [{
          name: clusterName,
          server: `https://${clusterName}.eks.${region}.amazonaws.com`,
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: 'eks-user',
          exec: {
            command: 'aws',
            args: ['eks', 'get-token', '--cluster-name', clusterName, '--region', region],
            apiVersion: 'client.authentication.k8s.io/v1beta1',
          },
        }],
        contexts: [{
          name: 'eks',
          cluster: clusterName,
          user: 'eks-user',
        }],
        currentContext: 'eks',
      });
    } else {
      this.loadKubeConfigFile(process.env.EKS_KUBECONFIG || '~/.kube/config');
    }
  }

  private loadGKEConfig(): void {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_REGION || 'us-central1';
    const clusterName = process.env.GKE_CLUSTER_NAME;
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    if (projectId && clusterName) {
      this.kc!.loadFromOptions({
        clusters: [{
          name: clusterName,
          server: `https://${location}/projects/${projectId}/locations/${location}/clusters/${clusterName}`,
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: 'gke-user',
          exec: {
            command: 'gcloud',
            args: ['container', 'clusters', 'get-credentials', clusterName, `--region=${location}`, `--project=${projectId}`],
            apiVersion: 'client.authentication.k8s.io/v1beta1',
          },
        }],
        contexts: [{
          name: 'gke',
          cluster: clusterName,
          user: 'gke-user',
        }],
        currentContext: 'gke',
      });
    } else {
      this.kc!.loadFromDefault();
    }
  }

  private loadAKSConfig(): void {
    const subscriptionId = process.env.AZURE_SUBSCRIPTION_ID;
    const resourceGroup = process.env.AZURE_RESOURCE_GROUP;
    const clusterName = process.env.AKS_CLUSTER_NAME;
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    if (subscriptionId && resourceGroup && clusterName) {
      this.kc!.loadFromOptions({
        clusters: [{
          name: clusterName,
          server: `https://${clusterName}.${resourceGroup}.azmk8s.io`,
          skipTLSVerify: skipTls,
        }],
        users: [{
          name: 'aks-user',
          exec: {
            command: 'az',
            args: ['aks', 'get-credentials', '--resource-group', resourceGroup, '--name', clusterName, '--admin'],
            apiVersion: 'client.authentication.k8s.io/v1beta1',
          },
        }],
        contexts: [{
          name: clusterName,
          cluster: clusterName,
          user: 'aks-user',
        }],
        currentContext: clusterName,
      });
    } else {
      this.kc!.loadFromDefault();
    }
  }

  private loadCustomConfig(): void {
    const apiServer = process.env.CUSTOM_K8S_API_SERVER;
    const caCert = process.env.CUSTOM_K8S_CA_CERT;
    const clientCert = process.env.CUSTOM_K8S_CLIENT_CERT;
    const clientKey = process.env.CUSTOM_K8S_CLIENT_KEY;
    const token = process.env.CUSTOM_K8S_TOKEN;
    const namespace = process.env.CUSTOM_K8S_NAMESPACE || 'default';
    const skipTls = process.env.K8S_SKIP_TLS_VERIFY === 'true';

    if (apiServer) {
      if (clientCert && clientKey) {
        this.kc!.loadFromOptions({
          clusters: [{
            name: 'custom',
            server: apiServer,
            caData: caCert,
            skipTLSVerify: skipTls,
          }],
          users: [{
            name: 'custom-user',
            certData: clientCert,
            keyData: clientKey,
          }],
          contexts: [{
            name: 'custom',
            cluster: 'custom',
            user: 'custom-user',
            namespace: namespace,
          }],
          currentContext: 'custom',
        });
      } else if (token) {
        this.kc!.loadFromOptions({
          clusters: [{
            name: 'custom',
            server: apiServer,
            caData: caCert,
            skipTLSVerify: skipTls,
          }],
          users: [{
            name: 'custom-user',
            token: token,
          }],
          contexts: [{
            name: 'custom',
            cluster: 'custom',
            user: 'custom-user',
            namespace: namespace,
          }],
          currentContext: 'custom',
        });
      } else {
        this.kc!.loadFromDefault();
      }
    } else {
      this.kc!.loadFromDefault();
    }
  }

  getConfig(): k8s.KubeConfig | null {
    return this.kc;
  }

  getApiServerUrl(): string | null {
    if (!this.kc) return null;
    const cluster = this.kc.getCurrentCluster();
    return cluster?.server || null;
  }
}

export const k8sConfigManager = new KubernetesConfigManager();
