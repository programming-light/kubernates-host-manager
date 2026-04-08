'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Cluster, Workspace } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Boxes, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function NewProjectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [formData, setFormData] = useState({
    workspaceId: '',
    clusterId: '',
    name: '',
    description: '',
    gitUrl: '',
    namespace: '',
    replicas: 1,
  });

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
      
      if (clData.length > 0) {
        setFormData(prev => ({ ...prev, clusterId: clData[0].id }));
      }
      if (wsData.length > 0) {
        setFormData(prev => ({ ...prev, workspaceId: wsData[0].id }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.clusterId) {
      toast.error('Please select a cluster');
      return;
    }
    setLoading(true);

    try {
      const response = await api.post('/projects', formData);
      if (response.ok) {
        toast.success('Project created successfully');
        router.push('/dashboard/projects');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.back()}
        className="text-gray-400 hover:text-white"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Projects
      </Button>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-700">
              <Boxes className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Create Project</CardTitle>
              <CardDescription className="text-gray-400">
                Create a new project to deploy your applications
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {clusters.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="mb-4 h-10 w-10 text-yellow-500" />
              <h3 className="text-lg font-semibold text-white">No clusters available</h3>
              <p className="mt-1 text-sm text-gray-400">Add a cluster first before creating a project</p>
              <Link href="/dashboard/clusters/new">
                <Button className="mt-4">
                  Add Cluster First
                </Button>
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="workspace" className="text-gray-300">Workspace</Label>
                <select
                  id="workspace"
                  value={formData.workspaceId}
                  onChange={(e) => setFormData({ ...formData, workspaceId: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {workspaces.map((ws) => (
                    <option key={ws.id} value={ws.id} className="bg-gray-800">
                      {ws.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="cluster" className="text-gray-300">Cluster</Label>
                <select
                  id="cluster"
                  value={formData.clusterId}
                  onChange={(e) => setFormData({ ...formData, clusterId: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {clusters.map((cluster) => (
                    <option key={cluster.id} value={cluster.id} className="bg-gray-800">
                      {cluster.name} ({cluster.provider})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name" className="text-gray-300">Project Name</Label>
                <Input
                  id="name"
                  placeholder="my-project"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-gray-300">Description (Optional)</Label>
                <Input
                  id="description"
                  placeholder="A brief description of your project"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="gitUrl" className="text-gray-300">Git URL (Optional)</Label>
                <Input
                  id="gitUrl"
                  placeholder="https://github.com/user/repo"
                  value={formData.gitUrl}
                  onChange={(e) => setFormData({ ...formData, gitUrl: e.target.value })}
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="namespace" className="text-gray-300">Namespace</Label>
                  <Input
                    id="namespace"
                    placeholder="default"
                    value={formData.namespace}
                    onChange={(e) => setFormData({ ...formData, namespace: e.target.value })}
                    className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="replicas" className="text-gray-300">Replicas</Label>
                  <Input
                    id="replicas"
                    type="number"
                    min={1}
                    max={10}
                    value={formData.replicas}
                    onChange={(e) => setFormData({ ...formData, replicas: parseInt(e.target.value) || 1 })}
                    className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.back()}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading || !formData.name || !formData.clusterId}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Project
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
