import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Check, X, Zap, Rocket, Server } from 'lucide-react';
import { fetchPricingPlans } from '@/lib/api';

export const revalidate = 3600; // ISR: Revalidate every hour

export default async function PricingPage() {
  const plans = await fetchPricingPlans();

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
            <Link href="/services" className="text-sm text-gray-300 hover:text-white">Services</Link>
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
            Simple, Transparent Pricing
          </h1>
          <p className="mt-4 text-lg text-gray-400">
            Choose the plan that fits your needs. All plans include core Kubernetes features.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`relative rounded-2xl border p-8 ${
                plan.name === 'Pro'
                  ? 'border-blue-500 bg-blue-950/20'
                  : 'border-gray-800 bg-gray-900/50'
              }`}
            >
              {plan.name === 'Pro' && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-sm font-medium text-white">
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-white">{plan.name}</h3>
                <p className="mt-2 text-sm text-gray-400">
                  {plan.maxProjects === -1 ? 'Unlimited' : plan.maxProjects} Projects
                </p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold text-white">${plan.price}</span>
                <span className="text-gray-400">/{plan.billing}</span>
              </div>
              <ul className="mb-8 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-gray-300">
                    <Check className="h-5 w-5 text-green-400" />
                    {feature}
                  </li>
                ))}
                <li className="flex items-center gap-3 text-gray-400">
                  <Zap className="h-5 w-5 text-yellow-400" />
                  {plan.cpu} CPU, {plan.memory} Memory
                </li>
              </ul>
              <Link href={process.env.NEXT_PUBLIC_CLIENT_URL ? `${process.env.NEXT_PUBLIC_CLIENT_URL}/dashboard` : 'http://localhost:3000/dashboard'} className="block">
                <Button
                  className={`w-full ${
                    plan.name === 'Pro'
                      ? 'bg-blue-600 hover:bg-blue-700'
                      : 'bg-gray-800 hover:bg-gray-700'
                  }`}
                >
                  Get Started
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
