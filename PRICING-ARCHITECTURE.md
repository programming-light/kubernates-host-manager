# Pricing System Architecture Diagram

## System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                         │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  PUBLIC                          ADMIN                 USER       │
│  ┌──────────────────────┐  ┌──────────────────┐  ┌───────────┐   │
│  │ /pricing (ISR)       │  │ /admin/billing   │  │ Dashboard │   │
│  │ • Static Generation  │  │ • Plan Manager   │  │ • Quota   │   │
│  │ • Revalidate 5min    │  │ • CRUD ops       │  │ • Usage   │   │
│  │ • SEO Optimized      │  │ • Feature edit   │  │ • Limits  │   │
│  │ • CDN Cacheable      │  │ • Visibility     │  │           │   │
│  └──────────────────────┘  └──────────────────┘  └───────────┘   │
│         │                           │                    │        │
│         │ useSWR()                  │ usePlans()        │        │
│         │ fetch at build            │ mutation funcs    │        │
│         └────────────┬──────────────┴────────┬──────────┘        │
│                      │                        │                   │
└──────────────────────┼────────────────────────┼───────────────────┘
                       │                        │
                   GET /api/billing/           (with auth)
                   plans/public                
                       │                        │
┌──────────────────────┼────────────────────────┼───────────────────┐
│              BACKEND (NestJS)                 │                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    BillingController (16 endpoints)              │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Public Endpoints (no auth)                              │   │
│  │  GET /plans/public              → getPublicPlans()      │   │
│  │  GET /plans/public/:slug        → getPublicPlan()       │   │
│  │                                                          │   │
│  │ Admin Endpoints (admin-only)                            │   │
│  │  POST /plans                    → createPlan()          │   │
│  │  GET /plans                     → getAllPlans()         │   │
│  │  GET /plans/:planId             → getPlan()             │   │
│  │  PUT /plans/:planId             → updatePlan()          │   │
│  │  DELETE /plans/:planId          → deletePlan()          │   │
│  │                                                          │   │
│  │ Subscription Endpoints (user auth)                      │   │
│  │  GET /workspaces/:id/sub        → getSubscription()     │   │
│  │  POST /workspaces/:id/sub       → subscribeToPlan()     │   │
│  │  PUT /workspaces/:id/sub/plan   → changePlan()          │   │
│  │  POST /workspaces/:id/sub/cancel→ cancelSubscription()  │   │
│  │                                                          │   │
│  │ Limits Endpoints (user auth)                            │   │
│  │  GET /workspaces/:id/limits     → getPlanLimits()       │   │
│  │  GET /workspaces/:id/quota      → getResourceQuota()    │   │
│  │  GET /workspaces/:id/features   → checkFeature()        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                           │                                     │
│                ┌──────────┼──────────┐                          │
│                │          │          │                          │
│         ┌──────▼──┐ ┌────▼────┐ ┌──▼─────────────┐            │
│         │ Plan    │ │Subscrip-│ │ PlanLimit      │            │
│         │Service  │ │tion     │ │ Service ⭐     │            │
│         │         │ │Service  │ │                │            │
│         │ • CRUD  │ │         │ │ • Validate     │            │
│         │ • List  │ │ • Sub   │ │ • Check quota  │            │
│         │ • Delete│ │ • Change│ │ • Get limits   │            │
│         │ • Audit │ │ • Cancel│ │ • Check feature│            │
│         └────┬────┘ └────┬────┘ └────┬───────────┘            │
│              │           │           │                        │
│              └───────────┼───────────┘                        │
│                          │                                    │
│                    Used by other modules                      │
│                    (Deployments, Projects,                    │
│                     Domains, etc.)                            │
│                                                              │
│                          │                                    │
└──────────────────────────┼────────────────────────────────────┘
                           │
                    Database Queries
                           │
