'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore, useClusterStore, useProjectStore } from '@/store';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Server, 
  Loader2, 
  Activity, 
  MapPin, 
  Cloud,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ClusterDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { projects, setProjects } = useProjectStore();
  const [cluster, setCluster] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [k8sStatus, setK8sStatus] = useState<any>(null);
  const [clusterProjects, setClusterProjects] = useState<any[]>([]);

  useEffect(() => {
    if (params.id) {
      fetchCluster();
      fetchClusterProjects();
    }
  }, [params.id]);

  const fetchCluster = async () => {
    try {
      const response = await api.get(`/clusters/${params.id}`);
      const data = await response.json();
      setCluster(data);
      
      if (data.k8sConnected !== undefined) {
        setK8sStatus({
          connected: data.k8sConnected,
          version: data.k8sVersion,
          provider: data.providerConfig?.provider,
        });
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load cluster');
      router.push('/dashboard/clusters');
    } finally {
      setLoading(false);
    }
  };

  const fetchClusterProjects = async () => {
    try {
      const response = await api.get('/projects');
      const data = await response.json();
      const allProjects = Array.isArray(data) ? data : [];
      setProjects(allProjects);
      setClusterProjects(allProjects.filter((p: any) => p.clusterId === params.id));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load projects');
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'inactive': return <AlertCircle className="h-4 w-4 text-yellow-400" />;
      case 'error': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'inactive': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'error': return 'bg-red-500/10 text-red-400 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!cluster) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Cluster not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/clusters')}
        className="text-gray-400 hover:text-white"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Clusters
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700">
            <Server className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{cluster.name}</h1>
            <div className="mt-1 flex items-center gap-3">
              <span className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${getStatusColor(cluster.status)}`}>
                {getStatusIcon(cluster.status)}
                {cluster.status}
              </span>
              <span className="text-sm text-gray-500">{cluster.provider}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" className="border-red-900 text-red-400 hover:bg-red-900/20">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Cluster Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Cloud className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Provider</p>
                <p className="text-white">{cluster.provider}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Region</p>
                <p className="text-white">{cluster.region || 'N/A'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Activity className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">K8s Connection</p>
                <p className={cluster.k8sConnected ? 'text-green-400' : 'text-red-400'}>
                  {cluster.k8sConnected ? 'Connected' : 'Disconnected'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-x-auto text-xs text-gray-400">
              {JSON.stringify(cluster.providerConfig || {}, null, 2)}
            </pre>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Projects</span>
              <span className="text-xl font-bold text-white">{clusterProjects.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Deployments</span>
              <span className="text-xl font-bold text-white">0</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="projects" className="space-y-4">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
        </TabsList>

        <TabsContent value="projects">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Projects in this Cluster</CardTitle>
                <Link href="/dashboard/projects/new">
                  <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    New Project
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {clusterProjects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Server className="mb-4 h-10 w-10 text-gray-500" />
                  <p className="text-gray-400">No projects in this cluster</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {clusterProjects.map((project) => (
                    <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                      <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50 cursor-pointer">
                        <div>
                          <p className="font-medium text-white">{project.name}</p>
                          <p className="text-xs text-gray-500">{project.namespace}</p>
                        </div>
                        <span className="text-sm text-gray-400">{project.status}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="resources">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-white">Cluster Resources</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Server className="mb-4 h-10 w-10 text-gray-500" />
                <p className="text-gray-400">Connect to Kubernetes to view resources</p>
                <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                  Connect Cluster
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}