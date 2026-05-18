'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SourceSelector, { SourceRepo } from '@/components/projects/SourceSelector';
import {
  ArrowLeft, Loader2, Boxes, Server, Github, GitlabIcon as GitLab, GitCommit,
  Container, CheckCircle, SlidersHorizontal, Terminal, Globe, LinkIcon, FolderIcon,
  Settings2, Rocket, Ship, FlaskConical, FileCode, Box, ChevronDown, ChevronUp,
  GitBranch, FolderTree, Activity, Plus, Trash2
} from 'lucide-react';
import { toast } from 'sonner';

interface WorkspaceOption {
  id: string;
  name: string;
  slug: string;
}

interface BuildPack {
  pack: string;
  label: string;
  description: string;
}

interface EnvPair {
  name: string;
  value: string;
}

interface DetectResult {
  language: string;
  framework: string | null;
  port: number;
  healthCheckPath: string;
  hasDockerfile: boolean;
  hasDockerCompose: boolean;
  suggestedBuildPack: string;
  availableBuildPacks: BuildPack[];
  buildConfig: {
    buildCommand: string;
    runCommand: string;
    port: number;
  };
}

const BUILD_PACK_ICONS: Record<string, typeof Terminal> = {
  nixpacks: Box,
  heroku: FlaskConical,
  dockerfile: FileCode,
  'docker-compose': Terminal,
  docker: Rocket,
};

