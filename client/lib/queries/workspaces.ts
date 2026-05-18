import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Workspace } from '@/lib/types';

export const workspaceKeys = {
  all: ['workspaces'] as const,
  lists: () => [...workspaceKeys.all, 'list'] as const,
  list: () => [...workspaceKeys.lists()] as const,
  details: () => [...workspaceKeys.all, 'detail'] as const,
  detail: (id: string) => [...workspaceKeys.details(), id] as const,
  env: (id: string) => [...workspaceKeys.all, 'env', id] as const,
};

export const workspaceQueries = {
  list: () => ({
    queryKey: workspaceKeys.list(),
    queryFn: () => apiClient.get<Workspace[]>('/workspaces'),
  }),
  detail: (id: string) => ({
    queryKey: workspaceKeys.detail(id),
    queryFn: () => apiClient.get<Workspace>(`/workspaces/${id}`),
    enabled: !!id,
  }),
  env: (id: string) => ({
    queryKey: workspaceKeys.env(id),
    queryFn: () => apiClient.get(`/workspaces/${id}/env`),
    enabled: !!id,
  }),
};

export function useWorkspaces() {
  return useQuery(workspaceQueries.list());
}

export function useWorkspace(id: string) {
  return useQuery(workspaceQueries.detail(id));
}

export function useWorkspaceEnv(id: string) {
  return useQuery(workspaceQueries.env(id));
}

export function useDeleteWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/workspaces/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: workspaceKeys.lists() }),
  });
}
