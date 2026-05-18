'use client';

import { useEffect, useState } from 'react';
import { useClusterStore, useWorkspaceStore } from '@/store';
import api from '@/lib/api';
import { Cluster } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import ClusterCards from '@/components/clusters/ClusterCards';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function ClustersPage() {
  const { clusters, setClusters, removeCluster } = useClusterStore();
  const { workspaces, setWorkspaces } = useWorkspaceStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [clRes, wsRes] = await Promise.all([
        api.get('/clusters'),
        api.get('/workspaces'),
      ]);
      
      const clData = await clRes.json();
      const wsData = await wsRes.json();
      
      setClusters(Array.isArray(clData) ? clData : []);
      setWorkspaces(Array.isArray(wsData) ? wsData : []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load clusters');
      setError(error instanceof Error ? error : new Error(error.message || 'Failed to load clusters'));
    } finally {
      setLoading(false);
    }
  };

  const deleteCluster = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteTarget(id);
  };

  const confirmDeleteCluster = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/clusters/${deleteTarget}`);
      removeCluster(deleteTarget);
      toast.success('Cluster deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete cluster');
    }
  };

  return (
    <>
      <ClusterCards 
        clusters={clusters}
        workspaces={workspaces}
        loading={loading}
        onDelete={deleteCluster}
        isError={error !== null}
        error={error}
        refetch={fetchData}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Cluster"
        message="Are you sure you want to delete this cluster?"
        onConfirm={confirmDeleteCluster}
      />
    </>
  );
}