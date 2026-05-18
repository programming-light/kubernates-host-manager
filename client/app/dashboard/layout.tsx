'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { SocketProvider } from '@/lib/socket-context';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Server,
  Rocket,
  Settings,
  LogOut,
  Menu,
  X,
  Boxes,
  CreditCard,
  ChevronLeft,
  DollarSign,
  FolderIcon,
  Database
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { canAccessPage } from '@/lib/workspace-permissions';

const allNavItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'workspace:read' },
  { href: '/dashboard/workspaces', label: 'Workspaces', icon:   FolderIcon, permission: 'workspace:read' },
  { href: '/dashboard/projects', label: 'Projects', icon: Boxes, permission: 'projects:read' },
  { href: '/dashboard/deployments', label: 'Deployments', icon: Rocket, permission: 'deployments:read' },
  { href: '/dashboard/kubernetes', label: 'Kubernetes', icon: Server, permission: 'clusters:read' },
  { href: '/dashboard/databases', label: 'Databases', icon: Database, permission: 'projects:read' },
  { href: '/dashboard/pricing', label: 'Pricing', icon: DollarSign, permission: 'workspace:read' },
  { href: '/dashboard/billing', label: 'Billing', icon: CreditCard, permission: 'billing:read' },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings, permission: 'settings:read' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading: authLoading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userRole, setUserRole] = useState<string>('DEVELOPER');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/auth?redirect=/dashboard');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchUserRole = async () => {
      try {
        const workspacesRes = await fetch('/api/v1/workspaces', {
          credentials: 'include',
        });

        if (workspacesRes.ok) {
          const workspaces = await workspacesRes.json();
          if (workspaces.length > 0) {
            setUserRole(workspaces[0].memberRole || 'DEVELOPER');
          } else {
            setUserRole('OWNER');
          }
        }
      } catch (err) {
        console.warn('[DashboardLayout] fetchUserRole failed, falling back to DEVELOPER:', err);
        setUserRole('DEVELOPER');
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, [user]);

  useEffect(() => {
    if (loading || !user) return;

    const navItem = allNavItems.find((item) => item.href === pathname || pathname?.startsWith(item.href + '/'));
    if (navItem && !canAccessPage(userRole, navItem.permission)) {
      router.push('/dashboard');
    }
  }, [pathname, userRole, loading, router]);

  if (authLoading || (!user && loading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const navItems = allNavItems.filter((item) => canAccessPage(userRole, item.permission));

  return (
    <div className="flex min-h-screen bg-gray-950">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-gray-800 bg-gray-900 transition-all duration-300 lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-gray-800 px-4">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
                <Server className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">K8s</span>
            </Link>
          )}
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden"
          >
            <X className="h-5 w-5 text-gray-400" />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="hidden lg:block"
          >
            <ChevronLeft className={cn("h-5 w-5 text-gray-400 hover:text-white transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-blue-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white",
                  collapsed && "justify-center px-2"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon
                  className={cn(
                    "h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    isActive ? "text-white" : "text-gray-500 group-hover:text-white"
                  )}
                />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-gray-800 p-4">
          <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-medium text-white">
              {user.name?.[0] || user.email?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-white">
                  {user.name || 'User'}
                </p>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
                <p className="truncate text-xs text-blue-400">{userRole}</p>
              </div>
            )}
          </div>
          {!collapsed && (
            <Button
              variant="ghost"
              onClick={logout}
              className="mt-3 w-full justify-start text-gray-400 hover:bg-gray-800 hover:text-white"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          )}
        </div>
      </aside>

      <div className={cn("flex-1 transition-all duration-300", collapsed ? "lg:ml-16" : "lg:ml-64")}>
        <header className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-gray-800 bg-gray-900/50 px-4 backdrop-blur-xl lg:px-6">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden"
          >
            <Menu className="h-6 w-6 text-gray-400" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-gray-400 sm:block">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </span>
          </div>
        </header>

        <main className="p-4 lg:p-6">
          <SocketProvider>
            {children}
          </SocketProvider>
        </main>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
