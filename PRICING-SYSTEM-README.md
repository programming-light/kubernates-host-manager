# Pricing System Architecture

A comprehensive, production-ready pricing engine for multi-tenant Kubernetes hosting platform with SSG pricing page, decoupled plan validation, and flexible billing support.

## Overview

This pricing system manages hosting plans, subscriptions, and plan enforcement across the platform. It's designed with these principles:

1. **Decoupled Architecture** - PlanLimitService separates billing logic from deployments
2. **Static Site Generation** - Pricing page uses Next.js ISR for performance + freshness
3. **Flexible Pricing** - Support for resource limits, feature flags, and overage rules
4. **Multi-tenant Safe** - Workspace-scoped plan enforcement
5. **Future-Ready** - Easy integration with Stripe or other billing providers

## Key Components

### Backend

#### Database Models (Prisma)

```
Plan
├── PlanFeature (features included in plan)
├── OverageRule (pricing for overages)
└── Subscription (workspace subscription)
    └── Linked to current Plan

PlanAuditLog (tracks all plan changes)
```

#### Services

**PlanService** - CRUD operations for plans
- `createPlan()` - Create new plan (admin)
- `updatePlan()` - Update plan (admin)
- `deletePlan()` - Delete plan if not in use (admin)
- `getPublicPlans()` - Plans for pricing page
- `getDefaultPlan()` - Plan for new workspaces

**SubscriptionService** - Subscription management
- `subscribeToPlan()` - Subscribe workspace to plan
- `getWorkspaceSubscription()` - Get current subscription
- `changeSubscriptionPlan()` - Upgrade/downgrade
- `cancelSubscription()` - Cancel subscription

**PlanLimitService** ⭐ - **Decoupled plan validation**
- `getWorkspacePlanLimits()` - Get active plan limits
- `validateDeploymentLimits()` - Check if deployment fits plan (for deployment module)
- `isFeatureEnabled()` - Check if feature is available
- `canAddProject()` - Check app quota
- `canAddDomain()` - Check domain quota
- `getResourceQuota()` - Get all quotas for workspace

#### Controller Endpoints

```
// Public (no auth)
GET  /billing/plans/public                    - Get public plans (ISR)
GET  /billing/plans/public/:slug              - Get specific plan

// Admin (SUPER_ADMIN, ADMIN only)
POST   /billing/plans                         - Create plan
GET    /billing/plans                         - Get all plans
GET    /billing/plans/:planId                 - Get plan
PUT    /billing/plans/:planId                 - Update plan
DELETE /billing/plans/:planId                 - Delete plan

// Subscription
GET    /billing/workspaces/:id/subscription   - Get current subscription
POST   /billing/workspaces/:id/subscription   - Subscribe to plan
PUT    /billing/workspaces/:id/subscription/plan - Change plan
POST   /billing/workspaces/:id/subscription/cancel - Cancel

// Limits (for UI/deployment validation)
GET    /billing/workspaces/:id/limits         - Get plan limits
GET    /billing/workspaces/:id/quota          - Get resource usage quota
GET    /billing/workspaces/:id/features/:name - Check feature enabled
```

### Frontend

#### Pricing Page (SSG with ISR)

**Route:** `/pricing`

- **Static Generation:** Built at deploy time using `next/image` and `revalidate = 300`
- **Incremental Static Regeneration:** Page updates every 5 minutes (300 seconds)
- **How it works:**
  1. Next.js fetches public plans at build time
  2. Page is served as static HTML (fast, cacheable, SEO-friendly)
  3. After 5 minutes, page is marked stale
  4. On next request, page regenerates in background
  5. Admin updates pricing → page auto-refreshes after revalidation window

**Components:**
- `PricingPageContent` - Main content component
- `PlanCard` - Individual plan card with features
- `PlanComparisonTable` - Feature/limit comparison
- `PricingToggle` - Monthly/yearly toggle

**Features:**
- Monthly/yearly toggle with savings display
- Plan comparison table
- Recommended plan highlighting
- Trial info display
- Feature list per plan
- Responsive grid layout

#### Admin Plan Management

**Route:** `/admin/billing/plans`

- Plan list table
- Create/edit/delete plans
- Feature toggle switches
- Pricing inputs (monthly/yearly)
- Plan ordering
- Visibility control (public/private)
- Overage pricing rules

**Hooks:**
- `usePlans()` - Get all plans
- `usePlan(planId)` - Get specific plan
- `usePublicPlans()` - Get public plans only
- `createPlan()` - Create plan
- `updatePlan()` - Update plan
- `deletePlan()` - Delete plan

