import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Cluster } from '@/lib/types';

export const clusterKeys = {
  all: ['clusters'] as const,
  lists: () => [...clusterKeys.all, 'list'] as const,
  list: (workspaceId?: string) => [...clusterKeys.lists(), workspaceId] as const,
  details: () => [...clusterKeys.all, 'detail'] as const,
  detail: (id: string) => [...clusterKeys.details(), id] as const,
};

export const clusterQueries = {
  list: (workspaceId?: string) => ({
    queryKey: clusterKeys.list(workspaceId),
    queryFn: () => {
      const qs = workspaceId ? `?workspaceId=${workspaceId}` : '';
      return apiClient.get<Cluster[]>(`/clusters${qs}`);
    },
  }),
};

export function useClusters(workspaceId?: string) {
  return useQuery(clusterQueries.list(workspaceId));
}

export function useCreateCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/clusters', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: clusterKeys.lists() }),
  });
}

export function useDeleteCluster() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/clusters/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: clusterKeys.lists() }),
  });
}
