'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, useWorkspaceStore, useProjectStore, useDeploymentStore } from '@/store';
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
  Cloud
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const { workspaces, setWorkspaces } = useWorkspaceStore();
  const { projects, setProjects } = useProjectStore();
  const { deployments, setDeployments } = useDeploymentStore();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [k8sConnected, setK8sConnected] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [wsRes, prRes, depRes, k8sRes] = await Promise.all([
        api.get('/workspaces'),
        api.get('/projects'),
        api.get('/deployments'),
        api.get('/kubernetes/status'),
      ]);
      
      const wsData = await wsRes.json();
      const prData = await prRes.json();
      const depData = await depRes.json();
      const k8sData = await k8sRes.json();
      
      setWorkspaces(Array.isArray(wsData) ? wsData : []);
      setProjects(Array.isArray(prData) ? prData : []);
      setDeployments(Array.isArray(depData) ? depData : []);
      setK8sConnected(k8sData.connected || false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    { 
      label: 'Workspaces', 
      value: workspaces.length, 
      icon: Folder, 
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/10',
      textColor: 'text-blue-400'
    },
    { 
      label: 'Kubernetes', 
      value: k8sConnected ? 'Connected' : 'Disconnected', 
      icon: Cloud, 
      color: k8sConnected ? 'from-green-500 to-green-600' : 'from-red-500 to-red-600',
      bgColor: k8sConnected ? 'bg-green-500/10' : 'bg-red-500/10',
      textColor: k8sConnected ? 'text-green-400' : 'text-red-400'
    },
    { 
      label: 'Projects', 
      value: projects.length, 
      icon: Boxes, 
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/10',
      textColor: 'text-green-400'
    },
    { 
      label: 'Deployments', 
      value: deployments.length, 
      icon: Rocket, 
      color: 'from-orange-500 to-orange-600',
      bgColor: 'bg-orange-500/10',
      textColor: 'text-orange-400'
    },
  ];

  const quickActions = [
    { label: 'Create Workspace', href: '/dashboard/workspaces/new', icon: Folder },
    { label: 'Go to Kubernetes', href: '/dashboard/kubernetes', icon: Cloud },
    { label: 'New Project', href: '/dashboard/projects/new', icon: Boxes },
  ];

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-gray-400">Loading dashboard...</p>
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

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => (
          <Card 
            key={stat.label} 
            className="group relative overflow-hidden border-gray-800 bg-gray-900/50 transition-all duration-300 hover:border-gray-700 hover:shadow-lg hover:shadow-black/20"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className={`absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100 ${stat.bgColor}`} />
            <CardContent className="relative p-6">
              <div className="flex items-center justify-between">
                <div className={`rounded-xl ${stat.bgColor} p-3`}>
                  <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
                </div>
                <TrendingUp className="h-5 w-5 text-gray-600 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
              </div>
              <div className="mt-4">
                <p className="text-4xl font-bold text-white">{stat.value}</p>
                <p className="mt-1 text-sm text-gray-400">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-white">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {quickActions.map((action) => (
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
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold text-white">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {workspaces.length === 0 && projects.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="mb-4 rounded-full bg-gray-800 p-4">
                    <Rocket className="h-8 w-8 text-gray-500" />
                  </div>
                  <p className="text-gray-400">No activity yet</p>
                  <p className="text-sm text-gray-500">Get started by creating your first workspace</p>
                  <Link href="/dashboard/workspaces/new">
                    <Button className="mt-4" size="sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Workspace
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  {workspaces.slice(0, 2).map((ws) => (
                    <div key={ws.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                        <Folder className="h-4 w-4 text-blue-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{ws.name}</p>
                        <p className="text-xs text-gray-500">Workspace created</p>
                      </div>
                      <Clock className="h-4 w-4 text-gray-500" />
                    </div>
                  ))}
                  {projects.slice(0, 2).map((project) => (
                    <div key={project.id} className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10">
                        <Boxes className="h-4 w-4 text-green-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-white">{project.name}</p>
                        <p className="text-xs text-gray-500">Project created</p>
                      </div>
                      <Clock className="h-4 w-4 text-gray-500" />
                    </div>
                  ))}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}