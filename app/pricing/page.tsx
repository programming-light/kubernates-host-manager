import { Metadata } from 'next';
import { PricingPageContent } from '@/components/pricing/pricing-page-content';

// ISR: Revalidate every 5 minutes
export const revalidate = 300;

export const metadata: Metadata = {
  title: 'Pricing Plans | Hosting Platform',
  description: 'Choose the perfect plan for your Kubernetes hosting needs. Flexible pricing with scalable resources.',
  openGraph: {
    title: 'Pricing Plans | Hosting Platform',
    description: 'Choose the perfect plan for your Kubernetes hosting needs.',
    type: 'website',
  },
};

/**
 * Pricing Page with Static Site Generation (ISR)
 * 
 * How it works:
 * 1. Page is generated at build time with current pricing
 * 2. Served as static HTML for fast loads and SEO
 * 3. Revalidates every 300 seconds (5 minutes)
 * 4. When admin updates pricing, the page automatically refreshes after next request
 * 5. Uses Incremental Static Regeneration (ISR) for performance + freshness
 */
export default async function PricingPage() {
  // Fetch plans at build time
  const plans = await fetchPlans();

  return (
    <main className="min-h-screen bg-background">
      <PricingPageContent plans={plans} />
    </main>
  );
}

async function fetchPlans() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

  try {
    const response = await fetch(`${apiUrl}/billing/plans/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache for the duration of ISR revalidation
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error(`Failed to fetch plans: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return data.plans || [];
  } catch (error) {
    console.error('Error fetching pricing plans:', error);
    return [];
  }
}
