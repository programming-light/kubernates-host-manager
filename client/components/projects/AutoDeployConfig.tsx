'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Loader2, GitBranch, GitPullRequest, Webhook, RefreshCw, Copy, CheckCircle, AlertCircle, Save } from 'lucide-react';
import { toast } from 'sonner';

interface AutoDeployConfigProps {
  projectId: string;
}

const baseUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';

export default function AutoDeployConfig({ projectId }: AutoDeployConfigProps) {
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [branch, setBranch] = useState('main');
  const [buildCommand, setBuildCommand] = useState('');
  const [runCommand, setRunCommand] = useState('');
  const [rootDir, setRootDir] = useState('');
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/cicd/${projectId}/webhook`;

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const res = await fetch(`${baseUrl}/projects/${projectId}`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        setProject(data);
        setAutoDeploy(data.autoDeploy !== false);
        setBranch(data.branch || 'main');
        setBuildCommand(data.buildCommand || '');
        setRunCommand(data.runCommand || '');
        setRootDir(data.rootDir || '');
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${baseUrl}/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ autoDeploy, branch, buildCommand: buildCommand || null, runCommand: runCommand || null, rootDir: rootDir || null }),
      });
      if (res.ok) {
        toast.success('Configuration saved');
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to save config');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to save config');
    } finally {
      setSaving(false);
    }
  };

  const copyWebhookUrl = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    toast.success('Webhook URL copied');
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <GitBranch className="h-5 w-5" />
            Auto Deploy
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-700">
            <GitPullRequest className="h-4 w-4 text-white" />
          </div>
          <div>
            <CardTitle className="text-white text-base">Auto Deploy</CardTitle>
            <p className="text-xs text-gray-500">Configure automatic deployments on git push</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-5">
        <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${autoDeploy ? 'bg-green-500/10' : 'bg-gray-800'}`}>
              {autoDeploy ? <CheckCircle className="h-5 w-5 text-green-400" /> : <AlertCircle className="h-5 w-5 text-gray-500" />}
            </div>
            <div>
              <p className="text-sm font-medium text-white">Automatic Deployments</p>
              <p className="text-xs text-gray-500">
                {autoDeploy ? 'Auto-deploy on every git push' : 'Manual deploys only'}
              </p>
            </div>
          </div>
          <Switch checked={autoDeploy} onCheckedChange={setAutoDeploy} />
        </div>

        <div className="space-y-4">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Build Configuration</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Branch</label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="pl-9 bg-gray-800 border-gray-700 text-white text-sm"
                  placeholder="main"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Root Directory</label>
              <Input
                value={rootDir}
                onChange={(e) => setRootDir(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white text-sm font-mono"
                placeholder="/ (root)"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Build Command</label>
              <Input
                value={buildCommand}
                onChange={(e) => setBuildCommand(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white text-sm font-mono"
                placeholder="npm run build"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Run Command</label>
              <Input
                value={runCommand}
                onChange={(e) => setRunCommand(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white text-sm font-mono"
                placeholder="npm start"
              />
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider">Webhook</h4>
          <p className="text-xs text-gray-500">
            Add this webhook URL to your Git repository to trigger automatic deployments on push.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-800/30 p-3">
              <Webhook className="h-4 w-4 text-cyan-400 flex-shrink-0" />
              <code className="text-xs text-gray-300 font-mono truncate">{webhookUrl}</code>
            </div>
            <button onClick={copyWebhookUrl} className="p-2.5 rounded-lg border border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800">
              {copied ? <CheckCircle className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <Button onClick={saveConfig} disabled={saving} className="bg-cyan-600 hover:bg-cyan-700">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save Configuration
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
