'use client'; 

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ArrowLeft, Loader2, Folder, Trash2, UserCheck, Users, Settings } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import EnvVarsManager from '@/components/EnvVarsManager';

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [confirmAction, setConfirmAction] = useState<'delete' | 'transfer' | null>(null);

  useEffect(() => {
    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const fetchData = async () => {
    try {
      const [wsRes, membersRes] = await Promise.all([
        api.get(`/workspaces/${params.id}`),
        api.get(`/workspaces/${params.id}/members`),
      ]);
      const wsData = await wsRes.json();
      const membersData = await membersRes.json();
      setWorkspace(wsData);
      setMembers(membersData);
      setFormData({ name: wsData.name, description: wsData.description || '' });
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workspace');
      router.push('/dashboard/workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await api.put(`/workspaces/${params.id}`, formData);
      if (response.ok) {
        const data = await response.json();
        setWorkspace(data);
        toast.success('Workspace updated');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update workspace');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    setConfirmAction('delete');
  };

  const confirmDeleteWorkspace = async () => {
    setDeleting(true);
    try {
      await api.delete(`/workspaces/${params.id}`);
      toast.success('Workspace deleted');
      router.push('/dashboard/workspaces');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workspace');
    } finally {
      setDeleting(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferTargetId) {
      toast.error('Please select a member to transfer ownership to');
      return;
    }
    setConfirmAction('transfer');
  };

  const confirmTransfer = async () => {
    setTransferring(true);
    try {
      const response = await api.post(`/workspaces/${params.id}/transfer-ownership`, {
        newOwnerId: transferTargetId,
      });
      if (response.ok) {
        toast.success('Ownership transferred successfully');
        const data = await response.json();
        setWorkspace(data);
        setTransferTargetId('');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-400">Workspace not found</p>
      </div>
    );
  }

  const isOwner = workspace.ownerId === user?.id;
  const otherMembers = members.filter((m) => m.id !== 'owner');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push(`/dashboard/workspaces/${params.id}`)}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-white">Workspace Settings</h1>
      </div>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-white">General</CardTitle>
          <CardDescription className="text-gray-400">
            Update your workspace name and description
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdate} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-300">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="border-gray-700 bg-gray-800 text-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-300">Description</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="border-gray-700 bg-gray-800 text-white focus:border-blue-500 focus:ring-blue-500"
              />
            </div>

            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-white">Info</CardTitle>
          <CardDescription className="text-gray-400">
            Workspace details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-500">Slug</p>
            <p className="text-white">/{workspace.slug}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Created</p>
            <p className="text-white">{new Date(workspace.createdAt).toLocaleDateString()}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Owner</p>
            <p className="text-white">{workspace.owner?.name || 'Unknown'}</p>
          </div>
        </CardContent>
      </Card>

      {isOwner && otherMembers.length > 0 && (
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Transfer Ownership</CardTitle>
            <CardDescription className="text-gray-400">
              Transfer ownership of this workspace to another member. You will become an admin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleTransferSubmit} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="transfer" className="text-gray-300">New Owner</Label>
                <select
                  id="transfer"
                  value={transferTargetId}
                  onChange={(e) => setTransferTargetId(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select a member...</option>
                  {otherMembers.map((member) => (
                    <option key={member.user?.id} value={member.user?.id}>
                      {member.user?.name || member.user?.email} ({member.role})
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="submit"
                disabled={transferring || !transferTargetId}
                className="bg-yellow-600 hover:bg-yellow-700 sm:w-auto"
              >
                {transferring && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserCheck className="mr-2 h-4 w-4" />
                Transfer
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <EnvVarsManager 
        workspaceId={params.id as string} 
        mode="workspace" 
      />

      <Card className="border-red-900/50 bg-red-900/10">
        <CardHeader>
          <CardTitle className="text-red-400">Danger Zone</CardTitle>
          <CardDescription className="text-gray-400">
            Irreversible and destructive actions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-red-900/30 bg-red-900/10 p-4">
            <div>
              <p className="font-medium text-white">Delete Workspace</p>
              <p className="text-sm text-gray-400">
                Permanently delete this workspace and all its projects and clusters
              </p>
            </div>
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting}
              className="border-red-900 text-red-400 hover:bg-red-900/30"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={confirmAction === 'delete'}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title="Delete Workspace"
        message="Are you sure you want to delete this workspace? This action cannot be undone."
        onConfirm={confirmDeleteWorkspace}
        loading={deleting}
      />
      <ConfirmDialog
        open={confirmAction === 'transfer'}
        onOpenChange={(open) => { if (!open) setConfirmAction(null); }}
        title="Transfer Ownership"
        message="Are you sure you want to transfer ownership? You will become an admin."
        onConfirm={confirmTransfer}
        confirmLabel="Transfer"
        variant="default"
        loading={transferring}
      />
    </div>
  );
}
