'use client';

import { Boxes, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Project {
  id: string;
  name: string;
  namespace?: string;
  status: string;
}

interface RecentProjectsProps {
  projects: Project[];
}

export default function RecentProjects({ projects }: RecentProjectsProps) {
  const getStatusColor = (status: string) => {
    if (status === 'active') return 'bg-green-500/10 text-green-400';
    if (status === 'error') return 'bg-red-500/10 text-red-400';
    return 'bg-gray-500/10 text-gray-400';
  };

  return (
    <div className="space-y-3">
      {projects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Boxes className="mb-3 h-8 w-8 text-gray-500" />
          <p className="text-sm text-gray-400">No projects yet</p>
          <Link href="/dashboard/projects/new">
            <Button className="mt-3" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Project
            </Button>
          </Link>
        </div>
      ) : (
        projects.slice(0, 4).map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}>
            <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                  <Boxes className="h-4 w-4 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{project.name}</p>
                  <p className="text-xs text-gray-500">{project.namespace || 'Default'}</p>
                </div>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(project.status)}`}>
                {project.status}
              </span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
