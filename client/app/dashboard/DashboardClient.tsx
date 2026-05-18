'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import { useWorkspaceStore, useProjectStore, useDeploymentStore } from '@/store';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Folder,
  Boxes,
  Rocket,
  Plus,
  Activity,
  Clock,
  TrendingUp,
  ArrowRight,
  Server,
  Users,
  Settings,
  CreditCard,
  DollarSign
} from 'lucide-react';
import { toast } from 'sonner';
import { User } from '@/lib/types';
import { canAccessPage } from '@/lib/workspace-permissions';

// Lazy load heavy components
const StatCard = lazy(() => import('@/components/dashboard/StatCard'));
const QuickActions = lazy(() => import('@/components/dashboard/QuickActions'));
const RecentWorkspaces = lazy(() => import('@/components/dashboard/RecentWorkspaces'));
const RecentProjects = lazy(() => import('@/components/dashboard/RecentProjects'));

const fetchWithTimeout = (url: string, timeoutMs = 10000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return api.get(url).finally(() => clearTimeout(timeout));
};

export default function DashboardClient({ user }: { user: User }) {
  const { workspaces, setWorkspaces } = useWorkspaceStore();
  const { projects, setProjects } = useProjectStore();
  const { deployments, setDeployments } = useDeploymentStore();
  const [loading, setLoading] = useState(true);
  const [k8sConnected, setK8sConnected] = useState(false);
  const [userRole, setUserRole] = useState<string>('DEVELOPER');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    const results = await Promise.allSettled([
      fetchWithTimeout('/workspaces').then(r => r.json()),
      fetchWithTimeout('/projects').then(r => r.json()),
      fetchWithTimeout('/deployments').then(r => r.json()),
      fetchWithTimeout('/kubernetes/status').then(r => r.json()),
    ]);

    const [wsResult, prResult, depResult, k8sResult] = results;

    if (wsResult.status === 'fulfilled') {
      const wsData = wsResult.value;
      setWorkspaces(Array.isArray(wsData) ? wsData : []);
      if (Array.isArray(wsData) && wsData.length > 0) {
        setUserRole(wsData[0].memberRole || 'DEVELOPER');
      }
    } else {
      toast.error('Failed to load workspaces');
      setWorkspaces([]);
    }

    if (prResult.status === 'fulfilled') {
      const prData = prResult.value;
      setProjects(Array.isArray(prData) ? prData : []);
    } else {
      toast.error('Failed to load projects');
      setProjects([]);
    }

    if (depResult.status === 'fulfilled') {
      const depData = depResult.value;
      setDeployments(Array.isArray(depData) ? depData : []);
    } else {
      toast.error('Failed to load deployments');
      setDeployments([]);
    }

    if (k8sResult.status === 'fulfilled') {
      const k8sData = k8sResult.value;
      setK8sConnected(k8sData.connected || false);
    } else {
      toast.error('Failed to check Kubernetes status');
      setK8sConnected(false);
    }

    if (wsResult.status !== 'fulfilled' && prResult.status !== 'fulfilled' && depResult.status !== 'fulfilled' && k8sResult.status !== 'fulfilled') {
      setUserRole('OWNER');
    }

    setLoading(false);
  };

  const totalProjects = projects.length;
  const totalDeployments = deployments.length;
  const totalWorkspaces = workspaces.length;

  const stats = [
    {
      label: 'Workspaces',
      value: totalWorkspaces,
      icon: Folder,
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400',
      href: canAccessPage(userRole, 'workspace:read') ? '/dashboard/workspaces' : null
    },
    {
      label: 'Kubernetes',
      value: k8sConnected ? 'Connected' : 'Disconnected',
      icon: Server,
      color: k8sConnected ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600',
      bgColor: k8sConnected ? 'bg-green-500/10' : 'bg-red-500/10',
      textColor: k8sConnected ? 'text-green-400' : 'text-red-400',
      href: canAccessPage(userRole, 'clusters:read') ? '/dashboard/kubernetes' : null
    },
    {
      label: 'Projects',
      value: totalProjects,
      icon: Boxes,
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400',
      href: canAccessPage(userRole, 'projects:read') ? '/dashboard/projects' : null
    },
    {
      label: 'Deployments',
      value: totalDeployments,
      icon: Rocket,
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-400',
      href: canAccessPage(userRole, 'deployments:read') ? '/dashboard/deployments' : null
    },
  ];

  if (loading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="flex items-center justify-between">
          <div>
            <div className="h-9 w-48 rounded bg-gray-800" />
            <div className="mt-2 h-5 w-64 rounded bg-gray-800" />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1,2,3,4].map(i => (
            <div key={i} className="h-32 rounded-lg bg-gray-900" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="h-48 rounded-lg bg-gray-900" />
          <div className="h-48 rounded-lg bg-gray-900" />
          <div className="h-48 rounded-lg bg-gray-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-gray-400">Welcome back, {user?.name || 'User'}!</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Activity className="h-4 w-4" />
          <span>All systems operational</span>
        </div>
      </div>

      <Suspense fallback={<div className="h-32 rounded-lg bg-gray-900/50" />}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <Suspense key={stat.label} fallback={<div className="h-32 rounded-lg bg-gray-900/50" />}>
              <StatCard stat={stat} index={index} />
            </Suspense>
          ))}
        </div>
      </Suspense>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Suspense fallback={<div className="h-48 rounded-lg bg-gray-900/50" />}>
          <QuickActions userRole={userRole} />
        </Suspense>

        <Suspense fallback={<div className="h-48 rounded-lg bg-gray-900/50" />}>
          <RecentWorkspaces workspaces={workspaces} />
        </Suspense>

        <Suspense fallback={<div className="h-48 rounded-lg bg-gray-900/50" />}>
          <RecentProjects projects={projects} />
        </Suspense>
      </div>
    </div>
  );
}
