'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useProjectStore } from '@/store';
import api from '@/lib/api';
import { Project } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Boxes, Trash2, Loader2, GitBranch, Clock, Server, Cloud } from 'lucide-react';
import { toast } from 'sonner';

export default function ProjectsPage() {
  const router = useRouter();
  const { projects, setProjects, removeProject } = useProjectStore();
  const [loading, setLoading] = useState(true);
  const [k8sConnected, setK8sConnected] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [prRes, k8sRes] = await Promise.all([
        api.get('/projects'),
        api.get('/kubernetes/status'),
      ]);
      
      const prData = await prRes.json();
      const k8sData = await k8sRes.json();
      
      setProjects(Array.isArray(prData) ? prData : []);
      setK8sConnected(k8sData.connected || false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  const deleteProject = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this project?')) return;
    
    try {
      await api.delete(`/projects/${id}`);
      removeProject(id);
      toast.success('Project deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete project');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-500/10';
      case 'archived': return 'text-gray-400 bg-gray-500/10';
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
          <h1 className="text-3xl font-bold text-white">Projects</h1>
          <p className="mt-1 text-gray-400">Manage your projects</p>
        </div>
        {k8sConnected ? (
          <Link href="/dashboard/projects/new">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </Link>
        ) : (
          <Link href="/dashboard/kubernetes">
            <Button className="bg-blue-600 hover:bg-blue-700">
              <Cloud className="mr-2 h-4 w-4" />
              Connect Kubernetes First
            </Button>
          </Link>
        )}
      </div>

      {projects.length === 0 ? (
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-full bg-gray-800 p-4">
              <Boxes className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">No projects yet</h3>
            <p className="mt-1 text-sm text-gray-400">Create your first project</p>
            {k8sConnected ? (
              <Link href="/dashboard/projects/new">
                <Button className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </Link>
            ) : (
              <Link href="/dashboard/kubernetes">
                <Button className="mt-4">
                  <Cloud className="mr-2 h-4 w-4" />
                  Connect Kubernetes First
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
              <Card 
                className="group relative overflow-hidden border-gray-800 bg-gray-900/50 transition-all duration-300 hover:border-gray-700 hover:shadow-lg hover:shadow-black/20 cursor-pointer"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-700">
                        <Boxes className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">{project.name}</CardTitle>
                        <CardDescription className="text-xs text-gray-500">/{project.slug}</CardDescription>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-400">
                    {project.description || 'No description'}
                  </p>
                  <div className="mt-3 space-y-2 text-xs text-gray-500">
                    {project.gitUrl && (
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3" />
                        <span className="truncate">{project.gitUrl}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Server className="h-3 w-3" />
                      <span>Namespace: {project.namespace}</span>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="mt-4 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => deleteProject(project.id, e)}
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