export default function NewProjectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedWorkspace = searchParams.get('workspace');

  const [loading, setLoading] = useState(false);
  const [k8sConnected, setK8sConnected] = useState(false);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<SourceRepo | null>(null);
  const [showAdvancedBuild, setShowAdvancedBuild] = useState(false);
  const [showDeploySettings, setShowDeploySettings] = useState(false);

  // Detection
  const [detecting, setDetecting] = useState(false);
  const [detectResult, setDetectResult] = useState<DetectResult | null>(null);
  const [language, setLanguage] = useState('');
  const [framework, setFramework] = useState<string | null>(null);
  const [availableBuildPacks, setAvailableBuildPacks] = useState<BuildPack[]>([]);

  // Build config
  const [selectedBuildPack, setSelectedBuildPack] = useState('nixpacks');
  const [buildPort, setBuildPort] = useState(3000);
  const [healthCheckPath, setHealthCheckPath] = useState('/');
  const [buildEnvVars, setBuildEnvVars] = useState<EnvPair[]>([]);

  // Form
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    branch: 'main',
    buildCommand: '',
    runCommand: '',
    rootDir: '',
    replicas: 1,
  });

  useEffect(() => {
    Promise.all([fetchK8sStatus(), fetchWorkspaces()]);
  }, []);

  useEffect(() => {
    if (preselectedWorkspace && workspaces.length > 0) {
      const match = workspaces.find(w => w.id === preselectedWorkspace);
      if (match) setSelectedWorkspaceId(match.id);
    }
  }, [preselectedWorkspace, workspaces]);

  const fetchK8sStatus = async () => {
    try {
      const res = await api.get('/kubernetes/status');
      const data = await res.json();
      setK8sConnected(data.connected || false);
    } catch {}
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces');
      const data = await res.json();
      setWorkspaces(data || []);
      if (data?.length > 0 && !preselectedWorkspace) {
        setSelectedWorkspaceId(data[0].id);
      }
    } catch {}
  };

  const handleSourceSelect = (source: SourceRepo) => {
    setSelectedSource(source);
    setFormData(prev => ({
      ...prev,
      name: prev.name || source.name,
      branch: source.defaultBranch || 'main',
    }));
    setDetectResult(null);
    if (source.provider !== 'dockerhub' && source.cloneUrl) {
      detectProject(source.cloneUrl, source.defaultBranch || 'main');
    }
  };

  const detectProject = async (gitUrl: string, branch: string) => {
    setDetecting(true);
    try {
      const res = await api.post('/pipeline/detect', { gitUrl, branch });
      const data: DetectResult = await res.json();
      setDetectResult(data);
      setLanguage(data.language);
      setFramework(data.framework);
      setAvailableBuildPacks(data.availableBuildPacks || []);
      setSelectedBuildPack(data.suggestedBuildPack || 'nixpacks');
      setBuildPort(data.port || 3000);
      setHealthCheckPath(data.healthCheckPath || '/');
      if (data.buildConfig) {
        setFormData(prev => ({
          ...prev,
          buildCommand: prev.buildCommand || data.buildConfig!.buildCommand,
          runCommand: prev.runCommand || data.buildConfig!.runCommand,
        }));
      }
    } catch (err: any) {
      const msg = err.message || 'Detection failed';
      setAvailableBuildPacks([
        { pack: 'nixpacks', label: 'Nixpacks', description: 'Auto-detect & build' },
        { pack: 'heroku', label: 'Heroku Buildpacks', description: 'Heroku-style build' },
        { pack: 'dockerfile', label: 'Dockerfile', description: 'Use existing Dockerfile' },
        { pack: 'docker-compose', label: 'Docker Compose', description: 'Compose-based build' },
        { pack: 'docker', label: 'Docker', description: 'Auto-generate Dockerfile' },
      ]);
      setLanguage('unknown');
      toast.error(msg);
    } finally {
      setDetecting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedWorkspaceId) { toast.error('Please select a workspace'); return; }
    if (!formData.name.trim()) { toast.error('Project name is required'); return; }
    if (!selectedSource) { toast.error('Select a source repository or image'); return; }

    setLoading(true);

    try {
      const baseBody: Record<string, any> = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        workspaceId: selectedWorkspaceId,
        replicas: formData.replicas,
      };

      if (selectedSource.provider === 'dockerhub') {
        const image = selectedSource.image || selectedSource.fullName;
        const tag = selectedSource.tag || 'latest';
        baseBody.image = `${image}:${tag}`;
        baseBody.port = 80;

        const response = await api.post('/container/deploy-image', baseBody);
        if (response.ok) {
          const result = await response.json();
          toast.success('Docker image deployed!');
          router.push(`/dashboard/projects/${result.project.id}/build`);
        } else {
          const err = await response.json();
          toast.error(err.message || 'Failed to deploy image');
        }
      } else {
        const gitUrl = selectedSource.cloneUrl || selectedSource.htmlUrl || '';
        if (!gitUrl) { toast.error('Repository URL is required'); setLoading(false); return; }

        baseBody.gitUrl = gitUrl;
        baseBody.branch = formData.branch || selectedSource.defaultBranch || 'main';
        baseBody.buildCommand = formData.buildCommand.trim() || undefined;
        baseBody.runCommand = formData.runCommand.trim() || undefined;
        baseBody.rootDir = formData.rootDir.trim() || undefined;
        baseBody.buildPack = selectedBuildPack;
        baseBody.port = buildPort;
        baseBody.healthCheckPath = healthCheckPath;

        const response = await api.post('/projects', baseBody);
        if (response.ok) {
          const result = await response.json();
          toast.success('Project created! Configure build in next step.');
          router.push(`/dashboard/projects/${result.id}/build`);
        } else {
          const err = await response.json();
          toast.error(err.message || 'Failed to create project');
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create project');
    } finally {
      setLoading(false);
    }
  };

  const getSourceIcon = () => {
    switch (selectedSource?.provider) {
      case 'github': return <Github className="h-4 w-4 text-gray-300" />;
      case 'gitlab': return <GitLab className="h-4 w-4 text-orange-400" />;
      case 'gitea': return <GitCommit className="h-4 w-4 text-green-400" />;
      case 'dockerhub': return <Container className="h-4 w-4 text-blue-400" />;
      case 'manual': return <LinkIcon className="h-4 w-4 text-purple-400" />;
      default: return <Globe className="h-4 w-4 text-gray-400" />;
    }
  };

  const getProviderLabel = () => {
    switch (selectedSource?.provider) {
      case 'github': return 'GitHub';
      case 'gitlab': return 'GitLab';
      case 'gitea': return 'Gitea';
      case 'dockerhub': return 'Docker Hub';
      case 'manual': return 'Manual URL';
      default: return '';
    }
  };

  const addEnvPair = () => setBuildEnvVars([...buildEnvVars, { name: '', value: '' }]);
  const updateEnvPair = (index: number, field: 'name' | 'value', val: string) => {
    setBuildEnvVars(buildEnvVars.map((e, i) => i === index ? { ...e, [field]: val } : e));
  };
  const removeEnvPair = (index: number) => setBuildEnvVars(buildEnvVars.filter((_, i) => i !== index));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button variant="ghost" onClick={() => router.back()} className="text-gray-400 hover:text-white">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <Card className="border-gray-800 bg-gray-900/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-green-700">
                  <Boxes className="h-6 w-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-xl text-white">Create Project</CardTitle>
                  <CardDescription className="text-gray-400">
                    Select a source, configure build settings, then deploy
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {!k8sConnected ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Server className="mb-4 h-10 w-10 text-yellow-500" />
                  <h3 className="text-lg font-semibold text-white">Kubernetes not connected</h3>
                  <p className="mt-1 text-sm text-gray-400">Start minikube or k3s to create projects</p>
                  <Button className="mt-4" onClick={() => router.push('/dashboard/kubernetes')}>
                    Go to Kubernetes
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-green-400" />
                    <span className="text-green-400 text-sm">Connected to Kubernetes</span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Workspace</Label>
                    <select
                      value={selectedWorkspaceId}
                      onChange={(e) => setSelectedWorkspaceId(e.target.value)}
                      className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2.5 text-white focus:border-blue-500 focus:outline-none"
                      required
                    >
                      {workspaces.length === 0 && <option value="">No workspaces available</option>}
                      {workspaces.map(ws => (
                        <option key={ws.id} value={ws.id}>{ws.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-gray-300">Source</Label>
                    <SourceSelector onSelect={handleSourceSelect} selectedSource={selectedSource} />
                  </div>

                  {selectedSource && (
                    <div className="p-3 rounded-lg bg-gray-800/30 border border-gray-700">
                      <p className="text-xs text-gray-400 mb-1">Selected Source</p>
                      <div className="flex items-center gap-2">
                        {getSourceIcon()}
                        <span className="text-white font-medium text-sm truncate">
                          {selectedSource.provider === 'dockerhub'
                            ? `${selectedSource.fullName}:${selectedSource.tag || 'latest'}`
                            : selectedSource.fullName
                          }
                        </span>
                        <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded">
                          {getProviderLabel()}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-gray-300">Project Name</Label>
                    <Input
                      id="name"
                      placeholder="my-awesome-project"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-gray-300">Description (Optional)</Label>
                    <Input
                      id="description"
                      placeholder="What does this project do?"
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      className="border-gray-700 bg-gray-800 text-white placeholder:text-gray-500"
                    />
                  </div>

                  {/* Build Pack Selection - shown for git sources only */}
                  {selectedSource?.provider !== 'dockerhub' && selectedSource && (
                    <>
                      {detecting ? (
                        <div className="p-4 rounded-lg border border-gray-700 bg-gray-800/30">
                          <div className="flex items-center gap-2 text-gray-400">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">Detecting project configuration...</span>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/20 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Settings2 className="h-4 w-4 text-purple-400" />
                              <span className="text-sm font-medium text-white">Build Configuration</span>
                            </div>
                            {language && language !== 'unknown' && (
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 text-xs font-mono">{language}</span>
                                {framework && (
                                  <span className="px-2 py-0.5 rounded bg-green-900/30 text-green-300 text-xs font-mono">{framework}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Build Pack Selector */}
                          <div>
                            <Label className="text-gray-300 text-xs">Build Pack</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-1.5">
                              {(availableBuildPacks.length > 0 ? availableBuildPacks : [
                                { pack: 'nixpacks', label: 'Nixpacks', description: 'Auto-detect & build' },
                                { pack: 'heroku', label: 'Heroku', description: 'Heroku-style build' },
                                { pack: 'dockerfile', label: 'Dockerfile', description: 'Use existing Dockerfile' },
                                { pack: 'docker-compose', label: 'Compose', description: 'Compose-based build' },
                                { pack: 'docker', label: 'Docker', description: 'Auto-generate Dockerfile' },
                              ]).map(bp => {
                                const Icon = BUILD_PACK_ICONS[bp.pack] || Rocket;
                                const isSelected = selectedBuildPack === bp.pack;
                                return (
                                  <button
                                    key={bp.pack}
                                    type="button"
                                    onClick={() => setSelectedBuildPack(bp.pack)}
                                    className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-all ${
                                      isSelected
                                        ? 'border-purple-500 bg-purple-900/20 ring-1 ring-purple-500'
                                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                                    }`}
                                  >
                                    <Icon className={`h-4 w-4 shrink-0 ${isSelected ? 'text-purple-400' : 'text-gray-500'}`} />
                                    <div className="min-w-0">
                                      <p className={`text-xs font-medium leading-tight ${isSelected ? 'text-purple-300' : 'text-gray-300'}`}>{bp.label}</p>
                                      <p className="text-[10px] text-gray-500 leading-tight truncate">{bp.description}</p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Port & Health Check */}
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                              <Label className="text-gray-300 text-xs flex items-center gap-1"><Activity className="h-3 w-3" /> Port</Label>
                              <Input type="number" value={buildPort} onChange={e => setBuildPort(Number(e.target.value))} className="bg-gray-800 border-gray-700 text-white text-sm h-8" />
                            </div>
                            <div className="space-y-1.5">
                              <Label className="text-gray-300 text-xs flex items-center gap-1"><Activity className="h-3 w-3" /> Health Check Path</Label>
                              <Input value={healthCheckPath} onChange={e => setHealthCheckPath(e.target.value)} className="bg-gray-800 border-gray-700 text-white text-sm h-8" />
                            </div>
                          </div>

                          {/* Build Env Vars */}
                          <div className="space-y-2">
                            <Label className="text-gray-300 text-xs">Build-time Environment Variables</Label>
                            {buildEnvVars.map((e, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <Input value={e.name} onChange={v => updateEnvPair(i, 'name', v.target.value)} placeholder="KEY" className="flex-1 bg-gray-800 border-gray-700 text-white text-xs font-mono h-7" />
                                <Input value={e.value} onChange={v => updateEnvPair(i, 'value', v.target.value)} placeholder="value" className="flex-1 bg-gray-800 border-gray-700 text-white text-xs font-mono h-7" />
                                <button type="button" onClick={() => removeEnvPair(i)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="h-3 w-3" /></button>
                              </div>
                            ))}
                            <Button type="button" variant="ghost" size="sm" onClick={addEnvPair} className="text-blue-400 hover:text-blue-300 h-7 text-xs">
                              <Plus className="h-3 w-3 mr-1" /> Add variable
                            </Button>
                          </div>
                        </div>
                      )}

                      <details className="rounded-lg border border-gray-700 group" open={showAdvancedBuild} onToggle={e => setShowAdvancedBuild((e.target as HTMLDetailsElement).open)}>
                        <summary className="flex items-center gap-2 p-3 text-sm text-gray-300 cursor-pointer hover:text-white">
                          <SlidersHorizontal className="h-4 w-4 text-blue-400" />
                          Advanced Build Settings
                        </summary>
                        <div className="border-t border-gray-700 p-4 space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="branch" className="text-gray-300">Branch</Label>
                            <Input
                              id="branch"
                              placeholder="main"
                              value={formData.branch}
                              onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                              className="border-gray-700 bg-gray-800 text-white"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="rootDir" className="text-gray-300">Root Directory (monorepo)</Label>
                            <Input
                              id="rootDir"
                              placeholder="e.g. client/ or server/"
                              value={formData.rootDir}
                              onChange={(e) => setFormData({ ...formData, rootDir: e.target.value })}
                              className="border-gray-700 bg-gray-800 text-white"
                            />
                            <p className="text-xs text-gray-500">Leave empty if project is at root</p>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="buildCommand" className="text-gray-300">Build Command</Label>
                              <Input
                                id="buildCommand"
                                placeholder="e.g. npm run build"
                                value={formData.buildCommand}
                                onChange={(e) => setFormData({ ...formData, buildCommand: e.target.value })}
                                className="border-gray-700 bg-gray-800 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="runCommand" className="text-gray-300">Run Command</Label>
                              <Input
                                id="runCommand"
                                placeholder="e.g. npm start"
                                value={formData.runCommand}
                                onChange={(e) => setFormData({ ...formData, runCommand: e.target.value })}
                                className="border-gray-700 bg-gray-800 text-white"
                              />
                            </div>
                          </div>
                          <p className="text-xs text-gray-500">Auto-detected if left empty</p>
                        </div>
                      </details>

                      <details className="rounded-lg border border-gray-700 group" open={showDeploySettings} onToggle={e => setShowDeploySettings((e.target as HTMLDetailsElement).open)}>
                        <summary className="flex items-center gap-2 p-3 text-sm text-gray-300 cursor-pointer hover:text-white">
                          <Terminal className="h-4 w-4 text-blue-400" />
                          Deployment Settings
                        </summary>
                        <div className="border-t border-gray-700 p-4 space-y-4">
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
                          <p className="text-xs text-gray-500">Default: 1 replica, 500m CPU, 256Mi memory</p>
                        </div>
                      </details>
                    </>
                  )}

                  <Button
                    type="submit"
                    disabled={loading || !formData.name || !selectedSource || !selectedWorkspaceId}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                  >
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {selectedSource?.provider === 'dockerhub' ? 'Deploy Image' : 'Create Project'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card className="border-gray-800 bg-gray-900/50 sticky top-6">
            <CardHeader>
              <CardTitle className="text-white text-sm">Quick Start</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex-shrink-0">1</div>
                <div>
                  <p className="text-white font-medium">Select Workspace</p>
                  <p className="text-gray-500 text-xs mt-1">Choose the workspace to deploy into</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex-shrink-0">2</div>
                <div>
                  <p className="text-white font-medium">Choose a Source</p>
                  <p className="text-gray-500 text-xs mt-1">Connect GitHub, GitLab, Gitea, or paste any git URL</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex-shrink-0">3</div>
                <div>
                  <p className="text-white font-medium">Configure Build Pack</p>
                  <p className="text-gray-500 text-xs mt-1">Choose how to build: Nixpacks, Docker, Heroku, etc.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex-shrink-0">4</div>
                <div>
                  <p className="text-white font-medium">Set Advanced Options</p>
                  <p className="text-gray-500 text-xs mt-1">Configure branch, commands, root dir, and replicas</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/10 text-blue-400 text-xs font-bold flex-shrink-0">5</div>
                <div>
                  <p className="text-white font-medium">Create Project</p>
                  <p className="text-gray-500 text-xs mt-1">Project created, then build & deploy on the next page</p>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4 mt-4 space-y-2">
                <p className="text-xs text-gray-500">Supported sources:</p>
                <div className="flex flex-wrap gap-2">
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded"><Github className="h-3 w-3" /> GitHub</span>
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded"><GitLab className="h-3 w-3 text-orange-400" /> GitLab</span>
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded"><GitCommit className="h-3 w-3 text-green-400" /> Gitea</span>
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded"><Container className="h-3 w-3 text-blue-400" /> Docker Hub</span>
                  <span className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded"><Globe className="h-3 w-3 text-purple-400" /> Any Git URL</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
