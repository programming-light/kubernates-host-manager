'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '@/lib/socket-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Loader2, CheckCircle2, XCircle, Clock, Terminal, RefreshCw, Play, ExternalLink,
  Copy, Ship, Rocket, Globe, Cpu, HardDrive, Plus, Trash2, Bug, Layers, Settings2
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface BuildConsoleProps {
  projectId: string;
  projectName?: string;
  projectSlug?: string;
  onComplete?: (status: string) => void;
  autoStart?: boolean;
}

interface EnvPair {
  name: string;
  value: string;
}

type PipelineStep = 'idle' | 'building' | 'built' | 'deploying' | 'deployed' | 'running' | 'failed';

export default function BuildConsole({ projectId, projectName, projectSlug, onComplete, autoStart }: BuildConsoleProps) {
  const { socket, connected, subscribe, unsubscribe } = useSocket();
  const [step, setStep] = useState<PipelineStep>('idle');
  const [logs, setLogs] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [duration, setDuration] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [deploymentId, setDeploymentId] = useState<string | null>(null);
  const [builtImage, setBuiltImage] = useState<string | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  // Deploy config
  const [deployReplicas, setDeployReplicas] = useState(1);
  const [deployCpuLimit, setDeployCpuLimit] = useState('500m');
  const [deployMemoryLimit, setDeployMemoryLimit] = useState('256Mi');
  const [deployDomain, setDeployDomain] = useState('');
  const [deployEnvVars, setDeployEnvVars] = useState<EnvPair[]>([]);
  const [deploying, setDeploying] = useState(false);

  // Run config
  const [runEnvVars, setRunEnvVars] = useState<EnvPair[]>([]);
  const [running, setRunning] = useState(false);

  const joinBuildRoom = useCallback(() => {
    if (socket?.connected) socket.emit('join-build', projectId);
  }, [socket, projectId]);

  const leaveBuildRoom = useCallback(() => {
    if (socket?.connected) socket.emit('leave-build', projectId);
  }, [socket, projectId]);

  useEffect(() => {
    joinBuildRoom();
    return () => { leaveBuildRoom(); };
  }, [joinBuildRoom, leaveBuildRoom]);

  useEffect(() => {
    const onLog = (data: { text: string; projectId: string }) => {
      setLogs(prev => [...prev, data.text]);
    };

    const onStatus = (data: { status: string; message: string; duration?: number; image?: string }) => {
      setStatusMessage(data.message);
      if (data.duration) setDuration(data.duration);

      if (data.status === 'success') {
        if (data.image) {
          setBuiltImage(data.image);
          setStep('built');
          setDuration(prev => data.duration || prev);
          onComplete?.('success');
        } else {
          setStep('deployed');
          onComplete?.('success');
        }
      } else if (data.status === 'failed' || data.status === 'error') {
        setStep('failed');
        onComplete?.(data.status);
      }
    };

    subscribe('build:log', onLog);
    subscribe('build:status', onStatus);
    return () => {
      unsubscribe('build:log', onLog);
      unsubscribe('build:status', onStatus);
    };
  }, [subscribe, unsubscribe, onComplete]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    if (!['building', 'deploying', 'running'].includes(step) || !startedAt) return;
    const interval = setInterval(() => {
      setDuration(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [step, startedAt]);

  // Auto-start build if configured
  useEffect(() => {
    if (autoStart && step === 'idle') {
      triggerBuild();
    }
  }, [autoStart]);

  const triggerBuild = async () => {
    setLogs([]);
    setStep('building');
    setStatusMessage('Starting build...');
    setStartedAt(Date.now());
    setDuration(0);
    setDeploymentId(null);
    setBuiltImage(null);

    try {
      const res = await fetch(`${baseUrl}/pipeline/${projectId}/build`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        setDeploymentId(data.deploymentId);
        setBuiltImage(data.image);
      } else {
        const err = await res.json().catch(() => ({ message: 'Build failed' }));
        toast.error(err.message || 'Failed to start build');
        setStep('idle');
        setStatusMessage(err.message || 'Failed to start build');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start build');
      setStep('idle');
      setStatusMessage(err.message || 'Failed to start build');
    }
  };

  const triggerDeploy = async () => {
    setDeploying(true);
    setLogs([]);
    setStep('deploying');
    setStatusMessage('Starting deployment...');
    setStartedAt(Date.now());
    setDuration(0);

    try {
      const body: Record<string, any> = {};
      if (deploymentId) body.deploymentId = deploymentId;
      if (deployEnvVars.length > 0) body.envVars = deployEnvVars;
      if (deployReplicas) body.replicas = deployReplicas;
      body.resources = {
        limits: { cpu: deployCpuLimit, memory: deployMemoryLimit },
        requests: { cpu: '100m', memory: '128Mi' },
      };
      if (deployDomain) body.domain = deployDomain;

      const res = await fetch(`${baseUrl}/pipeline/${projectId}/deploy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Deploy failed' }));
        toast.error(err.message || 'Failed to start deploy');
        setStep('built');
        setDeploying(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start deploy');
      setStep('built');
      setDeploying(false);
    }
  };

  const triggerRun = async () => {
    setRunning(true);
    setLogs([]);
    setStep('running');
    setStatusMessage('Starting run pod...');
    setStartedAt(Date.now());
    setDuration(0);

    try {
      const body: Record<string, any> = {};
      if (runEnvVars.length > 0) body.envVars = runEnvVars;

      const res = await fetch(`${baseUrl}/pipeline/${projectId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Run failed' }));
        toast.error(err.message || 'Failed to start run pod');
        setStep('built');
        setRunning(false);
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to start run pod');
      setStep('built');
      setRunning(false);
    }
  };

  const addEnvPair = (list: EnvPair[], setter: (v: EnvPair[]) => void) => {
    setter([...list, { name: '', value: '' }]);
  };
  const updateEnvPair = (list: EnvPair[], setter: (v: EnvPair[]) => void, index: number, field: 'name' | 'value', val: string) => {
    setter(list.map((e, i) => i === index ? { ...e, [field]: val } : e));
  };
  const removeEnvPair = (list: EnvPair[], setter: (v: EnvPair[]) => void, index: number) => {
    setter(list.filter((_, i) => i !== index));
  };

  const renderEnvVars = (list: EnvPair[], setter: (v: EnvPair[]) => void, label: string) => (
    <div className="space-y-2">
      <Label className="text-gray-300 text-sm">{label}</Label>
      {list.map((e, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={e.name} onChange={v => updateEnvPair(list, setter, i, 'name', v.target.value)} placeholder="KEY" className="flex-1 bg-gray-800 border-gray-700 text-white text-xs font-mono h-8" />
          <Input value={e.value} onChange={v => updateEnvPair(list, setter, i, 'value', v.target.value)} placeholder="value" className="flex-1 bg-gray-800 border-gray-700 text-white text-xs font-mono h-8" />
          <button onClick={() => removeEnvPair(list, setter, i)} className="p-1 text-gray-500 hover:text-red-400"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      ))}
      <Button variant="ghost" size="sm" onClick={() => addEnvPair(list, setter)} className="text-blue-400 hover:text-blue-300 h-7 text-xs">
        <Plus className="h-3 w-3 mr-1" /> Add variable
      </Button>
    </div>
  );

  const getStatusIcon = () => {
    switch (step) {
      case 'deployed': return <CheckCircle2 className="h-5 w-5 text-green-400" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-400" />;
      case 'building': case 'deploying': case 'running':
        return <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />;
      default: return <Terminal className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = () => {
    switch (step) {
      case 'deployed': return 'text-green-400 bg-green-500/10 border-green-500/20';
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20';
      case 'building': case 'deploying': case 'running':
        return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  return (
    <div className="space-y-4">
      <Card className={`border-gray-800 bg-gray-900/50 ${['building', 'deploying', 'running'].includes(step) ? 'ring-1 ring-yellow-500/30' : step === 'deployed' ? 'ring-1 ring-green-500/30' : step === 'failed' ? 'ring-1 ring-red-500/30' : ''}`}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
                <Terminal className="h-5 w-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">
                  {projectName ? `${projectName} - Build Console` : 'Build Console'}
                </CardTitle>
                <p className="text-xs text-gray-400">
                  {connected ? 'Connected - live updates' : 'Connecting...'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {duration > 0 && (
                <span className="text-sm text-gray-400 flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {duration}s
                </span>
              )}
              {builtImage && (
                <span className="text-xs text-gray-500 font-mono truncate max-w-[150px]" title={builtImage}>
                  {builtImage.split('/').pop()}
                </span>
              )}
              <span className={`rounded-full border px-3 py-1 text-xs flex items-center gap-1 ${getStatusColor()}`}>
                {getStatusIcon()}
                {step.toUpperCase()}
              </span>
              {step === 'idle' && (
                <Button size="sm" onClick={triggerBuild} className="bg-blue-600 hover:bg-blue-700">
                  <Play className="h-4 w-4 mr-1" /> Build
                </Button>
              )}
              {(step === 'built' || step === 'deployed' || step === 'failed') && (
                <Button size="sm" onClick={() => { setStep('idle'); setLogs([]); setBuiltImage(null); setDeploymentId(null); }} className="bg-gray-700 hover:bg-gray-600">
                  <RefreshCw className="h-4 w-4 mr-1" /> New Build
                </Button>
              )}
            </div>
          </div>
          {statusMessage && (
            <div className="flex items-start gap-2 mt-1">
              <p className={`text-xs ${step === 'failed' ? 'text-red-400' : 'text-gray-500'}`}>{statusMessage}</p>
              {logs.length > 0 && (
                <button onClick={() => { navigator.clipboard.writeText(logs.join('')); toast.success('Logs copied'); }} className="text-gray-500 hover:text-white shrink-0">
                  <Copy className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="bg-black rounded-lg border border-gray-800">
            <div className="h-80 overflow-y-auto p-4 font-mono text-xs leading-relaxed" style={{ backgroundColor: '#0a0a0a' }}>
              {logs.length === 0 && step === 'idle' && (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <Terminal className="h-8 w-8 mb-2" />
                  <p>Build console ready</p>
                  <p className="text-xs mt-1">Click "Build" to start</p>
                </div>
              )}
              {logs.length === 0 && ['building', 'deploying', 'running'].includes(step) && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
                </div>
              )}
              {logs.map((log, i) => (
                <div key={i} className="text-gray-300 whitespace-pre-wrap break-all">{log}</div>
              ))}
              {['building', 'deploying', 'running'].includes(step) && (
                <div className="flex items-center gap-2 text-yellow-400 mt-2">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{step === 'building' ? 'Build in progress...' : step === 'deploying' ? 'Deploying...' : 'Running...'}</span>
                </div>
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Post-build: Deploy / Run options */}
          {step === 'built' && (
            <div className="mt-4 space-y-4">
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="text-sm font-medium">Build completed successfully!</span>
                </div>
              </div>

              <Tabs defaultValue="deploy" className="w-full">
                <TabsList className="bg-gray-800/80 border border-gray-700/50">
                  <TabsTrigger value="deploy" className="data-[state=active]:bg-gray-900">
                    <Ship className="h-4 w-4 mr-2" /> Deploy
                  </TabsTrigger>
                  <TabsTrigger value="run" className="data-[state=active]:bg-gray-900">
                    <Bug className="h-4 w-4 mr-2" /> Run One-off
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="deploy" className="space-y-3 mt-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-gray-300 text-xs flex items-center gap-1"><Layers className="h-3 w-3" /> Replicas</Label>
                      <Input type="number" value={deployReplicas} onChange={e => setDeployReplicas(Number(e.target.value))} min={0} className="bg-gray-800 border-gray-700 text-white text-sm h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-gray-300 text-xs flex items-center gap-1"><Cpu className="h-3 w-3" /> CPU Limit</Label>
                      <Select value={deployCpuLimit} onValueChange={setDeployCpuLimit}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm h-8"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="100m">100m</SelectItem>
                          <SelectItem value="250m">250m</SelectItem>
                          <SelectItem value="500m">500m</SelectItem>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-gray-300 text-xs flex items-center gap-1"><HardDrive className="h-3 w-3" /> Memory Limit</Label>
                      <Select value={deployMemoryLimit} onValueChange={setDeployMemoryLimit}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm h-8"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          <SelectItem value="128Mi">128Mi</SelectItem>
                          <SelectItem value="256Mi">256Mi</SelectItem>
                          <SelectItem value="512Mi">512Mi</SelectItem>
                          <SelectItem value="1Gi">1Gi</SelectItem>
                          <SelectItem value="2Gi">2Gi</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-gray-300 text-xs flex items-center gap-1"><Globe className="h-3 w-3" /> Domain (optional)</Label>
                    <Input value={deployDomain} onChange={e => setDeployDomain(e.target.value)} placeholder="app.example.com" className="bg-gray-800 border-gray-700 text-white text-sm h-8" />
                  </div>
                  {renderEnvVars(deployEnvVars, setDeployEnvVars, 'Runtime Environment Variables')}
                  <Button onClick={triggerDeploy} disabled={deploying} className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 w-full">
                    {deploying ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Ship className="h-4 w-4 mr-2" />}
                    Deploy to Kubernetes
                  </Button>
                </TabsContent>

                <TabsContent value="run" className="space-y-3 mt-3">
                  <p className="text-xs text-gray-500">Run a one-off pod with the built image. Useful for testing or batch jobs.</p>
                  {renderEnvVars(runEnvVars, setRunEnvVars, 'Environment Variables')}
                  <Button onClick={triggerRun} disabled={running} variant="outline" className="border-yellow-700 text-yellow-400 hover:bg-yellow-900/20 w-full">
                    {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bug className="h-4 w-4 mr-2" />}
                    Run One-off Pod
                  </Button>
                </TabsContent>
              </Tabs>
            </div>
          )}

          {step === 'deployed' && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span>Deployment completed successfully!</span>
              </div>
              <div className="flex gap-2">
                {projectSlug && (
                  <a href={`https://${projectSlug}.${process.env.NEXT_PUBLIC_DOMAIN_SUFFIX || 'k8s-host.preview'}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline" className="border-green-700 text-green-400 hover:bg-green-900/20">
                      <ExternalLink className="h-4 w-4 mr-1" /> Open Live
                    </Button>
                  </a>
                )}
                <Link href={`/dashboard/projects/${projectId}`}>
                  <Button size="sm" variant="outline" className="border-green-700 text-green-400 hover:bg-green-900/20">
                    View Project
                  </Button>
                </Link>
              </div>
            </div>
          )}

          {step === 'failed' && (
            <div className="mt-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-sm">Build failed. Check logs above for details.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
