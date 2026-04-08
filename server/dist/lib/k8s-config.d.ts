import * as k8s from '@kubernetes/client-node';
export type K8sProvider = 'minikube' | 'kind' | 'k3s' | 'k3d' | 'docker-desktop' | 'microk8s' | 'kubeadm' | 'rancher' | 'eks' | 'gke' | 'aks' | 'custom';
export interface K8sConfig {
    provider: K8sProvider;
    kubeConfig: k8s.KubeConfig;
    apiServer: string;
    namespace: string;
    connected: boolean;
}
declare class KubernetesConfigManager {
    private kc;
    loadConfig(): Promise<K8sConfig>;
    private expandPath;
    private loadKubeConfigFile;
    private loadMinikubeConfig;
    private loadKindConfig;
    private loadK3sConfig;
    private loadK3dConfig;
    private loadDockerDesktopConfig;
    private loadMicroK8sConfig;
    private loadKubeadmConfig;
    private loadRancherConfig;
    private loadEKSConfig;
    private loadGKEConfig;
    private loadAKSConfig;
    private loadCustomConfig;
    getConfig(): k8s.KubeConfig | null;
}
export declare const k8sConfigManager: KubernetesConfigManager;
export {};
