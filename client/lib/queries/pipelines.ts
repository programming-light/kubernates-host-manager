import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

interface AvailableBuildPack {
  pack: string;
  label: string;
  description: string;
}

interface DetectResult {
  language: string;
  framework: string | null;
  port: number;
  healthCheckPath: string;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  suggestedBuildPack: string;
  availableBuildPacks: AvailableBuildPack[];
  buildConfig: {
    buildCommand: string;
    runCommand: string;
    port: number;
  };
}

interface BuildResult {
  message: string;
  deploymentId: string;
  image: string;
  buildPack: string;
}

interface DeployResult {
  message: string;
  image: string;
}

interface RunResult {
  message: string;
  image: string;
}

interface PipelineStatus {
  project: {
    id: string;
    name: string;
    status: string;
    currentImageTag: string | null;
  };
  deployments: Array<{
    id: string;
    version: string;
    status: string;
    imageTag: string | null;
    environment: string;
    deployedAt: string | null;
    createdAt: string;
  }>;
}

export const pipelineKeys = {
  all: ['pipelines'] as const,
  status: (projectId: string) => [...pipelineKeys.all, 'status', projectId] as const,
  detect: (projectId: string) => [...pipelineKeys.all, 'detect', projectId] as const,
};

export function usePipelineDetect(projectId: string) {
  return useQuery({
    queryKey: pipelineKeys.detect(projectId),
    queryFn: () => apiClient.post<DetectResult>(`/pipeline/${projectId}/detect`),
    enabled: !!projectId,
    retry: false,
  });
}

export function usePipelineStatus(projectId: string) {
  return useQuery({
    queryKey: pipelineKeys.status(projectId),
    queryFn: () => apiClient.get<PipelineStatus>(`/pipeline/${projectId}/status`),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 5000;
      const building = data.deployments.some(d => d.status === 'building' || d.status === 'built');
      return building ? 5000 : false;
    },
  });
}

export function usePipelineBuild(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: {
      branch?: string;
      buildPack?: string;
      buildCommand?: string;
      runCommand?: string;
      rootDir?: string;
      port?: number;
      healthCheckPath?: string;
      envVars?: Array<{ name: string; value: string }>;
    }) => apiClient.post<BuildResult>(`/pipeline/${projectId}/build`, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pipelineKeys.status(projectId) });
    },
  });
}

export function usePipelineDeploy(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: {
      deploymentId?: string;
      envVars?: Array<{ name: string; value: string }>;
      replicas?: number;
      resources?: { limits?: { cpu?: string; memory?: string }; requests?: { cpu?: string; memory?: string } };
      domain?: string;
    }) => apiClient.post<DeployResult>(`/pipeline/${projectId}/deploy`, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pipelineKeys.status(projectId) });
    },
  });
}

export function usePipelineRun(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: {
      envVars?: Array<{ name: string; value: string }>;
      image?: string;
    }) => apiClient.post<RunResult>(`/pipeline/${projectId}/run`, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pipelineKeys.status(projectId) });
    },
  });
}

export function usePipelineCancelRun(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (opts: { podName?: string }) =>
      apiClient.post<{ message: string }>(`/pipeline/${projectId}/cancel-run`, opts),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: pipelineKeys.status(projectId) });
    },
  });
}
