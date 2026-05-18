'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Plus, Rocket, Loader2, Clock, GitCommit, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import api from '@/lib/api';
import { toast } from 'sonner';

interface DeploymentCardsProps {
  deployments: any[];
  projects: any[];
  loading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

export default function DeploymentCards({ deployments, projects, loading, isError, error, refetch }: DeploymentCardsProps) {
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [formData, setFormData] = useState({ projectId: '', imageUrl: '', replicas: 1 });

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeploying(true);

    try {
      const response = await api.post('/deployments', formData);
      const data = await response.json();
      toast.success('Deployment started');
      setShowDeployModal(false);
      setFormData({ projectId: '', imageUrl: '', replicas: 1 });
    } catch (error: any) {
      toast.error(error.message || 'Failed to start deployment');
    } finally {
      setDeploying(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'deploying':
      case 'pending': return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
      case 'queued': return <Clock className="h-4 w-4 text-yellow-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'deploying':
      case 'pending': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'queued': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
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
          <h1 className="text-3xl font-bold text-white">Deployments</h1>
          <p className="mt-1 text-gray-400">Manage your deployments</p>
        </div>
        {projects.length > 0 && (
          <Button onClick={() => setShowDeployModal(true)} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            New Deployment
          </Button>
        )}
      </div>

      {deployments.length === 0 ? (
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-full bg-gray-800 p-4">
              <Rocket className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-bold text-white">No deployments yet</h3>
            <p className="mt-1 text-sm text-gray-400">Create your first deployment</p>
            {projects.length > 0 ? (
              <Button onClick={() => setShowDeployModal(true)} className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                New Deployment
              </Button>
            ) : (
              <p className="mt-2 text-sm text-yellow-500">Create a project first</p>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {deployments.map((deployment, index) => (
            <Link key={deployment.id} href={`/dashboard/deployments/${deployment.id}`}>
              <Card 
                className={`border-gray-800 bg-gray-900/50 transition-all duration-300 hover:border-gray-700 cursor-pointer ${getStatusColor(deployment.status)}`}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-700">
                      <Rocket className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-white">v{deployment.version}</h3>
                        <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${getStatusColor(deployment.status)}`}>
                          {getStatusIcon(deployment.status)}
                          {deployment.status}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <GitCommit className="h-3 w-3" />
                          {deployment.commitSha?.slice(0, 7) || 'N/A'}
                        </span>
                        <span>{deployment.commitMessage || 'No message'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">
                        {deployment.startedAt ? new Date(deployment.startedAt).toLocaleString() : 'Pending'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {showDeployModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-full max-w-md border-gray-800 bg-gray-900">
            <CardHeader>
              <CardTitle className="text-white">New Deployment</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDeploy} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project" className="text-gray-300">Project</Label>
                  <Select
                    value={formData.projectId}
                    onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                  >
                    <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent className="border-gray-800 bg-gray-900">
                      {projects.map((p) => (
                        <SelectItem key={p.id} value={p.id} className="text-white hover:bg-gray-800">
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image" className="text-gray-300">Image URL</Label>
                  <Input
                    id="image"
                    placeholder="nginx:latest"
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    required
                    className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
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
                    className="border-gray-700 bg-gray-800 text-white"
                  />
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setShowDeployModal(false)} className="flex-1 border-gray-700 text-gray-300">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={deploying} className="flex-1 bg-blue-600">
                    {deploying && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Deploy
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
