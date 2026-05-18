"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Server, GitBranch, Activity, ArrowRight, Check, Cloud } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import CloudAnimation from '@/components/CloudAnimation';
import TechIcons3D from '@/components/TechIcons3D';
import CustomCursor from '@/components/CustomCursor';

export default function HomePage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 overflow-hidden cursor-none">
      <CustomCursor />
      {/* Navigation */}
      <nav className="fixed top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700"
            >
              <Server className="h-5 w-5 text-white" />
            </motion.div>
            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-lg font-bold text-white"
            >
              NyxTech
            </motion.span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-300 hover:text-white">
              Pricing
            </Link>
            <Link href="/services" className="text-sm text-gray-300 hover:text-white">
              Services
            </Link>
            <Link href="/contact" className="text-sm text-gray-300 hover:text-white">
              Contact
            </Link>
            <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'}>
              <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Sign In
              </Button>
            </Link>
            <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section with Fancy Animation */}
      <section className="relative flex min-h-screen items-center justify-center px-4 pt-16">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-900/30 via-gray-950 to-gray-950" />

        {/* Three.js Cloud Animation */}
        <CloudAnimation />
        
        {/* Floating orbs with mouse tracking */}
        <motion.div
          className="absolute h-96 w-96 rounded-full bg-blue-600/10 blur-3xl"
          animate={{
            x: mousePosition.x * 0.05,
            y: mousePosition.y * 0.05,
          }}
          transition={{ type: "spring", stiffness: 50, damping: 30 }}
        />
        <motion.div
          className="absolute right-0 top-0 h-96 w-96 rounded-full bg-purple-600/10 blur-3xl"
          animate={{
            x: mousePosition.x * -0.03,
            y: mousePosition.y * -0.03,
          }}
          transition={{ type: "spring", stiffness: 50, damping: 30 }}
        />

        {/* Animated particles/particles */}
        <div className="absolute inset-0 overflow-hidden">
          {[...Array(20)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute h-1 w-1 rounded-full bg-blue-400/30"
              initial={{
                x: Math.random() * window?.innerWidth || 1000,
                y: Math.random() * window?.innerHeight || 1000,
              }}
              animate={{
                y: [null, Math.random() * -1000 - 500],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: Math.random() * 10 + 10,
                repeat: Infinity,
                delay: Math.random() * 10,
              }}
              style={{
                left: `${Math.random() * 100}%`,
              }}
            />
          ))}
        </div>

        {/* Floating tech icons with Three.js */}
        <TechIcons3D />

        <div className="relative z-10 mx-auto max-w-4xl text-center">
          <motion.div
             initial={{ opacity: 0, y: 20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.3 }}
             className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-800/50 bg-blue-900/20 px-4 py-2 text-sm text-blue-400"
           >
             <Cloud className="h-4 w-4" />
             <span>Now with CI/CD Pipeline Integration</span>
           </motion.div>

          <motion.h1
             initial={{ opacity: 0, y: 30 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
             className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl"
           >
             Deploy instantly.
             <motion.span
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               transition={{ delay: 0.6 }}
               className="block bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent"
             >
               Control everything.
             </motion.span>
           </motion.h1>

           <motion.p
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ delay: 0.7 }}
             className="mx-auto mb-8 max-w-2xl text-lg text-gray-400"
           >
             The simplicity of Vercel for any Docker app. Push to deploy in seconds,
             with full infrastructure control in your hands.
           </motion.p>

          {/* Animated terminal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="mx-auto mb-8 max-w-2xl rounded-lg border border-gray-800 bg-gray-900/80 p-4 font-mono text-sm backdrop-blur"
          >
            <div className="mb-2 flex items-center gap-2">
               <div className="h-3 w-3 rounded-full bg-red-500" />
               <div className="h-3 w-3 rounded-full bg-yellow-500" />
               <div className="h-3 w-3 rounded-full bg-green-500" />
               <span className="ml-2 text-gray-500">deploy@nyxtech:~</span>
             </div>
             <div className="text-left space-y-1">
               <motion.p
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 1 }}
                 className="text-green-400"
               >
                 $ docker run -d -p 3000:3000 my-app
               </motion.p>
               <motion.p
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ delay: 1.3 }}
                 className="text-gray-400"
               >
                 <span className="text-blue-400">â</span> Container started: my-app
               </motion.p>
               <motion.p
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ delay: 1.6 }}
                 className="text-gray-400"
               >
                 <span className="text-blue-400">â</span> Health check passed
               </motion.p>
               <motion.p
                 initial={{ opacity: 0, x: -20 }}
                 animate={{ opacity: 1, x: 0 }}
                 transition={{ delay: 1.9 }}
                 className="text-green-400"
               >
                 $ curl http://my-app.nyxtech.app
               </motion.p>
               <motion.p
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 transition={{ delay: 2.2 }}
                 className="text-cyan-400"
               >
                  {'<h1>Hello from Docker!</h1>'}
               </motion.p>
             </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'}>
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 group">
                Start Deploying
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="ml-2"
                >
                  <ArrowRight className="h-4 w-4" />
                </motion.div>
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
                View Pricing
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Features Section - Static */}
      <section className="border-t border-gray-800 bg-gray-900/50 px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold text-white">Everything you need to deploy</h2>
            <p className="mt-4 text-gray-400">Built for modern development teams</p>
          </div>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
             {[
               {
                 icon: <Cloud className="h-6 w-6" />,
                 title: 'Docker Ready',
                 description: 'Any Docker-compatible app deploys instantly. Just push your container image.',
               },
               {
                 icon: <GitBranch className="h-6 w-6" />,
                 title: 'Git Integration',
                 description: 'Connect your repository and deploy automatically on every push.',
               },
               {
                 icon: <Activity className="h-6 w-6" />,
                 title: 'Real-Time Monitoring',
                 description: 'Monitor your containers with built-in metrics and logging.',
               },
               {
                 icon: <Server className="h-6 w-6" />,
                 title: 'Universal Hosting',
                 description: 'Web apps, APIs, databases, microservices - if it dockerizes, we host it.',
               },
             ].map((feature, i) => (
               <div key={i} className="rounded-xl border border-gray-800 bg-gray-900 p-6">
                 <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-600/10 text-blue-400">
                   {feature.icon}
                 </div>
                 <h3 className="mb-2 text-lg font-semibold text-white">{feature.title}</h3>
                 <p className="text-gray-400">{feature.description}</p>
               </div>
             ))}
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-gray-950 px-4 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Link href="/" className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
                  <Server className="h-5 w-5 text-white" />
                </div>
                <span className="text-lg font-bold text-white">NyxTech</span>
              </Link>
              <p className="mt-4 text-sm text-gray-400">
                Modern Kubernetes hosting platform for teams of all sizes.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Product</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="/services" className="hover:text-white">Services</Link></li>
                <li><Link href="/products" className="hover:text-white">Products</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Company</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><a href="#" className="hover:text-white">About</a></li>
                <li><a href="#" className="hover:text-white">Blog</a></li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-semibold text-white">Legal</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-gray-800 pt-8 text-center text-sm text-gray-500">
            © 2024 NyxTech. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
