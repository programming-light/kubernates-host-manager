'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string | null>(null);

  useEffect(() => {
    const initDashboard = async () => {
      try {
        const accessToken = localStorage.getItem('accessToken');
        if (!accessToken) {
          router.push('/login');
          return;
        }

        // Fetch user profile
        const profileRes = await apiClient.get('/auth/profile');
        setUser(profileRes.data);

        // Fetch workspaces
        const workspacesRes = await apiClient.get('/auth/workspaces');
        setWorkspaces(workspacesRes.data);

        // Set first workspace as default
        if (workspacesRes.data.length > 0) {
          setSelectedWorkspace(workspacesRes.data[0].id);
        }
      } catch (error) {
        console.error('Failed to load dashboard', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    initDashboard();
  }, [router]);

  const handleLogout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      await apiClient.post('/auth/logout', { refreshToken });
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      router.push('/login');
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 p-6">
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">K8s Platform</h1>
            <p className="text-xs text-slate-600 mt-1">Multi-tenant Hosting</p>
          </div>

          {/* User Info */}
          {user && (
            <div className="mb-8 p-4 bg-slate-50 rounded-lg">
              <p className="text-sm font-semibold text-slate-900">{user.name}</p>
              <p className="text-xs text-slate-600">{user.email}</p>
              <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                {user.globalRole}
              </span>
            </div>
          )}

          {/* Workspaces */}
          <div className="mb-8">
            <h2 className="text-xs font-semibold text-slate-700 uppercase mb-3">Workspaces</h2>
            <div className="space-y-2">
              {workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  onClick={() => setSelectedWorkspace(workspace.id)}
                  className={`w-full text-left px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedWorkspace === workspace.id
                      ? 'bg-blue-100 text-blue-700'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <span className="block truncate">{workspace.name}</span>
                  <span className="text-xs text-slate-600">{workspace.memberCount} members</span>
                </button>
              ))}
            </div>
            <Link href="/dashboard/workspace/create">
              <Button className="w-full mt-4 bg-slate-200 text-slate-900 hover:bg-slate-300">
                + New Workspace
              </Button>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1">
            <Link href="/dashboard" className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100">
              Dashboard
            </Link>
            {selectedWorkspace && (
              <>
                <Link
                  href={`/dashboard/workspace/${selectedWorkspace}`}
                  className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Projects
                </Link>
                <Link
                  href={`/dashboard/workspace/${selectedWorkspace}/settings`}
                  className="block px-4 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100"
                >
                  Settings
                </Link>
              </>
            )}
          </nav>

          {/* User Menu */}
          <div className="pt-6 border-t border-slate-200 space-y-2">
            <Link href="/dashboard/profile">
              <Button className="w-full justify-start bg-slate-100 text-slate-900 hover:bg-slate-200">
                Profile Settings
              </Button>
            </Link>
            <Button
              onClick={handleLogout}
              className="w-full justify-start bg-red-100 text-red-900 hover:bg-red-200"
            >
              Logout
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
