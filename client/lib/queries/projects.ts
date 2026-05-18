import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Project } from '@/lib/types';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: Record<string, string>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  env: (id: string) => [...projectKeys.all, 'env', id] as const,
};

export const projectQueries = {
  list: (workspaceId?: string) => ({
    queryKey: projectKeys.list(workspaceId ? { workspaceId } : undefined),
    queryFn: () => {
      const qs = workspaceId ? `?workspaceId=${workspaceId}` : '';
      return apiClient.get<Project[]>(`/projects${qs}`);
    },
  }),
  detail: (id: string) => ({
    queryKey: projectKeys.detail(id),
    queryFn: () => apiClient.get<Project>(`/projects/${id}`),
    enabled: !!id,
  }),
  env: (id: string) => ({
    queryKey: projectKeys.env(id),
    queryFn: () => apiClient.get<{ project?: Record<string, unknown>; workspace?: Record<string, unknown> }>(`/projects/${id}/env`),
    enabled: !!id,
  }),
};

export function useProjects(workspaceId?: string) {
  return useQuery(projectQueries.list(workspaceId));
}

export function useProject(id: string) {
  return useQuery(projectQueries.detail(id));
}

export function useProjectEnv(id: string) {
  return useQuery(projectQueries.env(id));
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/projects/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.lists() }),
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Record<string, unknown>) => apiClient.post('/projects', data),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.lists() }),
  });
}
