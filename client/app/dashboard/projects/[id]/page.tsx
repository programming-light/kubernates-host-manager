'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore, useDeploymentStore } from '@/store';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Boxes, 
  Loader2, 
  ArrowLeft,
  Plus,
  Trash2,
  GitBranch,
  Server,
  Rocket,
  Clock,
  ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { deployments, setDeployments } = useDeploymentStore();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cluster, setCluster] = useState<any>(null);
  const [projectDeployments, setProjectDeployments] = useState<any[]>([]);

  useEffect(() => {
    if (params.id) {
      fetchProject();
      fetchDeployments();
    }
  }, [params.id]);

  const fetchProject = async () => {
    try {
      const response = await api.get(`/projects/${params.id}`);
      const data = await response.json();
      setProject(data);
      
      if (data.clusterId) {
        try {
          const clusterRes = await api.get(`/clusters/${data.clusterId}`);
          const clusterData = await clusterRes.json();
          setCluster(clusterData);
        } catch {
          setCluster(null);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load project');
      router.push('/dashboard/projects');
    } finally {
      setLoading(false);
    }
  };

  const fetchDeployments = async () => {
    try {
      const response = await api.get(`/deployments?projectId=${params.id}`);
      const data = await response.json();
      setDeployments(Array.isArray(data) ? data : []);
      setProjectDeployments(Array.isArray(data) ? data : []);
    } catch {
      setDeployments([]);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'archived': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
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

  if (!project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Project not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/projects')}
        className="text-gray-400 hover:text-white"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Projects
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-700">
            <Boxes className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{project.name}</h1>
            <div className="mt-1 flex items-center gap-3">
              <span className={`rounded-full border px-3 py-1 text-sm ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
              <span className="text-sm text-gray-500">/{project.slug}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            <Rocket className="mr-2 h-4 w-4" />
            Deploy
          </Button>
          <Button variant="outline" className="border-red-900 text-red-400 hover:bg-red-900/20">
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Namespace</p>
              <p className="text-white">{project.namespace || 'default'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Replicas</p>
              <p className="text-white">{project.replicas}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="text-white">{new Date(project.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Git Repository</CardTitle>
          </CardHeader>
          <CardContent>
            {project.gitUrl ? (
              <div className="flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-gray-400" />
                <a href={project.gitUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  {project.gitUrl}
                </a>
                <ExternalLink className="h-4 w-4 text-gray-500" />
              </div>
            ) : (
              <p className="text-gray-500">No repository linked</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Cluster</CardTitle>
          </CardHeader>
          <CardContent>
            {cluster ? (
              <Link href={`/dashboard/clusters/${cluster.id}`}>
                <div className="flex items-center gap-2 hover:text-blue-400">
                  <Server className="h-5 w-5 text-gray-400" />
                  <span className="text-white">{cluster.name}</span>
                </div>
              </Link>
            ) : (
              <p className="text-gray-500">Cluster not found</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Deployments</span>
              <span className="text-xl font-bold text-white">{projectDeployments.length}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Running</span>
              <span className="text-xl font-bold text-green-400">
                {projectDeployments.filter((d) => d.status === 'running').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deployments" className="space-y-4">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="deployments">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Deployment History</CardTitle>
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="mr-2 h-4 w-4" />
                  New Deployment
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {projectDeployments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Rocket className="mb-4 h-10 w-10 text-gray-500" />
                  <p className="text-gray-400">No deployments yet</p>
                  <p className="text-sm text-gray-500">Create your first deployment to get started</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {projectDeployments.map((deployment) => (
                    <Link key={deployment.id} href={`/dashboard/deployments/${deployment.id}`}>
                      <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Rocket className="h-5 w-5 text-orange-400" />
                          <div>
                            <p className="font-medium text-white">v{deployment.version}</p>
                            <p className="text-xs text-gray-500">
                              {deployment.commitSha?.slice(0, 7) || 'No commit'} - {deployment.commitMessage || 'No message'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`rounded-full border px-2 py-1 text-xs ${getStatusColor(deployment.status)}`}>
                            {deployment.status}
                          </span>
                          <Clock className="h-4 w-4 text-gray-500" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-white">Project Settings</CardTitle>
              <CardDescription className="text-gray-400">
                Configure your project settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-400">Settings form will appear here</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}