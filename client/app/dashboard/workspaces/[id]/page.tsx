'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore, useProjectStore } from '@/store';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Folder, 
  Loader2, 
  ArrowLeft,
  Plus,
  Trash2,
  Server,
  Boxes,
  Rocket,
  Settings,
  Cloud
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { projects, setProjects } = useProjectStore();
  const [workspace, setWorkspace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [workspaceProjects, setWorkspaceProjects] = useState<any[]>([]);
  const [k8sConnected, setK8sConnected] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchWorkspace();
      fetchRelatedData();
    }
  }, [params.id]);

  const fetchWorkspace = async () => {
    try {
      const response = await api.get(`/workspaces/${params.id}`);
      const data = await response.json();
      setWorkspace(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workspace');
      router.push('/dashboard/workspaces');
    } finally {
      setLoading(false);
    }
  };

  const fetchRelatedData = async () => {
    try {
      const [prRes, k8sRes] = await Promise.all([
        api.get('/projects'),
        api.get('/kubernetes/status'),
      ]);
      
      const prData = await prRes.json();
      const k8sData = await k8sRes.json();
      
      setProjects(Array.isArray(prData) ? prData : []);
      setK8sConnected(k8sData.connected || false);
      setWorkspaceProjects(Array.isArray(prData) ? prData.filter((p: any) => p.workspaceId === params.id) : []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load related data');
    }
  };

  const deleteWorkspace = async () => {
    if (!confirm('Are you sure you want to delete this workspace? All clusters and projects will be removed.')) return;
    
    try {
      await api.delete(`/workspaces/${params.id}`);
      toast.success('Workspace deleted');
      router.push('/dashboard/workspaces');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workspace');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Workspace not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/workspaces')}
        className="text-gray-400 hover:text-white"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Workspaces
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700">
            <Folder className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">{workspace.name}</h1>
            <p className="text-sm text-gray-500">/{workspace.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard/workspaces/${params.id}/settings`}>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
          <Button variant="outline" onClick={deleteWorkspace} className="border-red-900 text-red-400 hover:bg-red-900/20">
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
              <p className="text-sm text-gray-500">Slug</p>
              <p className="text-white">/{workspace.slug}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Created</p>
              <p className="text-white">{new Date(workspace.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Kubernetes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-2xl font-bold ${k8sConnected ? 'text-green-400' : 'text-red-400'}`}>
              {k8sConnected ? 'Connected' : 'Disconnected'}
            </p>
            <p className="text-sm text-gray-500">cluster status</p>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-white">{workspaceProjects.length}</p>
            <p className="text-sm text-gray-500">in this workspace</p>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Link href="/dashboard/kubernetes">
              <Button size="sm" className="w-full bg-green-600 hover:bg-green-700">
                <Cloud className="mr-2 h-4 w-4" />
                Kubernetes
              </Button>
            </Link>
            <Link href={`/dashboard/projects/new?workspace=${params.id}`}>
              <Button size="sm" className="w-full bg-blue-600 hover:bg-blue-700">
                <Boxes className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Kubernetes Cluster</CardTitle>
              <Link href="/dashboard/kubernetes">
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <Cloud className="mr-2 h-4 w-4" />
                  Open
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {k8sConnected ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-4 rounded-full bg-green-500/10 p-4">
                  <Cloud className="h-10 w-10 text-green-400" />
                </div>
                <p className="text-green-400 font-semibold">Connected to Kubernetes</p>
                <p className="text-sm text-gray-500 mt-2">Your cluster is running and ready</p>
                <Link href="/dashboard/kubernetes">
                  <Button className="mt-4" size="sm">
                    Manage Resources
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Cloud className="mb-4 h-10 w-10 text-gray-500" />
                <p className="text-gray-400">No Kubernetes cluster connected</p>
                <p className="text-sm text-gray-500 mt-2">Start minikube or k3s to connect</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Projects</CardTitle>
              <Link href={`/dashboard/projects/new?workspace=${params.id}`}>
                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />
                  New
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {workspaceProjects.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Boxes className="mb-4 h-10 w-10 text-gray-500" />
                <p className="text-gray-400">No projects in this workspace</p>
              </div>
            ) : (
              <div className="space-y-2">
                {workspaceProjects.map((project) => (
                  <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
                    <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50 cursor-pointer">
                      <div className="flex items-center gap-3">
                        <Boxes className="h-5 w-5 text-green-400" />
                        <div>
                          <p className="font-medium text-white">{project.name}</p>
                          <p className="text-xs text-gray-500">{project.namespace}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-400">{project.status}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}