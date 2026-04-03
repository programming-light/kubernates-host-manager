'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { usePlans } from '@/hooks/use-plans';
import { PlansList } from '@/components/admin/billing/plans-list';
import { CreatePlanDialog } from '@/components/admin/billing/create-plan-dialog';

/**
 * Admin Plan Management Page
 * 
 * Features:
 * - View all plans (public and private)
 * - Create new plans
 * - Edit existing plans
 * - Delete plans (if not in use)
 * - Manage features and overages
 * - Control visibility and ordering
 */
export default function AdminPlansPage() {
  const { plans, isLoading, mutate } = usePlans();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing Plans</h1>
          <p className="text-muted-foreground mt-2">
            Manage your hosting plans, pricing, and features
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="gap-2"
        >
          <Plus className="w-4 h-4" />
          New Plan
        </Button>
      </div>

      {/* Plans List */}
      <PlansList plans={plans} isLoading={isLoading} onMutate={mutate} />

      {/* Create Dialog */}
      <CreatePlanDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          mutate();
          setIsCreateDialogOpen(false);
        }}
      />
    </div>
  );
}
