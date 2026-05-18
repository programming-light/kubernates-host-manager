'use client';

import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { canAccessPage } from '@/lib/workspace-permissions';
import { Folder, Server, Boxes, CreditCard, ArrowRight } from 'lucide-react';

interface QuickActionsProps {
  userRole: string;
}

export default function QuickActions({ userRole }: QuickActionsProps) {
  const quickActions = [
    canAccessPage(userRole, 'workspace:read') && { label: 'Create Workspace', href: '/dashboard/workspaces/new', icon: Folder },
    canAccessPage(userRole, 'clusters:read') && { label: 'Go to Kubernetes', href: '/dashboard/kubernetes', icon: Server },
    canAccessPage(userRole, 'projects:read') && { label: 'New Project', href: '/dashboard/projects/new', icon: Boxes },
    canAccessPage(userRole, 'billing:read') && { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      {quickActions.map((action: any) => (
        <Link key={action.href} href={action.href}>
          <Button
            variant="outline"
            className="w-full justify-between border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800 hover:text-white"
          >
            <span className="flex items-center gap-3">
              <action.icon className="h-4 w-4" />
              {action.label}
            </span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      ))}
      {quickActions.length === 0 && (
        <p className="text-sm text-gray-400 text-center py-4">No actions available</p>
      )}
    </div>
  );
}
