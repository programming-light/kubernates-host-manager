'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Workspace } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Link from 'next/link';
import { Plus, Folder, MoreVertical, Trash2, Edit, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const fetchWorkspaces = async () => {
    try {
      const response = await api.get('/workspaces');
      const data = await response.json();
      setWorkspaces(Array.isArray(data) ? data : []);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const deleteWorkspace = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workspace?')) return;
    
    try {
      await api.delete(`/workspaces/${id}`);
      setWorkspaces(workspaces.filter(ws => ws.id !== id));
      toast.success('Workspace deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete workspace');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Workspaces</h1>
          <p className="mt-1 text-gray-400">Manage your workspaces</p>
        </div>
        <Link href="/dashboard/workspaces/new">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <Plus className="mr-2 h-4 w-4" />
            Create Workspace
          </Button>
        </Link>
      </div>

      {workspaces.length === 0 ? (
        <Card className="border-gray-800 bg-gray-900/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="mb-4 rounded-full bg-gray-800 p-4">
              <Folder className="h-8 w-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-semibold text-white">No workspaces yet</h3>
            <p className="mt-1 text-sm text-gray-400">Create your first workspace to get started</p>
            <Link href="/dashboard/workspaces/new">
              <Button className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Create Workspace
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace, index) => (
            <Card 
              key={workspace.id}
              className="group relative overflow-hidden border-gray-800 bg-gray-900/50 transition-all duration-300 hover:border-gray-700 hover:shadow-lg hover:shadow-black/20"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700">
                      <Folder className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg text-white">{workspace.name}</CardTitle>
                      <CardDescription className="text-xs text-gray-500">/{workspace.slug}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-gray-400 hover:text-white"
                      onClick={() => deleteWorkspace(workspace.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-400">
                  {workspace.description || 'No description'}
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  Created {new Date(workspace.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
