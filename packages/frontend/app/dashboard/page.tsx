'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import apiClient from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';

interface Project {
  id: string;
  name: string;
  slug: string;
  status: string;
  deployments?: Array<{ status: string }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState({ projects: 0, deployments: 0, clusters: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, authLoading, router]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated]);

  const fetchDashboardData = async () => {
    try {
      const [projectsRes] = await Promise.all([
        apiClient.get('/projects'),
      ]);
      setProjects(projectsRes.data);
      setStats({
        projects: projectsRes.data.length,
        deployments: projectsRes.data.reduce((sum: number, p: Project) => sum + (p.deployments?.length || 0), 0),
        clusters: 1, // Placeholder
      });
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-blue-600">K8s Platform</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-700">{user?.email}</span>
            <Button variant="outline" onClick={logout}>
              Sign Out
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="mx-auto max-w-7xl px-6 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-3xl font-bold text-gray-900">Welcome, {user?.name}</h2>
          <p className="mt-2 text-gray-600">Here's an overview of your account</p>
        </div>

        {/* Stats */}
        <div className="mb-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-600">Projects</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.projects}</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-600">Deployments</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.deployments}</p>
          </Card>
          <Card className="p-6">
            <h3 className="text-sm font-medium text-gray-600">Clusters</h3>
            <p className="mt-2 text-3xl font-bold text-gray-900">{stats.clusters}</p>
          </Card>
        </div>

        {/* Projects Section */}
        <div>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">Projects</h3>
            <Link href="/projects/new">
              <Button className="bg-blue-600 hover:bg-blue-700">New Project</Button>
            </Link>
          </div>

          {projects.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-gray-600">No projects yet</p>
              <Link href="/projects/new">
                <Button className="mt-4">Create Your First Project</Button>
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card key={project.id} className="p-6">
                  <Link href={`/projects/${project.id}`}>
                    <h4 className="font-semibold text-gray-900 hover:text-blue-600">{project.name}</h4>
                  </Link>
                  <p className="mt-2 text-sm text-gray-600">{project.slug}</p>
                  <div className="mt-4">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${
                        project.status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {project.status}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Quick Links */}
        <div className="mt-12">
          <h3 className="mb-6 text-xl font-bold text-gray-900">Quick Links</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Link href="/projects" className="block">
              <Card className="p-6 hover:shadow-lg">
                <p className="font-semibold text-gray-900">View All Projects</p>
              </Card>
            </Link>
            <Link href="/billing" className="block">
              <Card className="p-6 hover:shadow-lg">
                <p className="font-semibold text-gray-900">Billing & Plans</p>
              </Card>
            </Link>
            <Link href="/settings" className="block">
              <Card className="p-6 hover:shadow-lg">
                <p className="font-semibold text-gray-900">Account Settings</p>
              </Card>
            </Link>
            <a href="https://docs.k8s-platform.local" className="block">
              <Card className="p-6 hover:shadow-lg">
                <p className="font-semibold text-gray-900">Documentation</p>
              </Card>
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
