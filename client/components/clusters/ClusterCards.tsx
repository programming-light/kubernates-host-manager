'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Server, Trash2, Loader2, Activity, MapPin, AlertCircle } from 'lucide-react';
import { Cluster } from '@/lib/types';

interface ClusterCardsProps {
  clusters: Cluster[];
  workspaces: any[];
  loading: boolean;
  onDelete: (id: string, e: React.MouseEvent) => void;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export default function ClusterCards({ clusters, workspaces, loading, onDelete, isError, error, refetch }: ClusterCardsProps) {
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

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="rounded-full bg-red-500/10 p-3 mb-4">
          <AlertCircle className="h-6 w-6 text-red-400" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">Failed to load data</h3>
        <p className="text-sm text-gray-400 mb-4">{error?.message || 'An unexpected error occurred'}</p>
        <Button variant="outline" onClick={() => refetch()}>Try Again</Button>
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
            <h3 className="text-lg font-bold text-white">No clusters yet</h3>
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
                      <Server className="h-4 w-4 text-gray-500" />
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
                    onClick={(e) => onDelete(cluster.id, e)}
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
