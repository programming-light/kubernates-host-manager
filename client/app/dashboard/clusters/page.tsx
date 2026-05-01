'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useClusterStore, useWorkspaceStore } from '@/store';
import api from '@/lib/api';
import { Cluster, Workspace } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Server, Trash2, Loader2, Activity, MapPin, Cloud } from 'lucide-react';
import { toast } from 'sonner';

export default function ClustersPage() {
  const router = useRouter();
  const { clusters, setClusters, removeCluster } = useClusterStore();
  const { workspaces, setWorkspaces } = useWorkspaceStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
    } finally {
      setLoading(false);
    }
  };

  const deleteCluster = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this cluster?')) return;
    
    try {
      await api.delete(`/clusters/${id}`);
      removeCluster(id);
      toast.success('Cluster deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete cluster');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/10';
      case 'inactive': return 'text-yellow-400 bg-yellow-500/10';
      case 'error': return 'text-red-400 bg-red-500/10';
      default: return 'text-gray-400 bg-gray-500/10';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Clusters</h1>
          <p className="mt-1 text-gray-400">Manage your Kubernetes clusters</p>
        </div>
        {workspaces.length > 0 ? (
          <Link href="/dashboard/clusters/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Cluster
            </Button>
          </Link>
        ) : (
          <Link href="/dashboard/workspaces/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace First
            </Button>
          </Link>
        )}
      </div>

      {clusters.length === 0 ? (
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-full bg-gray-800 p-4">
              <Server className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">No clusters yet</h3>
            <p className="mt-1 text-sm text-gray-400">Add your first Kubernetes cluster</p>
            {workspaces.length > 0 ? (
              <Link href="/dashboard/clusters/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Cluster
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard/workspaces/new">
                <Button className="mt-4">
                  Create Workspace First
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {clusters.map((cluster, index) => (
            <Link key={cluster.id} href={`/dashboard/clusters/${cluster.id}`}>
              <Card 
                className="group relative overflow-hidden border-gray-800 bg-gray-900/50 transition-all duration-300 hover:border-gray-700 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700">
                        <Server className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">{cluster.name}</CardTitle>
                        <CardDescription className="text-xs text-gray-500">{cluster.provider}</CardDescription>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(cluster.status)}`}>
                      <Activity className="mr-1 h-3 w-3" />
                      {cluster.status}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="mt-3 space-y-2 text-sm text-gray-400">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-gray-500" />
                      <span>{cluster.provider}</span>
                    </div>
                    {cluster.region && (
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-gray-500" />
                        <span>{cluster.region}</span>
                      </div>
                    )}
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mt-4 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => deleteCluster(cluster.id, e)}
                  >
                    <Trash2 className="mr-1 h-4 w-4" />
                    Delete
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}