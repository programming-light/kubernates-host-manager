import type { Metadata } from 'next';
import { PricingClient } from './PricingClient';

export const dynamic = 'force-static';
export const revalidate = 3600;

export const metadata: Metadata = {
  title: 'Pricing - K8s Platform',
  description: 'Choose the perfect plan for your Kubernetes hosting needs',
};

async function getPlans() {
  const baseURL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + '/api/v1';
  try {
    const response = await fetch(`${baseURL}/plans`, {
      cache: 'force-cache',
      next: { revalidate: 3600 },
    });
    if (!response.ok) return [];
    return response.json();
  } catch {
    return [];
  }
}

export default async function PricingPage() {
  const plans = await getPlans();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Pricing Plans</h1>
        <p className="mt-2 text-gray-400">Choose the perfect plan for your Kubernetes hosting needs</p>
      </div>

      <PricingClient plans={plans} />
    </div>
  );
}