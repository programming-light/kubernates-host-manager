'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Save, Loader2, Key, Shield, Server, Plus, Trash2, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [email] = useState('');
  const [clusters, setClusters] = useState<any[]>([]);
  const [clustersLoading, setClustersLoading] = useState(false);
  const [showCreateCluster, setShowCreateCluster] = useState(false);
  const [newClusterName, setNewClusterName] = useState('');
  const [creatingCluster, setCreatingCluster] = useState(false);
  const [workspaces, setWorkspaces] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
    }
    fetchClusters();
    fetchWorkspaces();
  }, [user]);

  const fetchClusters = async () => {
    setClustersLoading(true);
    try {
      const res = await api.get('/clusters');
      const data = await res.json();
      setClusters(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    finally { setClustersLoading(false); }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await api.get('/workspaces');
      const data = await res.json();
      setWorkspaces(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
  };

  const handleCreateCluster = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClusterName.trim() || workspaces.length === 0) return;
    setCreatingCluster(true);
    try {
      const res = await api.post('/clusters', { workspaceId: workspaces[0].id, name: newClusterName.trim() });
      if (res.ok) {
        toast.success('Cluster created');
        setNewClusterName('');
        setShowCreateCluster(false);
        fetchClusters();
      } else {
        const err = await res.json();
        toast.error(err.message || 'Failed to create cluster');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create cluster');
    } finally { setCreatingCluster(false); }
  };

  const handleDeleteCluster = async (clusterId: string) => {
    try {
      const res = await api.delete(`/clusters/${clusterId}`);
      if (res.ok) {
        toast.success('Cluster deleted');
        fetchClusters();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete cluster');
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await api.put('/auth/me', { name });
      if (response.ok) {
        toast.success('Profile updated successfully');
        await refreshUser();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="mt-1 text-gray-400">Manage your account settings</p>
      </div>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <User className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Profile</CardTitle>
              <CardDescription className="text-gray-400">
                Update your personal information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-300">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="border-gray-700 bg-gray-800 pl-10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-gray-300">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                <Input
                  id="email"
                  value={email}
                  disabled
                  className="border-gray-700 bg-gray-800 pl-10 text-gray-500"
                />
              </div>
              <p className="text-xs text-gray-500">Email cannot be changed</p>
            </div>

            <Button type="submit" disabled={loading} className="bg-blue-600 hover:bg-blue-700">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
              <Key className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl text-white">Security</CardTitle>
              <CardDescription className="text-gray-400">
                Manage your authentication
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-4">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium text-white">Two-Factor Authentication</p>
                <p className="text-sm text-gray-500">Add an extra layer of security</p>
              </div>
            </div>
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
              Enable
            </Button>
          </div>

          <div className="rounded-lg border border-gray-800 bg-gray-800/30 p-4">
            <p className="text-sm text-gray-400">
              Your account is protected using OTP-based authentication. Each login requires a one-time password sent to your email.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-green-500 to-teal-600">
                <Server className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl text-white">Clusters</CardTitle>
                <CardDescription className="text-gray-400">
                  Manage your Kubernetes clusters
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={() => setShowCreateCluster(!showCreateCluster)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="mr-1 h-4 w-4" /> New Cluster
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {showCreateCluster && (
            <form onSubmit={handleCreateCluster} className="flex gap-2">
              <Input
                value={newClusterName}
                onChange={(e) => setNewClusterName(e.target.value)}
                placeholder="Cluster name"
                className="border-gray-700 bg-gray-800 text-white"
              />
              <Button type="submit" disabled={creatingCluster || !newClusterName.trim() || workspaces.length === 0}>
                {creatingCluster ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
            </form>
          )}
          {clustersLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : clusters.length === 0 ? (
            <p className="text-gray-500 text-sm py-2">No clusters yet. Create your first cluster for free.</p>
          ) : (
            <div className="space-y-2">
              {clusters.map((cluster: any) => (
                <div key={cluster.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3">
                  <div className="flex items-center gap-3">
                    <Server className="h-5 w-5 text-green-400" />
                    <div>
                      <p className="font-medium text-white">{cluster.name}</p>
                      <p className="text-xs text-gray-500">{cluster.provider} | {cluster.region || 'local'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/dashboard/clusters/${cluster.id}`}>
                      <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCluster(cluster.id)} className="text-red-400 hover:text-red-300">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-xl text-white">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-red-900/50 bg-red-900/10 p-4">
            <div>
              <p className="font-medium text-white">Delete Account</p>
              <p className="text-sm text-gray-400">Permanently delete your account and all data</p>
            </div>
            <Button variant="destructive" className="bg-red-600 hover:bg-red-700">
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
