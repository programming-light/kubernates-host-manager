'use client';

import { Folder, Plus } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface Workspace {
  id: string;
  name: string;
  slug: string;
  memberRole?: string;
}

interface RecentWorkspacesProps {
  workspaces: Workspace[];
}

export default function RecentWorkspaces({ workspaces }: RecentWorkspacesProps) {
  return (
    <div className="space-y-3">
      {workspaces.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Folder className="mb-3 h-8 w-8 text-gray-500" />
          <p className="text-sm text-gray-400">No workspaces yet</p>
          <Link href="/dashboard/workspaces/new">
            <Button className="mt-3" size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Create Workspace
            </Button>
          </Link>
        </div>
      ) : (
        workspaces.slice(0, 4).map((ws) => (
          <Link key={ws.id} href={`/dashboard/workspaces/${ws.id}`}>
            <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-3 hover:bg-gray-800/50 cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Folder className="h-4 w-4 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{ws.name}</p>
                  <p className="text-xs text-gray-500">/{ws.slug}</p>
                </div>
              </div>
              <span className="text-xs text-blue-400">{ws.memberRole || 'Member'}</span>
            </div>
          </Link>
        ))
      )}
    </div>
  );
}
