'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Database, Loader2, Plus, Trash2, Copy, ExternalLink, Server, Info, Edit3, UserPlus, Shield, Network } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface DatabaseInstance {
  id: string;
  workspaceId: string;
  projectId: string | null;
  name: string;
  type: 'POSTGRESQL' | 'MYSQL' | 'MARIADB' | 'MONGODB' | 'FERRETDB' | 'REDIS' | 'SQLITE';
  version: string;
  status: 'PROVISIONING' | 'RUNNING' | 'FAILED' | 'DELETING' | 'DELETED';
  namespace: string;
  storageSize: string;
  port: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  connectionString: string;
  sslEnabled: boolean;
  ipWhitelistEnabled: boolean;
  createdAt: string;
  workspace: { name: string; slug: string };
}

const DB_PERMISSIONS = ['READ_ONLY', 'READ_WRITE', 'ADMIN', 'DBA'] as const;

const PERMISSION_LABELS: Record<string, string> = {
  READ_ONLY: 'Read Only',
  READ_WRITE: 'Read Write',
  ADMIN: 'Admin',
  DBA: 'DBA',
};

interface DatabaseUser {
  id: string;
  databaseId: string;
  username: string;
  password: string;
  permission: string;
  createdAt: string;
}

interface IpWhitelistEntry {
  id: string;
  databaseId: string;
  cidr: string;
  description: string | null;
  createdAt: string;
}

const STORAGE_OPTIONS = ['256Mi', '512Mi', '1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi', 'custom'];

function generatePassword(length = 24): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

const DB_LABELS: Record<string, string> = {
  POSTGRESQL: 'PostgreSQL',
  MYSQL: 'MySQL',
  MARIADB: 'MariaDB',
  MONGODB: 'MongoDB',
  FERRETDB: 'FerretDB',
  REDIS: 'Redis',
  SQLITE: 'SQLite',
};

const DB_COLORS: Record<string, string> = {
  POSTGRESQL: 'text-blue-400 bg-blue-500/10',
  MYSQL: 'text-orange-400 bg-orange-500/10',
  MARIADB: 'text-yellow-400 bg-yellow-500/10',
  MONGODB: 'text-green-400 bg-green-500/10',
  FERRETDB: 'text-teal-400 bg-teal-500/10',
  REDIS: 'text-red-400 bg-red-500/10',
  SQLITE: 'text-purple-400 bg-purple-500/10',
};

const STATUS_COLORS: Record<string, string> = {
  RUNNING: 'bg-green-500',
  PROVISIONING: 'bg-yellow-500',
  FAILED: 'bg-red-500',
  DELETING: 'bg-orange-500',
  DELETED: 'bg-gray-500',
};

