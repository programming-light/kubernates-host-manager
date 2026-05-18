'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDeploymentStore, useProjectStore } from '@/store';
import api from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Plus, Rocket, Layers, CheckCircle, XCircle, Clock, Play } from 'lucide-react';
import { toast } from 'sonner';
import { useSocket } from '@/lib/socket-context';
import { DeploymentStatus } from '@/lib/types';
import DeploymentCards from '@/components/deployments/DeploymentCards';

export default function DeploymentsPage() {
  const { deployments, setDeployments, updateDeployment, addDeployment } = useDeploymentStore();
  const { projects, setProjects } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { subscribe, unsubscribe, joinK8sUpdates } = useSocket();

  const queueStatsQ = useQuery({
    queryKey: ['build-queue', 'stats'],
    queryFn: async () => {
      try {
        const res = await api.get('/container/queue/stats');
        return await res.json();
      } catch { return { waiting: 0, active: 0, completed: 0, failed: 0 }; }
    },
    refetchInterval: 10000,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [depRes, prRes] = await Promise.all([
        api.get('/deployments'),
        api.get('/projects'),
      ]);
      
      const depData = await depRes.json();
      const prData = await prRes.json();
      
      setDeployments(Array.isArray(depData) ? depData : []);
      setProjects(Array.isArray(prData) ? prData : []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load deployments');
      setError(error instanceof Error ? error : new Error(error.message || 'Failed to load deployments'));
    } finally {
      setLoading(false);
    }
  }, [setDeployments, setProjects]);

  useEffect(() => {
    fetchData();
    joinK8sUpdates();

    const onDeploymentUpdate = (data: any) => {
      updateDeployment(data.name, { status: data.readyReplicas > 0 ? DeploymentStatus.RUNNING : DeploymentStatus.DEPLOYING });
    };

    const onPodUpdate = (data: any) => {
      updateDeployment(data.name, { status: data.status === 'Running' ? DeploymentStatus.RUNNING : DeploymentStatus.DEPLOYING });
    };

    subscribe('k8s:deployment:updated', onDeploymentUpdate);
    subscribe('k8s:pod:updated', onPodUpdate);

    return () => {
      unsubscribe('k8s:deployment:updated', onDeploymentUpdate);
      unsubscribe('k8s:pod:updated', onPodUpdate);
    };
  }, [fetchData, joinK8sUpdates, subscribe, unsubscribe, updateDeployment]);

  const qs = queueStatsQ.data || { waiting: 0, active: 0, completed: 0, failed: 0 };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/50 p-3">
        <Layers className="h-5 w-5 text-blue-400" />
        <div className="flex gap-4 text-sm">
          {qs.active > 0 && (
            <span className="flex items-center gap-1 text-yellow-400">
              <Play className="h-3 w-3" /> {qs.active} active
            </span>
          )}
          <span className="flex items-center gap-1 text-gray-400">
            <Clock className="h-3 w-3" /> {qs.waiting} queued
          </span>
          <span className="flex items-center gap-1 text-green-400">
            <CheckCircle className="h-3 w-3" /> {qs.completed} done
          </span>
          {qs.failed > 0 && (
            <span className="flex items-center gap-1 text-red-400">
              <XCircle className="h-3 w-3" /> {qs.failed} failed
            </span>
          )}
        </div>
      </div>
      <DeploymentCards 
        deployments={deployments}
        projects={projects}
        loading={loading}
        isError={error !== null}
        error={error}
        refetch={fetchData}
      />
    </div>
  );
}