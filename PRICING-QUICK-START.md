# Pricing System Quick Start

Get the pricing system up and running in 5 minutes.

## 1. Database Setup (2 minutes)

```bash
# Apply schema changes to database
npm run prisma migrate dev --name add-pricing-system

# Seed sample plans
npm run prisma db seed -- seed-plans.ts
```

**What this does:**
- Creates Plan, PlanFeature, OverageRule, PlanAuditLog, Subscription tables
- Adds relations to User, Workspace tables
- Seeds 4 sample plans (Free, Starter, Professional, Enterprise)

## 2. Verify Backend (1 minute)

```bash
# Start backend server
npm run dev -w packages/backend

# Test public plans endpoint
curl http://localhost:3001/api/billing/plans/public
```

Expected response:
```json
{
  "plans": [
    {
      "id": "...",
      "name": "Free",
      "slug": "free",
      "monthlyPriceCents": 0,
      "cpuLimit": 0.5,
      "memoryLimitMb": 512,
      ...
    },
    ...
  ]
}
```

## 3. Start Frontend (2 minutes)

```bash
# Terminal 1: Backend
npm run dev -w packages/backend

# Terminal 2: Frontend
npm run dev
```

**Visit these URLs:**
- `http://localhost:3000/pricing` - Public pricing page (SSG)
- `http://localhost:3000/admin/billing/plans` - Admin dashboard

## Done! ✅

The pricing system is now running:
- ✅ Pricing page with static generation
- ✅ Admin plan management
- ✅ Plan limits validation (ready for deployments)
- ✅ Sample data to test with

## Key URLs

| Route | Purpose | Auth |
|-------|---------|------|
| `/pricing` | Public pricing page (SSG) | None |
| `/api/billing/plans/public` | Fetch public plans | None |
| `/admin/billing/plans` | Admin dashboard | Admin |
| `/api/billing/plans` | CRUD operations | Admin |
| `/api/billing/workspaces/:id/subscription` | Subscription mgmt | User |
| `/api/billing/workspaces/:id/limits` | Get plan limits | User |
| `/api/billing/workspaces/:id/quota` | Get usage quota | User |

## Using Plan Limits in Your Code

### In Deployment Module

```typescript
import { PlanLimitService } from '@/modules/billing/plan-limit.service';

export class DeploymentService {
  constructor(private planLimitService: PlanLimitService) {}

  async deploy(workspaceId: string, cpu: number, memory: number) {
    // Validate before deployment
    const { valid, reason } = await this.planLimitService.validateDeploymentLimits(
      workspaceId,
      { cpuRequested: cpu, memoryMbRequested: memory }
    );

    if (!valid) throw new BadRequestException(reason);

    // Proceed with deployment...
  }
}
```

### Check Feature Availability

```typescript
// Check if feature is enabled
const hasRedis = await this.planLimitService.isFeatureEnabled(
  workspaceId,
  'redis'
);

if (!hasRedis) {
  throw new BadRequestException('Redis not available in your plan');
}
```

### Get Quota for UI

```typescript
// Frontend: Display quota
const { quota } = await fetch(`/api/billing/workspaces/${id}/quota`).then(r => r.json());

console.log(`Projects: ${quota.projects.used}/${quota.projects.limit}`);
console.log(`Domains: ${quota.domains.used}/${quota.domains.limit}`);
```

## Admin Operations

### Create a Plan

```bash
curl -X POST http://localhost:3001/api/billing/plans \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pro",
    "slug": "pro",
    "monthlyPriceCents": 4999,
    "yearlyPriceCents": 49990,
    "cpuLimit": 4,
    "memoryLimitMb": 4096,
    "maxApps": 10,
    "maxDomains": 10,
    "isPublic": true,
    "sortOrder": 3,
    "databaseEnabled": true,
    "redisEnabled": true
  }'
```

### Update a Plan

```bash
curl -X PUT http://localhost:3001/api/billing/plans/PLAN_ID \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "monthlyPriceCents": 5999,
    "cpuLimit": 5
  }'
```

### Delete a Plan

```bash
curl -X DELETE http://localhost:3001/api/billing/plans/PLAN_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Note:** Cannot delete plans with active subscriptions.

## ISR Explained

The pricing page uses **Incremental Static Regeneration**:

1. **Build Time:** Page generated with current plans
2. **Serve Time:** Users get pre-built static HTML (fast!)
3. **After 5 min:** Page marked stale
4. **Next Request:** Page regenerates in background
5. **Admin Changes:** Visible within 5 minutes automatically

**Benefits:**
- ✅ Lightning fast page loads
- ✅ Perfect for SEO
- ✅ Low server load
- ✅ Auto-refreshes with data changes

## Sample Plans

| Plan | Price | CPU | RAM | Storage | Apps | Features |
|------|-------|-----|-----|---------|------|----------|
| Free | $0 | 0.5 | 512MB | 5GB | 1 | Community |
| Starter ⭐ | $29.99 | 2 | 2GB | 50GB | 5 | Email support, autoscale |
| Pro | $79.99 | 8 | 8GB | 250GB | 25 | DB, Redis, priority |
| Enterprise | Custom | 64 | 64GB | 2TB | 200 | Dedicated support |

## Environment Variables

```env
# Frontend - for ISR fetching plans
NEXT_PUBLIC_API_URL=http://localhost:3001/api

# Backend
DATABASE_URL=postgresql://...
```

## Troubleshooting

### Pricing page shows no plans

1. Check that seed completed: `psql -c "SELECT count(*) FROM Plan;"`
2. Verify API running: `curl http://localhost:3001/api/billing/plans/public`
3. Check logs for ISR fetch errors
4. Rebuild ISR: `npm run build` (clear `.next`)

### Admin dashboard doesn't load

1. Check auth token is valid
2. Verify user has ADMIN role
3. Check network tab for API errors
4. Verify backend is running

### Plan limits not working

1. Verify PlanLimitService is imported
2. Check workspace has active subscription
3. Test manually: `curl /api/billing/workspaces/{id}/limits`

## Next Steps

1. **Add Deployment Validation**
   - Import PlanLimitService in deployment module
   - Validate CPU/memory before deployment

2. **Add Project/Domain Limits**
   - Use `canAddProject()` before creating project
   - Use `canAddDomain()` before adding domain

3. **Display Quota in UI**
   - Fetch `/api/billing/workspaces/:id/quota`
   - Show usage bars in dashboard

4. **Integrate Payments** (Future)
   - Add Stripe webhook handler
   - Sync subscriptions with Stripe
   - Add invoice generation

## Documentation

- **Full Guide:** See `PRICING-SYSTEM-README.md`
- **Architecture:** See `PRICING-IMPLEMENTATION-SUMMARY.md`
- **API Reference:** See `PRICING-SYSTEM-README.md` → API Examples

## Support

For issues or questions:
1. Check `PRICING-SYSTEM-README.md` for detailed documentation
2. Review `PRICING-IMPLEMENTATION-SUMMARY.md` for architecture
3. Check database seed in `prisma/seed-plans.ts`
