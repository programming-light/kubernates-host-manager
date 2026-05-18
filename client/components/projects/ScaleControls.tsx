'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Maximize2, Minus, Plus, Cpu, HardDrive } from 'lucide-react';
import { toast } from 'sonner';

interface ScaleControlsProps {
  projectId: string;
}

export default function ScaleControls({ projectId }: ScaleControlsProps) {
  const [deployment, setDeployment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [scaling, setScaling] = useState(false);
  const [newReplicas, setNewReplicas] = useState(1);
  const [cpuLimit, setCpuLimit] = useState('500m');
  const [memoryLimit, setMemoryLimit] = useState('512Mi');
  const [cpuRequest, setCpuRequest] = useState('100m');
  const [memoryRequest, setMemoryRequest] = useState('128Mi');
  const [hpaEnabled, setHpaEnabled] = useState(false);
  const [hpaMin, setHpaMin] = useState(1);
  const [hpaMax, setHpaMax] = useState(5);
  const [hpaCpu, setHpaCpu] = useState(80);
  const [hpaMemory, setHpaMemory] = useState(80);
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

  useEffect(() => {
    fetchDeployment();
  }, [projectId]);

  const fetchDeployment = async () => {
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/deployment`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (data.deployed) {
          setDeployment(data);
          setNewReplicas(data.replicas?.desired || 1);
          setCpuLimit(data.resources?.limits?.cpu || '500m');
          setMemoryLimit(data.resources?.limits?.memory || '512Mi');
          setCpuRequest(data.resources?.requests?.cpu || '100m');
          setMemoryRequest(data.resources?.requests?.memory || '128Mi');
          setHpaEnabled(data.hpa?.enabled || false);
          if (data.hpa?.enabled) {
            setHpaMin(data.hpa.minReplicas || 1);
            setHpaMax(data.hpa.maxReplicas || 5);
          }
        } else {
          setDeployment(null);
        }
      }
    } catch {
      setDeployment(null);
    } finally {
      setLoading(false);
    }
  };

  const scaleHorizontally = async (replicas: number) => {
    if (replicas < 0) return;
    setScaling(true);
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/scale`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ replicas }),
      });
      if (res.ok) {
        toast.success(`Scaled to ${replicas} replicas`);
        setNewReplicas(replicas);
        await fetchDeployment();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to scale');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to scale');
    } finally {
      setScaling(false);
    }
  };

  const scaleVertically = async () => {
    setScaling(true);
    try {
      const res = await fetch(`${baseUrl}/container/${projectId}/resources`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ cpu: cpuLimit, memory: memoryLimit, cpuRequest, memoryRequest }),
      });
      if (res.ok) {
        toast.success('Resources updated');
        await fetchDeployment();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to update resources');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update resources');
    } finally {
      setScaling(false);
    }
  };

  const toggleHPA = async () => {
    setScaling(true);
    try {
      if (hpaEnabled) {
        const res = await fetch(`${baseUrl}/container/${projectId}/autoscale`, {
          method: 'DELETE',
          credentials: 'include',
        });
        if (res.ok) {
          toast.success('Auto-scaling disabled');
          setHpaEnabled(false);
        }
      } else {
        const res = await fetch(`${baseUrl}/container/${projectId}/autoscale`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ minReplicas: hpaMin, maxReplicas: hpaMax, targetCPU: hpaCpu, targetMemory: hpaMemory }),
        });
        if (res.ok) {
          toast.success('Auto-scaling enabled');
          setHpaEnabled(true);
        }
      }
      await fetchDeployment();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update auto-scaling');
    } finally {
      setScaling(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-gray-800 bg-gray-900/50">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Maximize2 className="h-5 w-5 text-blue-400" />
            <CardTitle className="text-white">Horizontal Scaling</CardTitle>
          </div>
          <CardDescription className="text-gray-400">Increase or decrease the number of running replicas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => scaleHorizontally(Math.max(0, newReplicas - 1))} disabled={scaling || newReplicas <= 0} className="border-gray-700 text-gray-300">
                <Minus className="h-4 w-4" />
              </Button>
              <div className="text-center px-6 py-2 bg-gray-800 rounded-lg border border-gray-700">
                <span className="text-2xl font-bold text-white">{deployment?.replicas?.current || 0}</span>
                <span className="text-gray-500 text-sm ml-1">/ {newReplicas}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => scaleHorizontally(newReplicas + 1)} disabled={scaling} className="border-gray-700 text-gray-300">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="text-sm text-gray-400">
              {deployment?.replicas?.available !== undefined && (
                <span>{deployment.replicas.available} available</span>
              )}
            </div>
            <Input
              type="number"
              min={0}
              max={20}
              value={newReplicas}
              onChange={(e) => setNewReplicas(parseInt(e.target.value) || 0)}
              className="w-20 bg-gray-800 border-gray-700 text-white text-center"
            />
            <Button onClick={() => scaleHorizontally(newReplicas)} disabled={scaling} size="sm" className="bg-blue-600 hover:bg-blue-700">
              {scaling ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Apply'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-purple-400" />
            <CardTitle className="text-white">Vertical Scaling (Resources)</CardTitle>
          </div>
          <CardDescription className="text-gray-400">Adjust CPU and memory allocated to each replica</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">CPU Limit</Label>
              <Input value={cpuLimit} onChange={(e) => setCpuLimit(e.target.value)} placeholder="500m" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">Memory Limit</Label>
              <Input value={memoryLimit} onChange={(e) => setMemoryLimit(e.target.value)} placeholder="512Mi" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">CPU Request</Label>
              <Input value={cpuRequest} onChange={(e) => setCpuRequest(e.target.value)} placeholder="100m" className="bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300 text-sm">Memory Request</Label>
              <Input value={memoryRequest} onChange={(e) => setMemoryRequest(e.target.value)} placeholder="128Mi" className="bg-gray-800 border-gray-700 text-white" />
            </div>
          </div>
          <Button onClick={scaleVertically} disabled={scaling} className="bg-purple-600 hover:bg-purple-700">
            {scaling ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Update Resources
          </Button>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5 text-green-400" />
            <CardTitle className="text-white">Auto-scaling (HPA)</CardTitle>
          </div>
          <CardDescription className="text-gray-400">Automatically scale based on CPU/Memory usage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Switch checked={hpaEnabled} onCheckedChange={toggleHPA} disabled={scaling} />
              <Label className="text-white">{hpaEnabled ? 'Enabled' : 'Disabled'}</Label>
            </div>
          </div>
          {hpaEnabled && (
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">Min Replicas</Label>
                <Input type="number" min={1} value={hpaMin} onChange={(e) => setHpaMin(parseInt(e.target.value) || 1)} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">Max Replicas</Label>
                <Input type="number" min={1} value={hpaMax} onChange={(e) => setHpaMax(parseInt(e.target.value) || 5)} className="bg-gray-800 border-gray-700 text-white" />
              </div>
              <div className="space-y-2">
                <Label className="text-gray-300 text-sm">CPU Target (%)</Label>
                <Input type="number" min={1} max={100} value={hpaCpu} onChange={(e) => setHpaCpu(parseInt(e.target.value) || 80)} className="bg-gray-800 border-gray-700 text-white" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
