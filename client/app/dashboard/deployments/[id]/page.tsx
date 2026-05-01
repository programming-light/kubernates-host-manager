'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuthStore, useProjectStore } from '@/store';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Rocket, 
  Loader2, 
  ArrowLeft,
  RotateCcw,
  Play,
  Pause,
  RefreshCw,
  GitCommit,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Terminal
} from 'lucide-react';
import { toast } from 'sonner';

interface Deployment {
  id: string;
  projectId: string;
  version: number;
  status: string;
  imageUrl: string;
  commitSha?: string;
  replicas: number;
  deployedBy?: string;
  startedAt: string;
  completedAt?: string;
  logs: string[];
}

export default function DeploymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuthStore();
  const { projects } = useProjectStore();
  const [deployment, setDeployment] = useState<Deployment | null>(null);
  const [loading, setLoading] = useState(true);
  const [project, setProject] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchDeployment();
    }
  }, [params.id]);

  const fetchDeployment = async () => {
    try {
      const response = await api.get(`/deployments/${params.id}`);
      const data = await response.json();
      setDeployment(data);
      
      try {
        const logsRes = await api.get(`/deployments/${params.id}/logs`);
        const logsData = await logsRes.json();
        setLogs(logsData.logs || []);
      } catch {
        setLogs([]);
      }
      
      if (data.projectId) {
        try {
          const projectRes = await api.get(`/projects/${data.projectId}`);
          const projectData = await projectRes.json();
          setProject(projectData);
        } catch {
          setProject(null);
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to load deployment');
      router.push('/dashboard/deployments');
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = async () => {
    setActionLoading(true);
    try {
      await api.post(`/deployments/${params.id}/restart`);
      toast.success('Deployment restarting...');
      fetchDeployment();
    } catch (error: any) {
      toast.error(error.message || 'Failed to restart deployment');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRollback = async () => {
    setActionLoading(true);
    try {
      await api.post(`/deployments/${params.id}/rollback`);
      toast.success('Rollback initiated...');
      fetchDeployment();
    } catch (error: any) {
      toast.error(error.message || 'Failed to rollback');
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'failed': return <XCircle className="h-4 w-4 text-red-400" />;
      case 'pending':
      case 'deploying': return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
      case 'queued': return <Clock className="h-4 w-4 text-yellow-400" />;
      default: return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'failed': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'pending':
      case 'deploying': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
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

  if (!deployment) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Deployment not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button
        variant="ghost"
        onClick={() => router.push('/dashboard/deployments')}
        className="text-gray-400 hover:text-white"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to Deployments
      </Button>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-700">
            <Rocket className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white">Deployment v{deployment.version}</h1>
            <div className="mt-1 flex items-center gap-3">
              <span className={`flex items-center gap-1 rounded-full border px-3 py-1 text-sm ${getStatusColor(deployment.status)}`}>
                {getStatusIcon(deployment.status)}
                {deployment.status}
              </span>
              <span className="text-sm text-gray-500">{deployment.imageUrl}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={handleRestart}
            disabled={actionLoading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Restart
          </Button>
          <Button 
            variant="outline" 
            onClick={handleRollback}
            disabled={actionLoading || deployment.version <= 1}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Rollback
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Version</p>
              <p className="text-white">v{deployment.version}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Image</p>
              <p className="text-white break-all">{deployment.imageUrl}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Replicas</p>
              <p className="text-white">{deployment.replicas}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Commit Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <GitCommit className="h-5 w-5 text-gray-400" />
              <p className="text-white font-mono text-sm">
                {deployment.commitSha?.slice(0, 7) || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Message</p>
              <p className="text-white">{deployment.commitSha || 'No commit info'}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Timing</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Started</p>
              <p className="text-white">
                {new Date(deployment.startedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Completed</p>
              <p className="text-white">
                {deployment.completedAt
                  ? new Date(deployment.completedAt).toLocaleString()
                  : 'In progress...'}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Project</CardTitle>
          </CardHeader>
          <CardContent>
            {project ? (
              <div className="cursor-pointer hover:text-blue-400" onClick={() => router.push(`/dashboard/projects/${project.id}`)}>
                <p className="text-white">{project.name}</p>
                <p className="text-sm text-gray-500">{project.namespace}</p>
              </div>
            ) : (
              <p className="text-gray-500">Project not found</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList className="bg-gray-800">
          <TabsTrigger value="logs">Logs</TabsTrigger>
          <TabsTrigger value="events">Events</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white flex items-center gap-2">
                  <Terminal className="h-5 w-5" />
                  Deployment Logs
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={fetchDeployment}
                  className="text-gray-400 hover:text-white"
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-96 overflow-y-auto rounded-lg bg-black/50 p-4 font-mono text-sm">
                {logs.length > 0 ? (
                  logs.map((log, index) => (
                    <p key={index} className="text-gray-300">
                      {new Date().toLocaleTimeString()} {log}
                    </p>
                  ))
                ) : (
                  <p className="text-gray-500">No logs available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="events">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-white">Deployment Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-white">Deployment started</p>
                    <p className="text-sm text-gray-500">
                      {new Date(deployment.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {deployment.completedAt && (
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500/10">
                      <CheckCircle className="h-4 w-4 text-green-400" />
                    </div>
                    <div>
                      <p className="text-white">Deployment completed</p>
                      <p className="text-sm text-gray-500">
                        {new Date(deployment.completedAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}