┌──────────────────────────┼────────────────────────────────────┐
│            DATABASE (PostgreSQL / Prisma)                     │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Plan                PlanFeature      OverageRule            │
│  ├─ id               ├─ id             ├─ id                 │
│  ├─ name             ├─ planId         ├─ planId             │
│  ├─ slug             ├─ name           ├─ overage            │
│  ├─ monthlyPrice     ├─ included       └─ pricePerUnit       │
│  ├─ yearlyPrice      └─ createdAt                            │
│  ├─ cpuLimit                                                 │
│  ├─ memoryLimit      Subscription      PlanAuditLog          │
│  ├─ storageLimit     ├─ id             ├─ id                 │
│  ├─ bandwidthLimit   ├─ workspaceId    ├─ planId             │
│  ├─ maxApps          ├─ planId         ├─ userId             │
│  ├─ maxDomains       ├─ status         ├─ action             │
│  ├─ autoscaling      ├─ startDate      ├─ changes            │
│  ├─ backup           ├─ endDate        └─ createdAt          │
│  ├─ database         └─ createdAt                            │
│  ├─ redis                                                    │
│  ├─ supportLevel                                             │
│  ├─ trialDays        (Linked Entities)                        │
│  ├─ isPublic         User              Workspace             │
│  ├─ isDefault        ├─ planAuditLogs  ├─ subscriptions      │
│  ├─ sortOrder        └─ ...            └─ ...                │
│  └─ createdAt                                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Pricing Page Load (ISR)

```
┌─────────────────────────────────────────────────────────┐
│ Next.js Build Process                                   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 1. Fetch Plans (build time)                             │
│    ┌────────────────────────────────────────────────┐   │
│    │ getStaticProps/getStaticPaths                  │   │
│    │  → fetch /api/billing/plans/public             │   │
│    │  → PlanService.getPublicPlans()                │   │
│    │  → Database query                              │   │
│    └────────────────────────────────────────────────┘   │
│              ↓                                           │
│ 2. Render Page                                          │
│    ┌────────────────────────────────────────────────┐   │
│    │ PricingPageContent                             │   │
│    │  → PlanCard (for each plan)                    │   │
│    │  → PlanComparisonTable                         │   │
│    │  → Static HTML generated                       │   │
│    └────────────────────────────────────────────────┘   │
│              ↓                                           │
│ 3. Cache & Deploy                                       │
│    ┌────────────────────────────────────────────────┐   │
│    │ .next/static/pricing.html                      │   │
│    │ Deploy to CDN                                  │   │
│    │ Serves instantly to all users                  │   │
│    └────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
                          ↓
                    User Requests
                          ↓
          ┌───────────────────────────────┐
          │ After 5 minutes (revalidate)  │
          │ Page marked stale             │
          │ Next request regenerates      │
          │ Admin updates visible         │
          └───────────────────────────────┘
```

### 2. Deployment Validation Flow

```
┌──────────────────────────────────────────┐
│ User Creates Deployment                  │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ DeploymentService.deploy()               │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ PlanLimitService.validateDeploymentLimits│
│  (Decoupled - no billing coupling)       │
└────────────────┬─────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────┐
│ 1. Get active subscription                │
│ 2. Fetch plan limits                      │
│ 3. Compare with requested resources       │
└────────────────┬─────────────────────────┘
                 │
         ┌───────┴───────┐
         │               │
    Valid│          Invalid│
         │               │
    ┌────▼────┐      ┌──▼─────────┐
    │ Continue │      │ Throw Error │
    │ Deployment     │ (limit info) │
    └─────────┘      └──────────────┘
```

### 3. Plan Update Propagation

```
┌────────────────────────────────┐
│ Admin Updates Plan             │
│ PUT /billing/plans/:id         │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│ PlanService.updatePlan()       │
│ • Validate changes             │
│ • Update database              │
│ • Log audit event              │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│ Database Updated               │
└────────────┬───────────────────┘
             │
             ▼
┌────────────────────────────────┐
│ Within 5 minutes:              │
│ ISR Revalidation triggered     │
│ Pricing page regenerates       │
│ New data served to users       │
└────────────────────────────────┘
```

## Service Dependencies

```
┌─────────────────────────────────────────┐
│ BillingController                       │
├─────────────────────────────────────────┤
│ Depends on:                             │
│ • PlanService                           │
│ • SubscriptionService                   │
│ • PlanLimitService                      │
│ • PrismaService                         │
└────────────┬─────────────────────────┬──┘
             │                         │
    ┌────────▼──────┐         ┌────────▼─────┐
    │ PlanService   │         │ Subscription │
    ├───────────────┤         │ Service      │
    │ Depends on:   │         ├──────────────┤
    │ • Prisma      │         │ Depends on:  │
    │ • Validation  │         │ • Prisma     │
    └───────────────┘         │ • PlanService│
                              └──────────────┘
             │                         │
             └────────┬────────────────┘
                      │
              ┌───────▼────────┐
              │ PlanLimitService
              ├────────────────┤
              │ Depends on:    │
              │ • Prisma       │
              │ NO OTHER DEPS  │
              └────────────────┘
                      │
         ┌────────────┴────────────┐
         │                         │
    ┌────▼──────────┐      ┌──────▼─────────┐
    │ Deployment    │      │ Projects       │
    │ Service       │      │ Service        │
    │ (injects)     │      │ (injects)      │
    └───────────────┘      └────────────────┘
```

