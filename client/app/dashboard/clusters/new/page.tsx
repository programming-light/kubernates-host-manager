'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Workspace } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Server, Cloud, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function NewClusterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [formData, setFormData] = useState({
    workspaceId: '',
    name: '',
    provider: 'minikube',
    region: '',
  });

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await api.get('/workspaces');
      const data = await response.json();
      setWorkspaces(Array.isArray(data) ? data : []);
      if (data.length > 0) {
        setFormData(prev => ({ ...prev, workspaceId: data[0].id }));
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workspaces');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.workspaceId) {
      toast.error('Please select a workspace');
      return;
    }
    setLoading(true);

    try {
      const response = await api.post('/clusters', formData);
      if (response.ok) {
        toast.success('Cluster created successfully');
        router.push('/dashboard/clusters');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create cluster');
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
        Back to Clusters
      </Button>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700">
              <Server className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Add Cluster</CardTitle>
              <CardDescription className="text-gray-400">
                Connect a new Kubernetes cluster
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {workspaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <AlertCircle className="mb-4 h-10 w-10 text-yellow-500" />
              <h3 className="text-lg font-semibold text-white">No workspaces available</h3>
              <p className="mt-1 text-sm text-gray-400">Create a workspace first before adding a cluster</p>
              <Link href="/dashboard/workspaces/new">
                <Button className="mt-4">
                  Create Workspace
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
                <Label htmlFor="name" className="text-gray-300">Cluster Name</Label>
                <Input
                  id="name"
                  placeholder="my-cluster"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="provider" className="text-gray-300">Provider</Label>
                <select
                  id="provider"
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="minikube" className="bg-gray-800">Minikube</option>
                  <option value="eks" className="bg-gray-800">AWS EKS</option>
                  <option value="gke" className="bg-gray-800">Google GKE</option>
                  <option value="aks" className="bg-gray-800">Azure AKS</option>
                  <option value="digital-ocean" className="bg-gray-800">DigitalOcean</option>
                </select>
                <p className="text-xs text-gray-500">
                  Provider is configured via environment variables (K8S_PROVIDER)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="region" className="text-gray-300">Region (Optional)</Label>
                <Input
                  id="region"
                  placeholder="us-east-1"
                  value={formData.region}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
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
                  disabled={loading || !formData.name || !formData.workspaceId}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Cluster
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