## How to Use

### For Deployments Module

When validating if deployment can proceed:

```typescript
import { PlanLimitService } from '@/modules/billing/plan-limit.service';

// Inject into your deployment service
constructor(private planLimitService: PlanLimitService) {}

// Before creating deployment, validate:
async deployApplication(workspaceId: string, deployment: any) {
  const validation = await this.planLimitService.validateDeploymentLimits(
    workspaceId,
    {
      cpuRequested: deployment.cpu,
      memoryMbRequested: deployment.memory,
    }
  );

  if (!validation.valid) {
    throw new BadRequestException(validation.reason);
  }

  // Proceed with deployment...
}
```

### For Project/Domain Creation

```typescript
// Check if can add more projects
const { canAdd, reason } = await this.planLimitService.canAddProject(workspaceId);
if (!canAdd) {
  throw new BadRequestException(reason);
}

// Check if feature is available
const hasRedis = await this.planLimitService.isFeatureEnabled(workspaceId, 'redis');
if (!hasRedis) {
  throw new BadRequestException('Redis is not available in your plan');
}
```

### For Frontend (Quota Display)

```typescript
import { useBillingQuota } from '@/hooks/use-billing';

function WorkspaceDashboard({ workspaceId }) {
  const { quota } = useBillingQuota(workspaceId);

  return (
    <div>
      <p>Projects: {quota.projects.used}/{quota.projects.limit}</p>
      <p>Domains: {quota.domains.used}/{quota.domains.limit}</p>
    </div>
  );
}
```

## Plan Structure

### Basic Fields

```typescript
interface Plan {
  // Identifiers
  name: string              // Display name
  slug: string              // URL-friendly identifier (unique)
  description: string       // Short description

  // Pricing (in cents to avoid floats)
  monthlyPriceCents: number // e.g., 2999 = $29.99
  yearlyPriceCents: number  // e.g., 29990 = $299.90 (20% off typical)

  // Resource Limits
  cpuLimit: number          // CPU cores
  memoryLimitMb: number     // RAM in MB
  storageLimitGb: number    // Storage in GB
  bandwidthLimitGb: number  // Monthly bandwidth in GB

  // Feature Limits
  maxApps: number           // Maximum applications/projects
  maxDomains: number        // Maximum custom domains

  // Feature Flags
  autoscalingEnabled: boolean
  backupEnabled: boolean
  databaseEnabled: boolean
  redisEnabled: boolean

  // Support & Trial
  supportLevel: SupportLevel  // COMMUNITY, EMAIL, PRIORITY, DEDICATED
  trialDays: number           // Free trial duration

  // Visibility
  isPublic: boolean           // Show on pricing page
  isDefault: boolean          // Use for new workspaces
  sortOrder: number           // Display order on pricing page

  // UI Metadata
  icon: string                // Icon identifier or emoji
  color: string               // Hex color for UI

  // Relations
  features: string[]          // Feature descriptions
  overages: OverageRule[]     // Overage pricing
}
```

### Overage Pricing

Plans support overage charges for exceeding limits:

```typescript
interface OverageRule {
  overage: OverageType  // CPU, MEMORY, STORAGE, BANDWIDTH
  pricePerUnit: number  // Cost per unit (e.g., $0.50 per core)
}
```

## Sample Plans Included

### Free
- 0.5 CPU, 512MB RAM, 5GB storage, 10GB bandwidth
- 1 app, 1 domain
- Community support, no autoscaling
- $0/month

### Starter ⭐ (Default)
- 2 CPU, 2GB RAM, 50GB storage, 100GB bandwidth
- 5 apps, 5 domains
- Email support, autoscaling, backups
- $29.99/month ($299.90/year)

### Professional
- 8 CPU, 8GB RAM, 250GB storage, 500GB bandwidth
- 25 apps, 25 domains
- Database + Redis, priority support
- $79.99/month ($799.90/year)

### Enterprise
- Custom (64 CPU, 64GB RAM, 2TB storage)
- Dedicated support, SLA guaranteed
- Hidden from pricing page (contact sales)

See `prisma/seed-plans.ts` for complete seed data.

## Static Site Generation Details

### ISR Implementation

The pricing page uses Next.js Incremental Static Regeneration:

```typescript
// app/pricing/page.tsx
export const revalidate = 300; // Revalidate every 5 minutes

export default async function PricingPage() {
  // Fetched at build time
  const plans = await fetchPlans();
  return <PricingPageContent plans={plans} />;
}
```

### How ISR Works

