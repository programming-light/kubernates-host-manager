'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { Project } from '@/lib/types';
import { Loader2, Server } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import ProjectCards from '@/components/projects/ProjectCards';
import { useDeleteProject } from '@/lib/queries';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

export default function ProjectsPage() {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const { data: projects = [], isLoading, isError, error, refetch } = useQuery({
    queryKey: ['projects', 'list'],
    queryFn: () => apiClient.get<Project[]>('/projects'),
  });

  const { data: k8sStatus } = useQuery({
    queryKey: ['kubernetes', 'status'],
    queryFn: () => apiClient.get<{ connected: boolean }>('/kubernetes/status'),
  });

  const deleteMutation = useDeleteProject();

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(id);
  };

  const confirmDeleteProject = async () => {
    if (!confirmDelete) return;
    try {
      await deleteMutation.mutateAsync(confirmDelete);
      toast.success('Project deleted');
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete project');
    }
  };

  return (
    <>
      <ProjectCards 
        projects={projects}
        loading={isLoading}
        k8sConnected={k8sStatus?.connected || false}
        onDelete={handleDelete}
        isError={isError}
        error={error}
        refetch={refetch}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete Project"
        message="Are you sure you want to delete this project? This cannot be undone."
        onConfirm={confirmDeleteProject}
      />
    </>
  );
}