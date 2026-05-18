'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  Trash2,
  Users,
  Shield,
  Mail,
  MoreVertical,
  UserCheck,
  AlertTriangle,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

interface Member {
  id: string;
  user: {
    id: string;
    email: string;
    name: string;
    avatar: string | null;
  };
  role: string;
  createdAt: string;
}

interface ConfirmModalState {
  open: boolean;
  title: string;
  message: string;
  type: 'warning' | 'danger';
  confirmText: string;
  onConfirm: () => void;
}

const ROLE_OPTIONS = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'DEVELOPER', label: 'Developer' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'VIEWER', label: 'Viewer' },
  { value: 'BILLING', label: 'Billing' },
];

export default function WorkspaceMembersPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState<any>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DEVELOPER');
  const [inviting, setInviting] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [selectValues, setSelectValues] = useState<Record<string, string>>({});
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    open: false,
    title: '',
    message: '',
    type: 'warning',
    confirmText: 'Confirm',
    onConfirm: () => {},
  });

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

      const initialSelectValues: Record<string, string> = {};
      membersData.forEach((m: Member) => {
        initialSelectValues[m.user?.id] = m.role;
      });
      setSelectValues(initialSelectValues);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load data');
      router.push('/dashboard/workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) {
      toast.error('Please enter an email');
      return;
    }

    setInviting(true);
    try {
      const existingMember = members.find(
        (m) => m.user?.email.toLowerCase() === inviteEmail.toLowerCase()
      );

      if (existingMember) {
        const response = await api.put(`/workspaces/${params.id}/members/${existingMember.user?.id}`, {
          role: inviteRole,
        });
        if (response.ok) {
          const updated = await response.json();
          setMembers(members.map((m) => (m.user?.id === existingMember.user?.id ? { ...m, role: updated.role } : m)));
          setSelectValues({ ...selectValues, [existingMember.user?.id]: updated.role });
          setInviteEmail('');
          setInviteRole('DEVELOPER');
          toast.success(`${existingMember.user?.name || existingMember.user?.email} role updated to ${updated.role}`);
        }
        return;
      }

      const response = await api.post(`/workspaces/${params.id}/members`, {
        email: inviteEmail,
        role: inviteRole,
      });

      if (response.ok) {
        const newMember = await response.json();
        setMembers([...members, { id: newMember.id, user: newMember.user, role: newMember.role, createdAt: newMember.createdAt }]);
        setSelectValues({ ...selectValues, [newMember.user.id]: newMember.role });
        setInviteEmail('');
        setInviteRole('DEVELOPER');
        toast.success(`${newMember.user.name || newMember.user.email} added to workspace`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const handleRoleSelect = (memberId: string, newRole: string, memberName: string) => {
    if (newRole === 'TRANSFER') {
      setSelectValues({ ...selectValues, [memberId]: members.find(m => m.user?.id === memberId)?.role || '' });
      showTransferModal(memberId, memberName);
      return;
    }

    setConfirmModal({
      open: true,
      title: 'Change Member Role',
      message: `Are you sure you want to change ${memberName}'s role to ${newRole}?`,
      type: 'warning',
      confirmText: 'Change Role',
      onConfirm: () => executeRoleChange(memberId, newRole),
    });
  };

  const executeRoleChange = async (memberId: string, newRole: string) => {
    try {
      const response = await api.put(`/workspaces/${params.id}/members/${memberId}`, { role: newRole });
      if (response.ok) {
        const updated = await response.json();
        setMembers(members.map((m) => (m.user?.id === memberId ? { ...m, role: updated.role } : m)));
        setSelectValues({ ...selectValues, [memberId]: updated.role });
        toast.success('Role updated successfully');
      }
    } catch (error: any) {
      setSelectValues({ ...selectValues, [memberId]: members.find(m => m.user?.id === memberId)?.role || '' });
      toast.error(error.message || 'Failed to update role');
    }
  };

  const showTransferModal = (memberId: string, memberName: string) => {
    setOpenDropdownId(null);
    setConfirmModal({
      open: true,
      title: 'Transfer Ownership',
      message: `Transfer ownership of this workspace to ${memberName}? You will become an Admin. This action cannot be undone easily.`,
      type: 'danger',
      confirmText: 'Transfer Ownership',
      onConfirm: () => executeTransferOwnership(memberId, memberName),
    });
  };

  const executeTransferOwnership = async (memberId: string, memberName: string) => {
    setTransferring(true);
    try {
      const response = await api.post(`/workspaces/${params.id}/transfer-ownership`, {
        newOwnerId: memberId,
      });
      if (response.ok) {
        toast.success('Ownership transferred successfully');
        await fetchData();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to transfer ownership');
    } finally {
      setTransferring(false);
    }
    setOpenDropdownId(null);
  };

  const showRemoveModal = (memberId: string, memberName: string) => {
    setConfirmModal({
      open: true,
      title: 'Remove Member',
      message: `Remove ${memberName} from this workspace? They will lose access to all workspace resources.`,
      type: 'danger',
      confirmText: 'Remove Member',
      onConfirm: () => executeRemove(memberId, memberName),
    });
  };

  const executeRemove = async (memberId: string, memberName: string) => {
    setRemovingId(memberId);
    try {
      await api.delete(`/workspaces/${params.id}/members/${memberId}`);
      setMembers(members.filter((m) => m.user?.id !== memberId));
      toast.success(`${memberName} removed from workspace`);
    } catch (error: any) {
      toast.error(error.message || 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
    setOpenDropdownId(null);
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
  const isOwnerOrAdmin = isOwner || workspace.memberRole === 'ADMIN';
  const ownerMember = members.find((m) => m.id === 'owner');

  return (
    <div className="space-y-6">
      {confirmModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <Card className={`w-full max-w-md border-gray-800 ${confirmModal.type === 'danger' ? 'bg-gray-900' : 'bg-gray-900'}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    confirmModal.type === 'danger'
                      ? 'bg-red-500/10'
                      : 'bg-yellow-500/10'
                  }`}>
                    {confirmModal.type === 'danger' ? (
                      <AlertTriangle className="h-5 w-5 text-red-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-400" />
                    )}
                  </div>
                  <CardTitle className="text-white">{confirmModal.title}</CardTitle>
                </div>
                <button
                  onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                  className="text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-300 mb-6">{confirmModal.message}</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setConfirmModal({ ...confirmModal, open: false })}
                  className="flex-1 border-gray-700 text-gray-300"
                >
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    confirmModal.onConfirm();
                    setConfirmModal({ ...confirmModal, open: false });
                  }}
                  className={`flex-1 ${
                    confirmModal.type === 'danger'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-yellow-600 hover:bg-yellow-700'
                  }`}
                >
                  {transferring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {confirmModal.confirmText}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          onClick={() => router.push(`/dashboard/workspaces/${params.id}`)}
          className="text-gray-400 hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-white">Workspace Members</h1>
      </div>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-white">Invite Members</CardTitle>
          <CardDescription className="text-gray-400">
            Add users to your workspace by their email address
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isOwnerOrAdmin ? (
            <form onSubmit={handleInvite} className="flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label htmlFor="email" className="text-gray-300">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="border-gray-700 bg-gray-800 pl-10 text-white placeholder:text-gray-500 focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="w-full space-y-2 sm:w-48">
                <Label htmlFor="role" className="text-gray-300">Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="border-gray-700 bg-gray-800 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-gray-700">
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button type="submit" disabled={inviting || !inviteEmail} className="bg-blue-600 hover:bg-blue-700 sm:w-auto">
                {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <UserPlus className="mr-2 h-4 w-4" />
                Invite
              </Button>
            </form>
          ) : (
            <p className="text-sm text-gray-400">Only workspace owners and admins can invite members</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">Members</CardTitle>
              <CardDescription className="text-gray-400">
                {members.length + 1} member{members.length + 1 !== 1 ? 's' : ''} in this workspace
              </CardDescription>
            </div>
            <Users className="h-5 w-5 text-gray-500" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {ownerMember && (
              <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 font-semibold">
                    {(ownerMember.user?.name || 'O')[0]}
                  </div>
                  <div>
                    <p className="font-medium text-white">{ownerMember.user?.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">{ownerMember.user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-yellow-400" />
                  <span className="text-sm font-medium text-yellow-400">Owner</span>
                </div>
              </div>
            )}

            {members
              .filter((m) => m.id !== 'owner')
              .map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 font-semibold">
                      {(member.user?.name || member.user?.email || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-white">{member.user?.name || 'Unknown'}</p>
                      <p className="text-sm text-gray-500">{member.user?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 relative">
                    <Select
                      value={selectValues[member.user?.id] || member.role}
                      onValueChange={(newRole) => handleRoleSelect(member.user?.id, newRole, member.user?.name || member.user?.email)}
                      disabled={!isOwnerOrAdmin}
                    >
                      <SelectTrigger className="w-32 border-gray-700 bg-gray-800 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 text-white border-gray-700">
                        {ROLE_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                        {isOwner && (
                          <SelectItem value="TRANSFER" className="text-yellow-400 font-medium border-t border-gray-700 mt-1 pt-1">
                            Transfer Ownership
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>

                    {isOwnerOrAdmin && (
                      <div className="relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setOpenDropdownId(openDropdownId === member.user?.id ? null : member.user?.id)}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-white"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>

                        {openDropdownId === member.user?.id && (
                          <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-50">
                            {isOwner && (
                              <button
                                onClick={() => showTransferModal(member.user?.id, member.user?.name || member.user?.email)}
                                disabled={transferring}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-yellow-400 hover:bg-gray-700 first:rounded-t-lg"
                              >
                                {transferring ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserCheck className="h-4 w-4" />
                                )}
                                Transfer Ownership
                              </button>
                            )}
                            <button
                              onClick={() => showRemoveModal(member.user?.id, member.user?.name || member.user?.email)}
                              disabled={removingId === member.user?.id}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-gray-700 last:rounded-b-lg"
                            >
                              {removingId === member.user?.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                              Remove Member
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

            {members.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Users className="mb-4 h-10 w-10 text-gray-500" />
                <p className="text-gray-400">No members yet</p>
                <p className="text-sm text-gray-500 mt-1">
                  {isOwnerOrAdmin ? 'Invite developers to collaborate' : 'Only owners and admins can add members'}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 flex gap-3">
        <Link href={`/dashboard/workspaces/${params.id}/settings`}>
          <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Workspace Settings
          </Button>
        </Link>
        <Link href={`/dashboard/workspaces/${params.id}`}>
          <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Back to Workspace
          </Button>
        </Link>
      </div>
    </div>
  );
}