function CreateDatabaseDialog({ open, onOpenChange, onSuccess }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState('POSTGRESQL');
  const [dbUser, setDbUser] = useState('');
  const [dbPassword, setDbPassword] = useState('');
  const [storageSize, setStorageSize] = useState('1Gi');
  const [customSize, setCustomSize] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: workspaces } = useQuery({
    queryKey: ['workspaces'],
    queryFn: () => apiClient.get<any[]>('/workspaces'),
  });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !dbUser.trim() || !dbPassword.trim()) return;
    if (!workspaces?.length) {
      toast.error('No workspace found. Create a workspace first.');
      return;
    }
    setCreating(true);
    try {
      const finalPassword = dbPassword.trim();
      const finalSize = storageSize === 'custom' ? customSize : storageSize;
      await apiClient.post('/databases', {
        workspaceId: workspaces[0].id,
        name: name.trim(),
        type,
        storageSize: finalSize,
        dbUser: dbUser.trim(),
        dbPassword: finalPassword,
      });
      toast.success(`${DB_LABELS[type]} database "${name}" created`);
      onSuccess();
      onOpenChange(false);
      setName('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to create database');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Database</DialogTitle>
          <DialogDescription className="text-gray-400">
            Provision a new database instance on your Kubernetes cluster
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="db-name" className="text-gray-300">Database Name</Label>
            <Input
              id="db-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="my-database"
              className="border-gray-700 bg-gray-800 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="db-user" className="text-gray-300">Username</Label>
            <Input
              id="db-user"
              value={dbUser}
              onChange={(e) => setDbUser(e.target.value)}
              placeholder="e.g. admin"
              className="border-gray-700 bg-gray-800 text-white"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="db-pass" className="text-gray-300">Password</Label>
            <div className="flex gap-2">
              <Input
                id="db-pass"
                type="text"
                value={dbPassword}
                onChange={(e) => setDbPassword(e.target.value)}
                placeholder="Click generate for random password"
                className="flex-1 border-gray-700 bg-gray-800 text-white"
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setDbPassword(generatePassword())} className="shrink-0 border-gray-700 text-gray-300 hover:text-white">
                Generate
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="db-type" className="text-gray-300">Database Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-gray-700 bg-gray-900 text-white">
                {Object.entries(DB_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k} className="hover:bg-gray-800">{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {type === 'FERRETDB' && (
              <div className="mt-3 rounded-lg border border-teal-500/20 bg-teal-500/10 p-3 text-sm text-teal-300">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Open-source alternative to MongoDB Enterprise</p>
                    <ul className="mt-1.5 space-y-1 text-teal-400/80">
                      <li>- 100% open-source (Apache 2.0 license)</li>
                      <li>- Drop-in replacement for MongoDB drivers</li>
                      <li>- Uses PostgreSQL as backend for reliability</li>
                      <li>- No vendor lock-in, fully compatible with MongoDB protocol</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="db-storage" className="text-gray-300">Storage Size</Label>
            <Select value={storageSize} onValueChange={setStorageSize}>
              <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-gray-700 bg-gray-900 text-white">
                {STORAGE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {storageSize === 'custom' && (
              <Input
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                placeholder="e.g. 15Gi"
                className="mt-2 border-gray-700 bg-gray-800 text-white"
              />
            )}
          </div>
          <Button type="submit" disabled={creating} className="w-full bg-blue-600 hover:bg-blue-700">
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Database
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditDatabaseDialog({ db, open, onOpenChange, onSuccess }: {
  db: DatabaseInstance;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(db.name);
  const [storageSize, setStorageSize] = useState(STORAGE_OPTIONS.includes(db.storageSize) ? db.storageSize : 'custom');
  const [customSize, setCustomSize] = useState(STORAGE_OPTIONS.includes(db.storageSize) ? '' : db.storageSize);
  const [sslEnabled, setSslEnabled] = useState(db.sslEnabled);
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(db.ipWhitelistEnabled);
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const finalSize = storageSize === 'custom' ? customSize : storageSize;
      await apiClient.put(`/databases/${db.id}`, {
        name: name.trim(),
        storageSize: finalSize,
        sslEnabled,
        ipWhitelistEnabled,
      });
      toast.success('Database updated');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update database');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Database</DialogTitle>
          <DialogDescription className="text-gray-400">
            Update configuration for {db.name}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="border-gray-700 bg-gray-800 text-white"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Storage Size</Label>
            <Select value={storageSize} onValueChange={setStorageSize}>
              <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="border-gray-700 bg-gray-900 text-white">
                {STORAGE_OPTIONS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {storageSize === 'custom' && (
              <Input
                value={customSize}
                onChange={(e) => setCustomSize(e.target.value)}
                placeholder="e.g. 15Gi"
                className="mt-2 border-gray-700 bg-gray-800 text-white"
              />
            )}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-700 p-3">
            <div>
              <Label className="text-gray-300">SSL</Label>
              <p className="text-xs text-gray-500">Enable SSL/TLS encryption</p>
            </div>
            <Switch checked={sslEnabled} onCheckedChange={setSslEnabled} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-gray-700 p-3">
            <div>
              <Label className="text-gray-300">IP Whitelist</Label>
              <p className="text-xs text-gray-500">Restrict access by IP address</p>
            </div>
            <Switch checked={ipWhitelistEnabled} onCheckedChange={setIpWhitelistEnabled} />
          </div>
          <Button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddAccountDialog({ dbId, open, onOpenChange, onSuccess }: {
  dbId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [permission, setPermission] = useState('READ_WRITE');
  const [created, setCreated] = useState<{ username: string; password: string } | null>(null);
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const body: any = { permission };
      if (username.trim()) body.username = username.trim();
      if (password.trim()) body.password = password.trim();
      const res = await apiClient.post<{ username: string; password: string }>(`/databases/${dbId}/users`, body);
      setCreated({ username: res.username, password: res.password });
      toast.success(`Account "${res.username}" created`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to create account');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setCreated(null); setPassword(''); } onOpenChange(v); }}>
      <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Database Account</DialogTitle>
          <DialogDescription className="text-gray-400">
            Create a new account for this database
          </DialogDescription>
        </DialogHeader>
        {created ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-500/20 bg-green-500/10 p-4">
              <p className="text-sm font-medium text-green-400">Account Created</p>
              <div className="mt-3 space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Username</p>
                  <p className="text-sm text-white font-mono">{created.username}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Password</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate text-sm text-green-400 font-mono">{created.password}</code>
                    <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(created.password); toast.success('Copied'); }} className="text-gray-400 hover:text-white">
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                <p className="text-xs text-yellow-400">Save these credentials - password won't be shown again</p>
              </div>
            </div>
            <Button onClick={() => { setCreated(null); setPassword(''); onOpenChange(false); }} className="w-full bg-gray-700 hover:bg-gray-600">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Username</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. app_user"
                className="border-gray-700 bg-gray-800 text-white"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Password</Label>
              <Input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Auto-generated if empty"
                className="border-gray-700 bg-gray-800 text-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Permission</Label>
              <Select value={permission} onValueChange={setPermission}>
                <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-gray-700 bg-gray-900 text-white">
                  {DB_PERMISSIONS.map((p) => (
                    <SelectItem key={p} value={p}>{PERMISSION_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={creating} className="w-full bg-blue-600 hover:bg-blue-700">
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create User
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddIpDialog({ dbId, open, onOpenChange, onSuccess }: {
  dbId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSuccess: () => void;
}) {
  const [cidr, setCidr] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await apiClient.post(`/databases/${dbId}/ip-whitelist`, { cidr: cidr.trim(), description: description.trim() || undefined });
      toast.success('IP whitelist entry added');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to add IP');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-gray-800 bg-gray-900 text-white sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add IP to Whitelist</DialogTitle>
          <DialogDescription className="text-gray-400">
            Allow access from this IP or CIDR range
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-2">
            <Label className="text-gray-300">IP / CIDR</Label>
            <Input
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder="e.g. 192.168.1.0/24"
              className="border-gray-700 bg-gray-800 text-white font-mono"
              required
            />
          </div>
          <div className="space-y-2">
            <Label className="text-gray-300">Description (optional)</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Office network"
              className="border-gray-700 bg-gray-800 text-white"
            />
          </div>
          <Button type="submit" disabled={creating} className="w-full bg-blue-600 hover:bg-blue-700">
            {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Add IP
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function DatabasesPage() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editDb, setEditDb] = useState<DatabaseInstance | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [addUserDbId, setAddUserDbId] = useState<string | null>(null);
  const [addIpDbId, setAddIpDbId] = useState<string | null>(null);

  const { data: databases = [], isLoading } = useQuery({
    queryKey: ['databases', 'list'],
    queryFn: () => apiClient.get<DatabaseInstance[]>('/databases'),
    refetchInterval: 10000,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/databases/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['databases'] });
      toast.success('Database deleted');
    },
    onError: (error: any) => toast.error(error.message || 'Failed to delete database'),
  });

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
    } finally {
      setDeleteId(null);
    }
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Databases</h1>
          <p className="text-gray-400">Managed database instances on your Kubernetes cluster</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" />
          New Database
        </Button>
      </div>

      {isLoading ? (
        <div className="flex min-h-[40vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
        </div>
      ) : databases.length === 0 ? (
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Database className="mb-4 h-12 w-12 text-gray-600" />
            <p className="text-lg font-medium text-gray-300">No databases yet</p>
            <p className="mt-1 text-sm text-gray-500">Create your first database to get started</p>
            <Button onClick={() => setShowCreate(true)} className="mt-6 bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-2 h-4 w-4" />
              Create Database
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {databases.map((db) => (
            <DatabaseCard
              key={db.id}
              db={db}
              expandedId={expandedId}
              onToggleExpand={() => setExpandedId(expandedId === db.id ? null : db.id)}
              onEdit={() => setEditDb(db)}
              onDelete={() => setDeleteId(db.id)}
              onAddUser={() => setAddUserDbId(db.id)}
              onAddIp={() => setAddIpDbId(db.id)}
              handleCopy={handleCopy}
            />
          ))}
        </div>
      )}

      <CreateDatabaseDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['databases'] })}
      />

      {editDb && (
        <EditDatabaseDialog
          db={editDb}
          open={!!editDb}
          onOpenChange={(v) => { if (!v) setEditDb(null); }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['databases'] })}
        />
      )}

      {addUserDbId && (
        <AddAccountDialog
          dbId={addUserDbId}
          open={!!addUserDbId}
          onOpenChange={(v) => { if (!v) setAddUserDbId(null); }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['databases'] })}
        />
      )}

      {addIpDbId && (
        <AddIpDialog
          dbId={addIpDbId}
          open={!!addIpDbId}
          onOpenChange={(v) => { if (!v) setAddIpDbId(null); }}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['databases'] })}
        />
      )}

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => { if (!open) setDeleteId(null); }}
        title="Delete Database"
        message="Are you sure you want to delete this database? All data will be permanently lost."
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

