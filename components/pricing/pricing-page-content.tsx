'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlanCard } from './plan-card';
import { PricingToggle } from './pricing-toggle';
import { PlanComparisonTable } from './plan-comparison-table';

export interface Plan {
  id: string;
  name: string;
  slug: string;
  description?: string;
  monthlyPriceCents: number;
  yearlyPriceCents: number;
  cpuLimit: number;
  memoryLimitMb: number;
  storageLimitGb: number;
  bandwidthLimitGb: number;
  maxApps: number;
  maxDomains: number;
  autoscalingEnabled: boolean;
  backupEnabled: boolean;
  databaseEnabled: boolean;
  redisEnabled: boolean;
  supportLevel: string;
  trialDays: number;
  isPublic: boolean;
  isDefault: boolean;
  sortOrder: number;
  icon?: string;
  color?: string;
  features: string[];
  overages: Array<{ overage: string; pricePerUnit: number }>;
  createdAt: Date;
  updatedAt: Date;
}

interface PricingPageContentProps {
  plans: Plan[];
}

export function PricingPageContent({ plans }: PricingPageContentProps) {
  const [isYearly, setIsYearly] = useState(false);

  const sortedPlans = [...plans].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-16 py-12 md:py-20">
      {/* Header */}
      <div className="text-center space-y-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-balance">
          Simple, Transparent Pricing
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-pretty">
          Pay only for what you use. Scale your applications on Kubernetes with flexible pricing.
        </p>
      </div>

      {/* Billing Toggle */}
      <div className="flex justify-center">
        <PricingToggle isYearly={isYearly} onToggle={setIsYearly} />
      </div>

      {/* Plans Grid */}
      <div className="grid md:grid-cols-3 gap-8 max-w-7xl mx-auto px-4">
        {sortedPlans.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <p className="text-muted-foreground">No plans available</p>
          </div>
        ) : (
          sortedPlans.map((plan) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isYearly={isYearly}
              isDefault={plan.isDefault}
            />
          ))
        )}
      </div>

      {/* Comparison Table */}
      {sortedPlans.length > 0 && (
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl md:text-3xl font-bold mb-8 text-center">
            Compare Plans
          </h2>
          <PlanComparisonTable plans={sortedPlans} />
        </div>
      )}

      {/* FAQ or CTA */}
      <div className="text-center space-y-6 max-w-2xl mx-auto px-4">
        <h2 className="text-2xl md:text-3xl font-bold">
          Questions about plans?
        </h2>
        <p className="text-lg text-muted-foreground">
          Contact our sales team for custom enterprise solutions.
        </p>
        <Button size="lg" variant="outline">
          Talk to Sales
        </Button>
      </div>
    </div>
  );
}
