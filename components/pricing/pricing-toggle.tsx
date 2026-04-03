'use client';

import { ButtonGroup } from '@/components/ui/button-group';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface PricingToggleProps {
  isYearly: boolean;
  onToggle: (isYearly: boolean) => void;
}

export function PricingToggle({ isYearly, onToggle }: PricingToggleProps) {
  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative inline-flex items-center bg-muted rounded-lg p-1">
        <Button
          variant={!isYearly ? 'default' : 'ghost'}
          size="sm"
          className="rounded-md"
          onClick={() => onToggle(false)}
        >
          Monthly
        </Button>
        <Button
          variant={isYearly ? 'default' : 'ghost'}
          size="sm"
          className="rounded-md"
          onClick={() => onToggle(true)}
        >
          Yearly
        </Button>
      </div>
      {isYearly && (
        <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
          Save 20% per year
        </Badge>
      )}
    </div>
  );
}