function DatabaseCard({ db, expandedId, onToggleExpand, onEdit, onDelete, onAddUser, onAddIp, handleCopy }: {
  db: DatabaseInstance;
  expandedId: string | null;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddUser: () => void;
  onAddIp: () => void;
  handleCopy: (text: string) => void;
}) {
  const isExpanded = expandedId === db.id;

  const { data: users = [] } = useQuery({
    queryKey: ['databases', db.id, 'users'],
    queryFn: () => apiClient.get<DatabaseUser[]>(`/databases/${db.id}/users`),
    enabled: isExpanded,
  });

  const { data: ipWhitelist = [] } = useQuery({
    queryKey: ['databases', db.id, 'ip-whitelist'],
    queryFn: () => apiClient.get<IpWhitelistEntry[]>(`/databases/${db.id}/ip-whitelist`),
    enabled: isExpanded,
  });

  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => apiClient.delete(`/databases/${db.id}/users/${userId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['databases', db.id, 'users'] }); toast.success('Account deleted'); },
  });

  const deleteIpMutation = useMutation({
    mutationFn: (whitelistId: string) => apiClient.delete(`/databases/${db.id}/ip-whitelist/${whitelistId}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['databases', db.id, 'ip-whitelist'] }); toast.success('IP whitelist entry removed'); },
  });

  const queryClient = useQueryClient();

  return (
    <Card className="border-gray-800 bg-gray-900/50">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${DB_COLORS[db.type] || 'text-gray-400 bg-gray-800'}`}>
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-white">{db.name}</h3>
                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${DB_COLORS[db.type] || 'bg-gray-800 text-gray-400'}`}>
                  {DB_LABELS[db.type] || db.type}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className={`inline-block h-2 w-2 rounded-full ${STATUS_COLORS[db.status] || 'bg-gray-500'}`} />
                  {db.status}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-gray-400">
                {db.workspace?.name || 'No workspace'} — {db.storageSize}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onEdit} className="text-gray-400 hover:text-white">
              <Edit3 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onToggleExpand} className="text-gray-400 hover:text-white">
              <Server className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-400 hover:text-red-300 hover:bg-red-900/20">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isExpanded && (
          <div className="mt-4 space-y-4 border-t border-gray-800 pt-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Connection String</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-gray-800 px-3 py-2 text-sm text-green-400 font-mono">
                  {db.connectionString ? `${db.dbUser}:${db.dbPassword}` : 'Provisioning...'}
                </code>
                {db.connectionString && (
                  <Button variant="ghost" size="sm" onClick={() => handleCopy(`${db.dbUser}:${db.dbPassword}`)} className="text-gray-400 hover:text-white">
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <p className="text-xs text-gray-500">Database</p>
                <p className="text-sm text-white font-mono">{db.dbName}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Username</p>
                <p className="text-sm text-white font-mono">{db.dbUser}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Port</p>
                <p className="text-sm text-white font-mono">{db.port || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">SSL</p>
                <p className="text-sm text-white">{db.sslEnabled ? 'Enabled' : 'Disabled'}</p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-gray-500">Namespace</p>
              <code className="rounded bg-gray-800 px-2 py-1 text-sm text-gray-300 font-mono">{db.namespace}</code>
            </div>

            <div className="border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">Accounts ({users.length})</span>
                </div>
                <Button variant="ghost" size="sm" onClick={onAddUser} className="text-blue-400 hover:text-blue-300">
                  <Plus className="mr-1 h-3 w-3" /> Add Account
                </Button>
              </div>
              {users.length === 0 ? (
                <p className="text-xs text-gray-500">No accounts yet</p>
              ) : (
                <div className="space-y-2">
                  {users.map((u) => (
                    <div key={u.id} className="rounded bg-gray-800/50 px-3 py-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-white font-mono">{u.username}</span>
                          <span className="rounded bg-gray-700/50 px-1.5 py-0.5 text-xs text-gray-400">
                            {PERMISSION_LABELS[u.permission] || u.permission}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleCopy(`${u.username}:${u.password}`)} className="text-gray-400 hover:text-white h-6" title="Copy credentials">
                            <Copy className="h-3 w-3" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteUserMutation.mutate(u.id)} className="text-red-400 hover:text-red-300 h-6 w-6">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <code className="mt-1 block truncate text-xs text-green-400/70 font-mono">{u.username}:{u.password}</code>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-gray-800 pt-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-300">IP Whitelist ({ipWhitelist.length})</span>
                </div>
                <Button variant="ghost" size="sm" onClick={onAddIp} className="text-blue-400 hover:text-blue-300">
                  <Plus className="mr-1 h-3 w-3" /> Add IP
                </Button>
              </div>
              {ipWhitelist.length === 0 ? (
                <p className="text-xs text-gray-500">No IP restrictions (all IPs allowed)</p>
              ) : (
                <div className="space-y-1">
                  {ipWhitelist.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between rounded bg-gray-800/50 px-3 py-1.5">
                      <div>
                        <span className="text-sm text-white font-mono">{entry.cidr}</span>
                        {entry.description && (
                          <span className="ml-2 text-xs text-gray-500">{entry.description}</span>
                        )}
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => deleteIpMutation.mutate(entry.id)} className="text-red-400 hover:text-red-300 h-6 w-6">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