1. **Build Time:** Next.js fetches public plans and generates static HTML
2. **Visit Time:** Users get pre-generated HTML (instant load, SEO friendly)
3. **After 5 minutes:** Page marked as stale
4. **Next Request:** Page regenerates in background with latest data
5. **During Regeneration:** Users still get cached version (no slow requests)

### Benefits

- ✅ **Fast Loads:** Serves static HTML globally
- ✅ **SEO:** Perfect for search engines
- ✅ **Low Server Load:** No dynamic rendering each request
- ✅ **Fresh Data:** Updates automatically every 5 minutes
- ✅ **Admin Updates:** Changes visible within revalidation window

## Environment Variables

```env
# Backend
DATABASE_URL=postgresql://...
NEXT_PUBLIC_API_URL=https://api.example.com

# Frontend
NEXT_PUBLIC_API_URL=https://api.example.com  # Used for ISR fetch
```

## Running Seed Data

```bash
# From backend directory
npm run prisma db seed -- seed-plans.ts
```

## Future Enhancements

### Ready to add:
1. **Stripe Integration** - Payment processing and subscription management
2. **Usage Metering** - Track actual usage for billing
3. **Promotional Pricing** - Support coupons and discounts
4. **Billing History** - Invoice generation and tracking
5. **Custom Plans** - Enterprise-specific pricing
6. **Regional Pricing** - Different prices by region
7. **Volume Discounts** - Bulk pricing breaks
8. **Commitment Discounts** - Multi-year discounts

### Integration Points Ready:
- `SubscriptionService` can extend to include Stripe events
- `BillingHistory` table exists for invoice tracking
- `OverageRule` ready for usage-based billing
- Audit logs track all pricing changes

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│               Pricing Page (/pricing)                    │
│  Next.js ISR (revalidate: 300s)                         │
│  ├─ PricingPageContent (Client)                         │
│  ├─ PlanCard (Client)                                   │
│  ├─ PlanComparisonTable (Client)                        │
│  └─ Plans fetched at build time                         │
└─────────────┬───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│        Backend API: /billing                             │
│                                                           │
│  PlanService                                             │
│  ├─ GET /plans/public (for pricing page)                │
│  ├─ GET/POST/PUT/DELETE /plans (admin)                  │
│  └─ Audit logging                                        │
│                                                           │
│  SubscriptionService                                     │
│  ├─ POST /subscribe (user action)                        │
│  ├─ GET /subscription (current plan)                     │
│  └─ PUT /change-plan (upgrade/downgrade)                 │
│                                                           │
│  PlanLimitService ⭐ (Decoupled)                         │
│  ├─ Queried by deployment module                         │
│  ├─ Queried by project module                            │
│  └─ Queried by domain module                             │
└──────┬──────────────────────┬──────────────────────┬─────┘
       │                      │                      │
       ▼                      ▼                      ▼
    ┌──────┐             ┌──────────┐          ┌────────────┐
    │ Plan │             │Subscription│       │ Deployment │
    └──────┘             └──────────┘        │   Module    │
                                             │ (uses limits)│
                                             └────────────┘
```

## API Examples

### Get Public Plans (Pricing Page)

```bash
curl https://api.example.com/billing/plans/public

# Response
{
  "plans": [
    {
      "id": "...",
      "name": "Starter",
      "slug": "starter",
      "monthlyPriceCents": 2999,
      "yearlyPriceCents": 29990,
      "cpuLimit": 2,
      "memoryLimitMb": 2048,
      "features": [
        "GitHub Integration",
        "Email Support"
      ],
      ...
    }
  ]
}
```

### Create Plan (Admin)

```bash
curl -X POST https://api.example.com/billing/plans \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Starter",
    "slug": "starter",
    "monthlyPriceCents": 2999,
    "yearlyPriceCents": 29990,
    "cpuLimit": 2,
    "memoryLimitMb": 2048,
    "maxApps": 5,
    "maxDomains": 5,
    "isPublic": true,
    "isDefault": true,
    "sortOrder": 2,
    "features": ["GitHub Integration", "Email Support"]
  }'
```

### Validate Deployment

```typescript
// In deployment service
const { valid, reason } = await this.planLimitService.validateDeploymentLimits(
  workspaceId,
  { cpuRequested: 1, memoryMbRequested: 1024 }
);

if (!valid) throw new BadRequestException(reason);
```

## Notes

- All prices stored in cents to avoid floating-point errors
- Yearly pricing typically 20% less than monthly × 12
- Plans can't be deleted if subscriptions exist (prevents data orphaning)
- Changing plan takes effect immediately
- Trial periods reset on subscription start
- Audit logs track all plan changes for compliance
