'use client';

import { Check } from 'lucide-react';
import { Plan } from './pricing-page-content';

interface PlanComparisonTableProps {
  plans: Plan[];
}

export function PlanComparisonTable({ plans }: PlanComparisonTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full">
        <thead className="bg-muted">
          <tr>
            <th className="px-4 py-3 text-left font-semibold">Feature</th>
            {plans.map((plan) => (
              <th key={plan.id} className="px-4 py-3 text-center font-semibold">
                {plan.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {/* CPU */}
          <TableRow
            label="CPU Cores"
            plans={plans}
            getValue={(plan) => `${plan.cpuLimit}`}
          />

          {/* Memory */}
          <TableRow
            label="Memory"
            plans={plans}
            getValue={(plan) => `${plan.memoryLimitMb}MB`}
          />

          {/* Storage */}
          <TableRow
            label="Storage"
            plans={plans}
            getValue={(plan) => `${plan.storageLimitGb}GB`}
          />

          {/* Bandwidth */}
          <TableRow
            label="Bandwidth"
            plans={plans}
            getValue={(plan) => `${plan.bandwidthLimitGb}GB/mo`}
          />

          {/* Apps Limit */}
          <TableRow
            label="Max Apps"
            plans={plans}
            getValue={(plan) => `${plan.maxApps}`}
          />

          {/* Domains Limit */}
          <TableRow
            label="Max Domains"
            plans={plans}
            getValue={(plan) => `${plan.maxDomains}`}
          />

          {/* Autoscaling */}
          <FeatureRow
            label="Autoscaling"
            plans={plans}
            getValue={(plan) => plan.autoscalingEnabled}
          />

          {/* Backups */}
          <FeatureRow
            label="Automated Backups"
            plans={plans}
            getValue={(plan) => plan.backupEnabled}
          />

          {/* Database */}
          <FeatureRow
            label="Managed Database"
            plans={plans}
            getValue={(plan) => plan.databaseEnabled}
          />

          {/* Redis */}
          <FeatureRow
            label="Redis Cache"
            plans={plans}
            getValue={(plan) => plan.redisEnabled}
          />

          {/* Support */}
          <TableRow
            label="Support Level"
            plans={plans}
            getValue={(plan) => plan.supportLevel}
          />
        </tbody>
      </table>
    </div>
  );
}

function TableRow({
  label,
  plans,
  getValue,
}: {
  label: string;
  plans: Plan[];
  getValue: (plan: Plan) => string;
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-left font-medium text-muted-foreground">
        {label}
      </td>
      {plans.map((plan) => (
        <td key={plan.id} className="px-4 py-3 text-center">
          {getValue(plan)}
        </td>
      ))}
    </tr>
  );
}

function FeatureRow({
  label,
  plans,
  getValue,
}: {
  label: string;
  plans: Plan[];
  getValue: (plan: Plan) => boolean;
}) {
  return (
    <tr>
      <td className="px-4 py-3 text-left font-medium text-muted-foreground">
        {label}
      </td>
      {plans.map((plan) => (
        <td key={plan.id} className="px-4 py-3 text-center">
          {getValue(plan) ? (
            <Check className="w-5 h-5 text-green-600 mx-auto" />
          ) : (
            <span className="text-muted-foreground text-2xl">−</span>
          )}
        </td>
      ))}
    </tr>
  );
}
