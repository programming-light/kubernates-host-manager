import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Rocket, Activity, GitBranch, HardDrive, Shield, Globe, Server, ArrowRight } from 'lucide-react';
import { fetchServices } from '@/lib/api';

export const revalidate = 86400; // ISR: Revalidate every 24 hours (services don't change often)

export default async function ServicesPage() {
  const services = await fetchServices();

  const iconMap: Record<string, any> = {
    Rocket,
    Activity,
    GitBranch,
    HardDrive,
    Shield,
    Globe,
  };

  return (
    <div className="min-h-screen bg-gray-950">
      <nav className="fixed top-0 z-50 w-full border-b border-gray-800 bg-gray-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-blue-700">
              <Server className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white">NyxTech</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-300 hover:text-white">Pricing</Link>
            <Link href="/contact" className="text-sm text-gray-300 hover:text-white">Contact</Link>
            <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'}>
              <Button className="bg-blue-600 hover:bg-blue-700">Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-4 pt-32 pb-24 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-white sm:text-5xl">
            Our Services
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Comprehensive Kubernetes hosting solutions for modern applications
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {services.map((service) => {
            const IconComponent = iconMap[service.icon] || Server;
            return (
              <div
                key={service.id}
                className="rounded-2xl border border-gray-800 bg-gray-900/50 p-8 transition-all hover:border-gray-700"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-blue-600/10 text-blue-400">
                  <IconComponent className="h-7 w-7" />
                </div>
                <h3 className="mb-3 text-2xl font-bold text-white">{service.title}</h3>
                <p className="mb-6 text-gray-400">{service.description}</p>
                <ul className="space-y-2">
                  {service.features.map((feature: string, i: number) => (
                    <li key={i} className="flex items-center gap-2 text-gray-300">
                      <div className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <div className="mt-16 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 p-8 text-center sm:p-12">
          <h2 className="text-3xl font-bold text-white">Ready to get started?</h2>
          <p className="mt-4 text-lg text-blue-100">
            Deploy your first application in minutes.
          </p>
            <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'} className="mt-8 inline-block">
            <Button size="lg" variant="secondary" className="bg-white text-blue-600 hover:bg-blue-50">
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
