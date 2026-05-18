'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDeploymentStore } from '@/store';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { 
  Boxes, Loader2, ArrowLeft, Trash2, GitBranch, Server, Rocket, Clock,
  ExternalLink, Settings, Code, FolderTree, Terminal, RefreshCw, Play, Square,
  Globe, FileEdit, Activity, Cpu, Database, Webhook, GitPullRequest,
  ChevronDown, ChevronUp, Copy, CheckCircle, XCircle, AlertTriangle, Maximize2, Minimize2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import EnvVarsManager from '@/components/EnvVarsManager';
import XTerminal from '@/components/projects/XTerminal';
import FileManager from '@/components/projects/FileManager';
import DeploymentHistory from '@/components/projects/DeploymentHistory';
import DomainManager from '@/components/projects/DomainManager';
import AutoDeployConfig from '@/components/projects/AutoDeployConfig';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scaling, setScaling] = useState(false);
  const [cluster, setCluster] = useState<any>(null);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [deploymentResources, setDeploymentResources] = useState<any>(null);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [proxyUrl, setProxyUrl] = useState<string | null>(null);
  const [previewFullscreen, setPreviewFullscreen] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchProject = useCallback(async () => {
    try {
      const response = await api.get(`/projects/${params.id}`);
      const data = await response.json();
      setProject(data);
      if (data.clusterId) {
        try {
          const clusterRes = await api.get(`/clusters/${data.clusterId}`);
          const clusterData = await clusterRes.json();
          setCluster(clusterData);
        } catch { setCluster(null); }
      }
    } catch {
      toast.error('Failed to load project');
      router.push('/dashboard/projects');
    } finally { setLoading(false); }
  }, [params.id, router]);

  const fetchResources = useCallback(async () => {
    if (!params.id) return;
    setResourcesLoading(true);
    try {
      const res = await api.get(`/container/${params.id}/deployment`);
      if (res.ok) {
        const data = await res.json();
        setDeploymentResources(data);
      }
    } catch {} finally { setResourcesLoading(false); }
  }, [params.id]);

  useEffect(() => { if (params.id) { fetchProject(); fetchResources(); fetchPreviewUrl(); } }, [params.id, fetchProject, fetchResources]);

  const fetchPreviewUrl = useCallback(async () => {
    if (!params.id) return;
    try {
      const res = await api.get(`/container/${params.id}/preview-url`);
      if (res.ok) {
        const data = await res.json();
        setProxyUrl(data.previewUrl);
      }
    } catch {}
  }, [params.id]);

  const isStopped = project?.status === 'stopped';
  const isRunning = project?.status === 'deployed' || project?.status === 'active';
  const isBuilding = project?.status === 'building';

  const handleStartStop = async () => {
    setScaling(true);
    try {
      const targetReplicas = isStopped ? (project.replicas || 1) : 0;
      const res = await api.put(`/container/${params.id}/scale`, { replicas: targetReplicas });
      if (res.ok) {
        setProject((prev: any) => ({ ...prev, status: isStopped ? 'deployed' : 'stopped', replicas: targetReplicas }));
        toast.success(isStopped ? 'Project started' : 'Project stopped');
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed');
      }
    } catch { toast.error('Failed to scale project'); }
    finally { setScaling(false); }
  };

  const confirmDeleteProject = async () => {
    try {
      await api.delete(`/projects/${params.id}`);
      toast.success('Project deleted');
      router.push('/dashboard/projects');
    } catch (err: any) { toast.error(err.message || 'Failed to delete'); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
      case 'deployed':
        return <span className="flex items-center gap-1.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 px-3 py-1 text-xs font-medium"><CheckCircle className="h-3.5 w-3.5" /> Running</span>;
      case 'deployment_failed':
      case 'build_failed':
        return <span className="flex items-center gap-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 text-xs font-medium"><XCircle className="h-3.5 w-3.5" /> Failed</span>;
      case 'stopped':
        return <span className="flex items-center gap-1.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 px-3 py-1 text-xs font-medium"><Square className="h-3.5 w-3.5" /> Stopped</span>;
      case 'building':
        return <span className="flex items-center gap-1.5 rounded-full bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1 text-xs font-medium"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Building</span>;
      default:
        return <span className="flex items-center gap-1.5 rounded-full bg-gray-500/10 text-gray-400 border border-gray-500/20 px-3 py-1 text-xs font-medium">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
          <p className="text-gray-500 text-sm">Loading project...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <AlertTriangle className="h-10 w-10 text-gray-500" />
          <p className="text-gray-400">Project not found</p>
          <Button variant="outline" onClick={() => router.push('/dashboard/projects')} className="border-gray-700">
            Back to Projects
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard/projects')} className="p-2 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              {getStatusBadge(project.status)}
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-sm text-gray-500 font-mono">/{project.slug}</span>
              {project.gitUrl && (
                <a href={project.gitUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 hover:underline">
                  <GitBranch className="h-3.5 w-3.5" />
                  {project.gitUrl.replace('https://', '').split('/').slice(-2).join('/')}
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={handleStartStop}
            disabled={scaling || isBuilding}
            size="sm"
            className={isStopped ? 'bg-green-600 hover:bg-green-700 h-9' : 'bg-yellow-600 hover:bg-yellow-700 h-9'}
          >
            {scaling ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> :
              isStopped ? <Play className="h-4 w-4 mr-1.5" /> : <Square className="h-4 w-4 mr-1.5" />
            }
            {isStopped ? 'Start' : 'Stop'}
          </Button>
          <Link href={`/dashboard/projects/${params.id}/build`}>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-9">
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Build
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => setConfirmDeleteOpen(true)} className="border-red-900 text-red-400 hover:bg-red-900/20 h-9">
            <Trash2 className="h-4 w-4 mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Server className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Namespace</p>
              <p className="text-sm font-medium text-white font-mono">{project.namespace || 'default'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <Activity className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Replicas</p>
              <p className="text-sm font-medium text-white">{project.replicas}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <Database className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Cluster</p>
              <p className="text-sm font-medium text-white">{cluster?.name || 'default'}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10">
              <Clock className="h-5 w-5 text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Created</p>
              <p className="text-sm font-medium text-white">{new Date(project.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isRunning && proxyUrl && (
        <Card className="border-green-800/50 bg-gradient-to-r from-green-900/20 to-emerald-900/10 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b border-green-900/30">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/20">
                  <ExternalLink className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-300">Live Preview</p>
                  <p className="text-xs text-gray-500 font-mono">{project.slug}.preview.local</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewFullscreen(!previewFullscreen)}
                  className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  title={previewFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {previewFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <a href={proxyUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 h-8 text-xs">
                    <ExternalLink className="h-3.5 w-3.5 mr-1" />
                    Open Tab
                  </Button>
                </a>
                <Button size="sm" variant="outline" onClick={fetchPreviewUrl} className="border-green-900 text-green-400 hover:bg-green-900/20 h-8 text-xs">
                  <RefreshCw className="h-3.5 w-3.5 mr-1" />
                  Reload
                </Button>
              </div>
            </div>
            <div className={`relative bg-gray-950 ${previewFullscreen ? 'h-[80vh]' : 'h-96'}`}>
              {previewLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-950/80 z-10">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-green-400" />
                    <p className="text-xs text-gray-500">Loading preview...</p>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={proxyUrl}
                className="w-full h-full border-0"
                onLoad={() => setPreviewLoading(false)}
                onError={() => setPreviewLoading(false)}
                title="Live Preview"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-gray-800/80 border border-gray-700/50 p-1">
          <TabsTrigger value="overview" className="data-[state=active]:bg-gray-900">
            <Rocket className="h-4 w-4 mr-2" /> Overview
          </TabsTrigger>
          <TabsTrigger value="terminal" className="data-[state=active]:bg-gray-900">
            <Terminal className="h-4 w-4 mr-2" /> Terminal
          </TabsTrigger>
          <TabsTrigger value="files" className="data-[state=active]:bg-gray-900">
            <FolderTree className="h-4 w-4 mr-2" /> Files
          </TabsTrigger>
          <TabsTrigger value="domains" className="data-[state=active]:bg-gray-900">
            <Globe className="h-4 w-4 mr-2" /> Domains
          </TabsTrigger>
          <TabsTrigger value="autodeploy" className="data-[state=active]:bg-gray-900">
            <GitPullRequest className="h-4 w-4 mr-2" /> Auto Deploy
          </TabsTrigger>
          <TabsTrigger value="settings" className="data-[state=active]:bg-gray-900">
            <Settings className="h-4 w-4 mr-2" /> Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <DeploymentHistory
            projectId={params.id as string}
            onDeploy={() => { fetchProject(); fetchResources(); }}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-gray-800 bg-gray-900/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="h-5 w-5 text-cyan-400" />
                  <CardTitle className="text-white text-base">Deployment Resources</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                {resourcesLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-5 w-5 animate-spin text-cyan-400" />
                  </div>
                ) : deploymentResources?.deployed ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg bg-gray-800/30 p-3 border border-gray-800">
                      <span className="text-sm text-gray-400">Image</span>
                      <span className="text-sm text-white font-mono truncate ml-2">{deploymentResources.image}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg bg-gray-800/30 p-3 border border-gray-800">
                        <p className="text-xs text-gray-500">Replicas</p>
                        <p className="text-lg font-bold text-white">{deploymentResources.replicas?.available || 0}/{deploymentResources.replicas?.desired || 0}</p>
                      </div>
                      <div className="rounded-lg bg-gray-800/30 p-3 border border-gray-800">
                        <p className="text-xs text-gray-500">CPU</p>
                        <p className="text-lg font-bold text-white">{deploymentResources.resources?.limits?.cpu || '-'}</p>
                      </div>
                      <div className="rounded-lg bg-gray-800/30 p-3 border border-gray-800">
                        <p className="text-xs text-gray-500">Memory</p>
                        <p className="text-lg font-bold text-white">{deploymentResources.resources?.limits?.memory || '-'}</p>
                      </div>
                      <div className="rounded-lg bg-gray-800/30 p-3 border border-gray-800">
                        <p className="text-xs text-gray-500">Auto-scaling</p>
                        <p className="text-lg font-bold text-white">{deploymentResources.hpa?.enabled ? `${deploymentResources.hpa.minReplicas}-${deploymentResources.hpa.maxReplicas}` : 'Off'}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-6 text-center">
                    <Cpu className="mb-2 h-8 w-8 text-gray-600" />
                    <p className="text-gray-500 text-sm">
                      {deploymentResources?.message || 'No deployment found'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-gray-800 bg-gray-900/50">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Code className="h-5 w-5 text-blue-400" />
                  <CardTitle className="text-white text-base">Project Config</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2.5">
                  <span className="text-sm text-gray-400 flex items-center gap-2"><GitBranch className="h-4 w-4" /> Branch</span>
                  <span className="text-sm text-white font-mono">{project.branch || 'main'}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2.5">
                  <span className="text-sm text-gray-400 flex items-center gap-2"><FolderTree className="h-4 w-4" /> Root Dir</span>
                  <span className="text-sm text-white font-mono">{project.rootDir || '/'}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2.5">
                  <span className="text-sm text-gray-400 flex items-center gap-2"><Terminal className="h-4 w-4" /> Build</span>
                  <span className="text-sm text-white font-mono">{project.buildCommand || 'auto-detected'}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 px-3 py-2.5">
                  <span className="text-sm text-gray-400 flex items-center gap-2"><Rocket className="h-4 w-4" /> Run</span>
                  <span className="text-sm text-white font-mono">{project.runCommand || 'auto-detected'}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="terminal">
          <XTerminal projectId={params.id as string} />
        </TabsContent>

        <TabsContent value="files">
          <FileManager projectId={params.id as string} />
        </TabsContent>

        <TabsContent value="domains">
          <DomainManager projectId={params.id as string} />
        </TabsContent>

        <TabsContent value="autodeploy">
          <AutoDeployConfig projectId={params.id as string} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Project Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <div>
                  <p className="text-sm text-white font-medium">Auto Deploy</p>
                  <p className="text-xs text-gray-500">{project.autoDeploy !== false ? 'Auto-deploys on git push' : 'Manual deploys only'}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${project.autoDeploy !== false ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                  {project.autoDeploy !== false ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <div>
                  <p className="text-sm text-white font-medium">Workspace</p>
                  <p className="text-xs text-gray-500">{project.workspace?.name || 'N/A'}</p>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <div>
                  <p className="text-sm text-white font-medium">Project ID</p>
                  <p className="text-xs text-gray-500 font-mono">{project.id}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(project.id); toast.success('Copied'); }} className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-700">
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>

          <EnvVarsManager projectId={params.id as string} mode="project" />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone. All deployments, domains, and associated resources will be permanently removed."
        onConfirm={confirmDeleteProject}
        confirmLabel="Delete Project"
        variant="destructive"
      />
    </div>
  );
}
