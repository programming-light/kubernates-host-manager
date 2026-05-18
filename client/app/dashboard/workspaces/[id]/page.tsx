'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  Folder, 
  Loader2, 
  ArrowLeft,
  Trash2,
  Server,
  Boxes,
  Settings,
  Users,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import type { Workspace, Project } from '@/lib/types';
import ProjectCards from '@/components/projects/ProjectCards';
import { useDeleteProject } from '@/lib/queries';

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [deleteConfirm, setDeleteConfirm] = useState<'workspace' | string | null>(null);

  const { data: workspace, isLoading: wsLoading } = useQuery({
    queryKey: ['workspaces', params.id],
    queryFn: () => apiClient.get<Workspace>(`/workspaces/${params.id}`),
    enabled: !!params.id,
  });

  const { data: projects = [], isLoading: projectsLoading, isError: projectsIsError, error: projectsError, refetch: projectsRefetch } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => apiClient.get<Project[]>('/projects'),
  });

  const { data: k8sStatus } = useQuery({
    queryKey: ['kubernetes', 'status'],
    queryFn: () => apiClient.get<{ connected: boolean }>('/kubernetes/status'),
  });

  const workspaceProjects = projects.filter((p) => p.workspaceId === params.id);

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/workspaces/${params.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workspaces'] });
      toast.success('Workspace deleted');
      router.push('/dashboard/workspaces');
    },
  });

  const deleteProjectMutation = useDeleteProject();

  const handleDelete = () => {
    setDeleteConfirm('workspace');
  };

  const confirmDeleteWorkspace = async () => {
    try {
      await deleteMutation.mutateAsync();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workspace');
    }
  };

  const handleDeleteProject = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDeleteConfirm(id);
  };

  const confirmDeleteProject = async () => {
    if (!deleteConfirm || deleteConfirm === 'workspace') return;
    try {
      await deleteProjectMutation.mutateAsync(deleteConfirm);
      toast.success('Project deleted');
      qc.invalidateQueries({ queryKey: ['projects'] });
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete project');
    }
  };

  if (wsLoading) {
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

  const isOwner = workspace.ownerId === user?.id;

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
          <Link href={`/dashboard/workspaces/${params.id}/members`}>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
              <Users className="mr-2 h-4 w-4" />
              Members
            </Button>
          </Link>
          <Link href={`/dashboard/workspaces/${params.id}/settings`}>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
          </Link>
          {isOwner && (
            <Button variant="outline" onClick={handleDelete} className="border-red-900 text-red-400 hover:bg-red-900/20">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {workspace.description && (
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="pt-6">
            <p className="text-gray-300">{workspace.description}</p>
          </CardContent>
        </Card>
      )}

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
            <div>
              <p className="text-sm text-gray-500">Owner</p>
              <p className="text-white">{(workspace as any).owner?.name || 'Unknown'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className={`border ${k8sStatus?.connected ? 'border-green-900/50 bg-green-950/20' : 'border-red-900/50 bg-red-950/20'}`}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-white">Kubernetes</CardTitle>
              <div className={`flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium ${k8sStatus?.connected ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                <Activity className="h-3 w-3" />
                {k8sStatus?.connected ? 'Connected' : 'Disconnected'}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {k8sStatus?.connected ? (
              <div>
                <p className="text-green-400 font-semibold">Connected to Kubernetes</p>
                <p className="text-sm text-gray-500 mt-1">Your cluster is running and ready</p>
                <Link href="/dashboard/kubernetes">
                  <Button size="sm" className="mt-3 w-full bg-green-600 hover:bg-green-700">
                    <Server className="mr-2 h-4 w-4" />
                    Manage Resources
                  </Button>
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-red-400 font-semibold">No cluster connected</p>
                <p className="text-sm text-gray-500 mt-1">Start minikube or k3s to connect</p>
                <Link href="/dashboard/kubernetes">
                  <Button size="sm" className="mt-3 w-full bg-blue-600 hover:bg-blue-700">
                    <Server className="mr-2 h-4 w-4" />
                    Connect
                  </Button>
                </Link>
              </div>
            )}
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
                <Server className="mr-2 h-4 w-4" />
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

      <ProjectCards
        projects={workspaceProjects}
        loading={projectsLoading}
        k8sConnected={k8sStatus?.connected || false}
        onDelete={handleDeleteProject}
        isError={projectsIsError}
        error={projectsError as Error | null}
        refetch={projectsRefetch}
      />

      <ConfirmDialog
        open={deleteConfirm === 'workspace'}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Delete Workspace"
        message="Are you sure you want to delete this workspace? All clusters and projects will be removed."
        onConfirm={confirmDeleteWorkspace}
      />
      <ConfirmDialog
        open={!!deleteConfirm && deleteConfirm !== 'workspace'}
        onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}
        title="Delete Project"
        message="Are you sure you want to delete this project?"
        onConfirm={confirmDeleteProject}
      />
    </div>
  );
}
