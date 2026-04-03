'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { Plan } from './pricing-page-content';

interface PlanCardProps {
  plan: Plan;
  isYearly: boolean;
  isDefault?: boolean;
}

export function PlanCard({ plan, isYearly, isDefault }: PlanCardProps) {
  const priceCents = isYearly ? plan.yearlyPriceCents : plan.monthlyPriceCents;
  const price = (priceCents / 100).toFixed(2);
  const billingPeriod = isYearly ? 'year' : 'month';
  const savings = isYearly && plan.yearlyPriceCents > 0
    ? Math.round(((plan.monthlyPriceCents * 12 - plan.yearlyPriceCents) / (plan.monthlyPriceCents * 12)) * 100)
    : 0;

  return (
    <div
      className={`relative rounded-lg border transition-all ${
        isDefault
          ? 'border-primary shadow-lg scale-105'
          : 'border-border hover:border-primary/50'
      }`}
    >
      {/* Recommended Badge */}
      {isDefault && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground">
            Recommended
          </Badge>
        </div>
      )}

      <div className="p-8 space-y-8">
        {/* Plan Header */}
        <div>
          <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
          {plan.description && (
            <p className="text-sm text-muted-foreground">{plan.description}</p>
          )}
        </div>

        {/* Pricing */}
        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">${price}</span>
            <span className="text-muted-foreground">per {billingPeriod}</span>
          </div>
          {savings > 0 && (
            <p className="text-sm text-green-600">
              Save {savings}% with yearly billing
            </p>
          )}
        </div>

        {/* CTA Button */}
        <Button
          className="w-full"
          variant={isDefault ? 'default' : 'outline'}
          size="lg"
        >
          Get Started
        </Button>

        {/* Trial Info */}
        {plan.trialDays > 0 && (
          <p className="text-sm text-center text-muted-foreground">
            {plan.trialDays}-day free trial. No credit card required.
          </p>
        )}

        {/* Divider */}
        <div className="border-t pt-8" />

        {/* Resources */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-3">
              Resources
            </p>
            <div className="space-y-3">
              <ResourceItem
                label="CPU"
                value={`${plan.cpuLimit} cores`}
              />
              <ResourceItem
                label="Memory"
                value={`${plan.memoryLimitMb}MB`}
              />
              <ResourceItem
                label="Storage"
                value={`${plan.storageLimitGb}GB`}
              />
              <ResourceItem
                label="Bandwidth"
                value={`${plan.bandwidthLimitGb}GB/mo`}
              />
            </div>
          </div>
        </div>

        {/* Limits */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-3">
              Limits
            </p>
            <div className="space-y-3">
              <LimitItem label="Apps" value={plan.maxApps} />
              <LimitItem label="Domains" value={plan.maxDomains} />
            </div>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground mb-3">
              Features
            </p>
            <div className="space-y-3">
              <FeatureItem
                label="Autoscaling"
                included={plan.autoscalingEnabled}
              />
              <FeatureItem
                label="Backups"
                included={plan.backupEnabled}
              />
              <FeatureItem
                label="Database"
                included={plan.databaseEnabled}
              />
              <FeatureItem
                label="Redis"
                included={plan.redisEnabled}
              />
              {plan.features.map((feature) => (
                <FeatureItem
                  key={feature}
                  label={feature}
                  included={true}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Support */}
        <div className="border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Support: <span className="font-semibold">{plan.supportLevel}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function ResourceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function LimitItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">Up to {value}</span>
    </div>
  );
}

function FeatureItem({ label, included }: { label: string; included: boolean }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      {included ? (
        <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
      ) : (
        <div className="w-4 h-4 border border-border rounded flex-shrink-0" />
      )}
      <span className={included ? 'text-foreground' : 'text-muted-foreground line-through'}>
        {label}
      </span>
    </div>
  );
}
