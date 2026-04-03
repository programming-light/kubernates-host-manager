import useSWR, { mutate } from 'swr';
import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

export function useProjects(workspaceId: string) {
  const { data, error, isLoading } = useSWR(
    workspaceId ? `${API_BASE}/workspaces/${workspaceId}/projects` : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch projects');
      return res.json();
    },
  );

  return {
    projects: data?.projects || [],
    isLoading,
    error,
    mutate: () => mutate(`${API_BASE}/workspaces/${workspaceId}/projects`),
  };
}

export function useProject(workspaceId: string, projectId: string) {
  const { data, error, isLoading } = useSWR(
    workspaceId && projectId ? `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}` : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch project');
      return res.json();
    },
  );

  return {
    project: data?.project,
    isLoading,
    error,
  };
}

export function useDeployments(workspaceId: string, projectId: string, limit: number = 10) {
  const { data, error, isLoading } = useSWR(
    workspaceId && projectId
      ? `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/deployments?limit=${limit}`
      : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch deployments');
      return res.json();
    },
    { refreshInterval: 5000 }, // Poll every 5 seconds
  );

  return {
    deployments: data?.deployments || [],
    isLoading,
    error,
    mutate: () =>
      mutate(
        `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/deployments?limit=${limit}`,
      ),
  };
}

export function useDeployment(workspaceId: string, projectId: string, deploymentId: string) {
  const { data, error, isLoading } = useSWR(
    workspaceId && projectId && deploymentId
      ? `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/deployments/${deploymentId}`
      : null,
    async (url) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to fetch deployment');
      return res.json();
    },
    { refreshInterval: 3000 },
  );

  return {
    deployment: data?.deployment,
    isLoading,
    error,
  };
}

export function useCreateProject() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createProject = async (workspaceId: string, projectData: any) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/workspaces/${workspaceId}/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(projectData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Failed to create project');
      }

      const data = await res.json();
      mutate(`${API_BASE}/workspaces/${workspaceId}/projects`);
      return data.project;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { createProject, isLoading, error };
}

export function useDeployFromDocker() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deploy = async (
    workspaceId: string,
    projectId: string,
    imageUrl: string,
    imagePullSecret?: string,
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/deployments/docker`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageUrl, imagePullSecret }),
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Deployment failed');
      }

      const data = await res.json();
      mutate(
        `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/deployments`,
      );
      return data.deployment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { deploy, isLoading, error };
}

export function useDeployFromGit() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deploy = async (workspaceId: string, projectId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/deployments/git`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Deployment failed');
      }

      const data = await res.json();
      mutate(
        `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/deployments`,
      );
      return data.deployment;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { deploy, isLoading, error };
}

export function useRestartDeployment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restart = async (workspaceId: string, projectId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/restart`,
        {
          method: 'POST',
        },
      );

      if (!res.ok) throw new Error('Restart failed');
      const data = await res.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { restart, isLoading, error };
}

export function useScaleDeployment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scale = async (workspaceId: string, projectId: string, replicas: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/scale`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ replicas }),
        },
      );

      if (!res.ok) throw new Error('Scale failed');
      const data = await res.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { scale, isLoading, error };
}

export function useUpdateEnvironmentVariables() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEnv = async (workspaceId: string, projectId: string, variables: any[]) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/workspaces/${workspaceId}/projects/${projectId}/env`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ variables }),
        },
      );

      if (!res.ok) throw new Error('Update failed');
      const data = await res.json();
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { updateEnv, isLoading, error };
}
