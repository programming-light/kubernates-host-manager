'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';
import { ArrowRight, Server, Shield, Zap, Globe, Container, GitBranch } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  const features = [
    { icon: Container, title: 'Container Orchestration', description: 'Deploy and manage containers at scale with Kubernetes' },
    { icon: GitBranch, title: 'Git Integration', description: 'Automatic deployments from your Git repository' },
    { icon: Zap, title: 'Auto Scaling', description: 'Scale based on CPU, memory, or custom metrics' },
    { icon: Globe, title: 'Global CDN', description: 'Fast content delivery across the globe' },
    { icon: Shield, title: 'Enterprise Security', description: 'Built-in security with RBAC and secrets management' },
    { icon: Server, title: 'Multi-Cloud', description: 'Deploy across AWS, GCP, Azure, and more' },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-white">K8s Platform</span>
          </Link>
          <div className="flex gap-4">
            {isAuthenticated ? (
              <Link href="/dashboard">
                <Button className="bg-blue-600 hover:bg-blue-700">
                  Dashboard
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <>
                <Link href="/auth">
                  <Button variant="ghost" className="text-gray-300 hover:text-white">
                    Sign In
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button className="bg-blue-600 hover:bg-blue-700">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden px-6 py-32">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-1/2 -left-1/2 h-full w-full rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-1/2 -right-1/2 h-full w-full rounded-full bg-purple-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
              Deploy Your Apps on{' '}
              <span className="bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                Kubernetes
              </span>
            </h1>
            <p className="mt-6 text-xl text-gray-400">
              A modern platform for hosting containerized applications. 
              Deploy from Git, scale automatically, and manage with ease.
            </p>
            <div className="mt-10 flex justify-center gap-4">
              <Link href="/auth">
                <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/auth">
                <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white">
                  Sign In
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="border-t border-gray-800 bg-gray-900/30 px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <h3 className="text-center text-3xl font-bold text-white">Features</h3>
          <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                viewport={{ once: true }}
              >
                <div className="group rounded-xl border border-gray-800 bg-gray-900/50 p-6 transition-all duration-300 hover:border-gray-700 hover:bg-gray-900">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                    <feature.icon className="h-6 w-6 text-blue-400" />
                  </div>
                  <h4 className="text-lg font-semibold text-white">{feature.title}</h4>
                  <p className="mt-2 text-gray-400">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-gray-800 bg-gray-900/50 px-6 py-12">
        <div className="mx-auto max-w-6xl text-center">
          <p className="text-gray-500">&copy; 2025 K8s Platform. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
