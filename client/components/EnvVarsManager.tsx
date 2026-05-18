'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Trash2, Plus, FileUp } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { ConfirmDialog } from './ui/confirm-dialog';

interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

interface EnvFile {
  [key: string]: EnvVar;
}

interface EnvVarsManagerProps {
  projectId?: string;
  workspaceId?: string;
  mode: 'project' | 'workspace';
}

export default function EnvVarsManager({ projectId, workspaceId, mode }: EnvVarsManagerProps) {
  const [envFile, setEnvFile] = useState<EnvFile>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newIsSecret, setNewIsSecret] = useState(false);
  const [envContent, setEnvContent] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editIsSecret, setEditIsSecret] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const envBase = mode === 'project' && projectId
    ? `/projects/${projectId}/env`
    : `/workspaces/${workspaceId}/env`;

  const fetchEnvVars = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(envBase);
      const data = await res.json();
      const parsedEnv = mode === 'project' ? (data.project || {}) : (data.env || {});
      setEnvFile(parsedEnv);
    } catch {
      setEnvFile({});
    } finally {
      setLoading(false);
    }
  }, [envBase]);

  useEffect(() => { fetchEnvVars(); }, [fetchEnvVars]);

  function resetForm() {
    setNewKey('');
    setNewValue('');
    setNewIsSecret(false);
  }

  async function saveEnvVar(e: React.FormEvent) {
    e.preventDefault();
    if (!newKey.trim() || saving) return;
    setSaving(true);
    try {
      await api.post(envBase, { key: newKey.trim(), value: newValue, isSecret: newIsSecret });
      toast.success(`Added ${newKey}`);
      resetForm();
      await fetchEnvVars();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save environment variable');
    } finally {
      setSaving(false);
    }
  }

  async function saveBulkEnv(e: React.FormEvent) {
    e.preventDefault();
    if (!envContent.trim() || saving) return;
    setSaving(true);
    try {
      await api.post(envBase, { envContent });
      toast.success('Imported environment variables');
      setEnvContent('');
      await fetchEnvVars();
    } catch (error: any) {
      toast.error(error.message || 'Failed to import environment variables');
    } finally {
      setSaving(false);
    }
  }

  function deleteEnvVar(key: string) {
    setDeleteTarget(key);
  }

  async function confirmDeleteEnvVar() {
    if (!deleteTarget) return;
    try {
      await api.delete(`${envBase}/${encodeURIComponent(deleteTarget)}`);
      toast.success(`Deleted ${deleteTarget}`);
      setEditingKey(null);
      await fetchEnvVars();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete environment variable');
    } finally {
      setDeleteTarget(null);
    }
  }

  function startEdit(v: EnvVar) {
    setEditingKey(v.key);
    setEditValue(v.value);
    setEditIsSecret(v.isSecret);
  }

  function cancelEdit() {
    setEditingKey(null);
  }

  async function saveEdit(key: string) {
    try {
      await api.put(`${envBase}/${encodeURIComponent(key)}`, { value: editValue, isSecret: editIsSecret });
      toast.success(`Updated ${key}`);
      setEditingKey(null);
      await fetchEnvVars();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update environment variable');
    }
  }

  const envVars = Object.values(envFile);

  if (loading) return <div className="p-4 text-gray-400">Loading environment variables...</div>;

  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardHeader>
        <CardTitle className="text-white">Environment Variables</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {envVars.length === 0 ? (
          <div className="py-8 text-center rounded-lg border border-dashed border-gray-700">
            <p className="text-gray-500 text-sm">No environment variables yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {envVars.map((v) => (
              editingKey === v.key ? (
                <div key={v.key} className="flex items-center gap-2 p-3 border border-blue-800 rounded-lg bg-blue-900/10">
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm font-semibold text-white truncate block">{v.key}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <Input value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      type={editIsSecret ? 'password' : 'text'}
                      className="bg-gray-800 border-gray-700 text-white text-sm font-mono" />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center space-x-1.5">
                      <Switch checked={editIsSecret} onCheckedChange={setEditIsSecret} />
                      <Label className="text-gray-300 text-[10px]">Secret</Label>
                    </div>
                    <Button size="sm" onClick={() => saveEdit(v.key)} className="bg-blue-600 hover:bg-blue-700 h-8 px-2">
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-8 px-2 text-gray-400">
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div key={v.key} className="flex items-center gap-2 p-3 border border-gray-800 rounded-lg bg-gray-900/30 hover:border-gray-700 cursor-pointer transition-colors" onClick={() => startEdit(v)}>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm font-semibold text-white truncate block">{v.key}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-mono text-sm text-gray-300 truncate block">{v.isSecret ? '••••••••' : v.value}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {v.isSecret && <span className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-1 rounded">SECRET</span>}
                    <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); deleteEnvVar(v.key); }}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        <form onSubmit={saveEnvVar} className="flex items-center gap-2">
          <Input value={newKey} onChange={(e) => setNewKey(e.target.value)}
            placeholder="KEY" className="flex-1 bg-gray-800 border-gray-700 text-white text-sm font-mono" />
          <Input value={newValue} onChange={(e) => setNewValue(e.target.value)}
            type={newIsSecret ? 'password' : 'text'}
            placeholder="value" className="flex-1 bg-gray-800 border-gray-700 text-white text-sm" />
          <div className="flex items-center gap-1.5 shrink-0">
            <Switch checked={newIsSecret} onCheckedChange={setNewIsSecret} />
            <Label className="text-gray-300 text-xs">Secret</Label>
          </div>
          <Button size="sm" type="submit" disabled={saving || !newKey.trim()} className="bg-blue-600 hover:bg-blue-700 h-9 px-3">
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        </form>

        <form onSubmit={saveBulkEnv} className="space-y-2">
          <Label className="text-gray-300 text-sm">Bulk Import (.env format)</Label>
          <textarea value={envContent} onChange={(e) => setEnvContent(e.target.value)}
            placeholder="KEY1=value1&#10;KEY2=value2"
            className="w-full h-24 rounded-lg border border-gray-700 bg-gray-800 text-white text-sm font-mono p-3" />
          <Button size="sm" type="submit" disabled={saving || !envContent.trim()} className="bg-green-600 hover:bg-green-700">
            <FileUp className="w-4 h-4 mr-1" />
            Import
          </Button>
        </form>
      </CardContent>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="Delete Environment Variable"
        message={`Are you sure you want to delete "${deleteTarget}"?`}
        onConfirm={confirmDeleteEnvVar}
      />
    </Card>
  );
}
