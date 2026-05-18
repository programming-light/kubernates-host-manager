import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { K8sStatus, K8sPod, K8sService, K8sNamespace, K8sNode, K8sDeployment, K8sIngress } from '@/lib/types';

export const k8sKeys = {
  all: ['kubernetes'] as const,
  status: () => [...k8sKeys.all, 'status'] as const,
  pods: (namespace: string) => [...k8sKeys.all, 'pods', namespace] as const,
  services: (namespace: string) => [...k8sKeys.all, 'services', namespace] as const,
  namespaces: () => [...k8sKeys.all, 'namespaces'] as const,
  nodes: () => [...k8sKeys.all, 'nodes'] as const,
  deployments: (namespace: string) => [...k8sKeys.all, 'deployments', namespace] as const,
  ingresses: (namespace: string) => [...k8sKeys.all, 'ingresses', namespace] as const,
};

export const k8sQueries = {
  status: () => ({
    queryKey: k8sKeys.status(),
    queryFn: () => apiClient.get<K8sStatus>('/kubernetes/status'),
  }),
  pods: (namespace: string) => ({
    queryKey: k8sKeys.pods(namespace),
    queryFn: () => apiClient.get<K8sPod[]>(`/kubernetes/pods?namespace=${namespace}`),
  }),
  services: (namespace: string) => ({
    queryKey: k8sKeys.services(namespace),
    queryFn: () => apiClient.get<K8sService[]>(`/kubernetes/services?namespace=${namespace}`),
  }),
  namespaces: () => ({
    queryKey: k8sKeys.namespaces(),
    queryFn: () => apiClient.get<K8sNamespace[]>('/kubernetes/namespaces'),
  }),
  nodes: () => ({
    queryKey: k8sKeys.nodes(),
    queryFn: () => apiClient.get<K8sNode[]>('/kubernetes/nodes'),
  }),
  deployments: (namespace: string) => ({
    queryKey: k8sKeys.deployments(namespace),
    queryFn: () => apiClient.get<K8sDeployment[]>(`/kubernetes/deployments?namespace=${namespace}`),
  }),
  ingresses: (namespace: string) => ({
    queryKey: k8sKeys.ingresses(namespace),
    queryFn: () => apiClient.get<K8sIngress[]>(`/kubernetes/ingresses?namespace=${namespace}`),
  }),
};

export function useK8sStatus() {
  return useQuery(k8sQueries.status());
}

export function useK8sPods(namespace: string) {
  return useQuery(k8sQueries.pods(namespace));
}

export function useK8sServices(namespace: string) {
  return useQuery(k8sQueries.services(namespace));
}

export function useK8sNamespaces() {
  return useQuery(k8sQueries.namespaces());
}

export function useK8sNodes() {
  return useQuery(k8sQueries.nodes());
}

export function useK8sDeployments(namespace: string) {
  return useQuery(k8sQueries.deployments(namespace));
}

export function useK8sIngresses(namespace: string) {
  return useQuery(k8sQueries.ingresses(namespace));
}
