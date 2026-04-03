'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function Home() {
  const { isAuthenticated } = useAuth();

  return (
    <main className="flex min-h-screen flex-col">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <h1 className="text-2xl font-bold text-blue-600">K8s Platform</h1>
          <div className="flex gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost">Sign In</Button>
                </Link>
                <Link href="/register">
                  <Button>Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="flex-1 bg-gradient-to-br from-blue-50 to-indigo-100 px-6 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-5xl font-bold tracking-tight text-gray-900">
            Deploy Your Applications on Kubernetes
          </h2>
          <p className="mt-6 text-xl text-gray-600">
            A modern, multi-tenant platform for hosting containerized applications. Deploy from Git, scale automatically, and manage everything from one dashboard.
          </p>
          <div className="mt-10 flex justify-center gap-4">
            {!isAuthenticated && (
              <>
                <Link href="/register">
                  <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                    Start Free Trial
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline">
                    Sign In
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h3 className="text-center text-3xl font-bold text-gray-900">Features</h3>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            <Card className="p-6">
              <h4 className="text-lg font-semibold">Git Integration</h4>
              <p className="mt-2 text-gray-600">
                Connect your GitHub repository and deploy automatically on every push
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="text-lg font-semibold">Auto Scaling</h4>
              <p className="mt-2 text-gray-600">
                Automatically scale your applications based on CPU and memory usage
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="text-lg font-semibold">Custom Domains</h4>
              <p className="mt-2 text-gray-600">
                Use your own domain with automatic SSL certificate provisioning
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="text-lg font-semibold">Real-time Logs</h4>
              <p className="mt-2 text-gray-600">
                Stream application logs in real-time to debug issues faster
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="text-lg font-semibold">Multi-tenant</h4>
              <p className="mt-2 text-gray-600">
                Manage multiple teams and projects with advanced RBAC controls
              </p>
            </Card>
            <Card className="p-6">
              <h4 className="text-lg font-semibold">Flexible Pricing</h4>
              <p className="mt-2 text-gray-600">
                Pay as you grow with transparent, predictable pricing
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 px-6 py-12">
        <div className="mx-auto max-w-6xl text-center text-gray-600">
          <p>&copy; 2024 K8s Platform. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}