## Multi-Tenant Isolation

```
┌──────────────────────────────────────────────────┐
│ Workspace 1 (acme.com)                           │
├──────────────────────────────────────────────────┤
│ Subscription → Plan (Professional)               │
│ Projects: 8/25 allowed                           │
│ Domains: 5/25 allowed                            │
│ CPU: 4/8 cores used                              │
└──────────────────────────────────────────────────┘
         │ workspaceId = workspace_1
         │ Fully isolated
         │
         ▼
    Database
         ▲
         │
         │ workspaceId = workspace_2
         │ Fully isolated
         │
┌──────────────────────────────────────────────────┐
│ Workspace 2 (startup.io)                         │
├──────────────────────────────────────────────────┤
│ Subscription → Plan (Starter)                    │
│ Projects: 3/5 allowed                            │
│ Domains: 1/5 allowed                             │
│ CPU: 1.5/2 cores used                            │
└──────────────────────────────────────────────────┘
```

## Request/Response Examples

### GET /billing/plans/public

```
Request:
  GET /api/billing/plans/public
  
Response:
  200 OK
  {
    "plans": [
      {
        "id": "plan_starter",
        "name": "Starter",
        "slug": "starter",
        "monthlyPriceCents": 2999,
        "yearlyPriceCents": 29990,
        "cpuLimit": 2,
        "memoryLimitMb": 2048,
        "features": ["Email Support", "Autoscaling"],
        "overages": [
          {"overage": "CPU", "pricePerUnit": 0.5}
        ]
      },
      ...
    ]
  }
```

### POST /billing/workspaces/:id/subscription

```
Request:
  POST /api/billing/workspaces/ws_123/subscription
  {
    "planId": "plan_professional",
    "isYearly": true
  }

Response:
  201 Created
  {
    "subscription": {
      "workspaceId": "ws_123",
      "planId": "plan_professional",
      "planName": "Professional",
      "monthlyPrice": 79.99,
      "yearlyPrice": 799.90,
      "billingCycle": "yearly",
      "currentPeriodStart": "2024-01-01T00:00:00Z",
      "currentPeriodEnd": "2025-01-01T00:00:00Z",
      "status": "ACTIVE"
    }
  }
```

### GET /billing/workspaces/:id/limits

```
Request:
  GET /api/billing/workspaces/ws_123/limits
  Authorization: Bearer TOKEN

Response:
  200 OK
  {
    "limits": {
      "cpuLimit": 8,
      "memoryLimitMb": 8192,
      "storageLimitGb": 250,
      "bandwidthLimitGb": 500,
      "maxApps": 25,
      "maxDomains": 25,
      "autoscalingEnabled": true,
      "backupEnabled": true,
      "databaseEnabled": true,
      "redisEnabled": true,
      "supportLevel": "PRIORITY"
    }
  }
```

## Performance Timeline

```
1. Build Time (once per deployment)
   ┌─────────────────────────────────────┐
   │ npm run build                       │
   │ ├─ Fetch /api/billing/plans/public │
   │ ├─ Render pricing page to HTML      │
   │ └─ Save .next/static/pricing.html   │
   └─────────────────────────────────────┘
   Time: ~30-60 seconds

2. User Request (served from cache)
   ┌─────────────────────────────────────┐
   │ HTTP GET /pricing                   │
   │ ├─ CDN serves cached HTML (10ms)    │
   │ └─ Browser renders (instant)        │
   └─────────────────────────────────────┘
   Time: <50ms

3. Revalidation (5 minutes)
   ┌─────────────────────────────────────┐
   │ After 300 seconds, page marked stale│
   │ Next request triggers rebuild       │
   │ ├─ Fetch fresh data                 │
   │ ├─ Re-render in background          │
   │ ├─ User still gets cached version   │
   │ └─ Update cache after complete      │
   └─────────────────────────────────────┘
   Time: ~2-5 seconds (in background)
```

---

This architecture ensures:
- ✅ Fast page loads (static HTML)
- ✅ Fresh data (ISR updates)
- ✅ Low server load (no dynamic rendering)
- ✅ Safe plan enforcement (decoupled service)
- ✅ Multi-tenant isolation (workspace scoping)
- ✅ Easy maintenance (centralized plan management)
