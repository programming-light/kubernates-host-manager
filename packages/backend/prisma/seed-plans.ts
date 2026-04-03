import { PrismaClient, SupportLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function seedPlans() {
  console.log('Seeding plans...');

  // Delete existing plans
  await prisma.overageRule.deleteMany();
  await prisma.planFeature.deleteMany();
  await prisma.plan.deleteMany();

  // Free Plan
  const freePlan = await prisma.plan.create({
    data: {
      name: 'Free',
      slug: 'free',
      description: 'Perfect for getting started',
      monthlyPriceCents: 0,
      yearlyPriceCents: 0,
      cpuLimit: 0.5,
      memoryLimitMb: 512,
      storageLimitGb: 5,
      bandwidthLimitGb: 10,
      maxApps: 1,
      maxDomains: 1,
      autoscalingEnabled: false,
      backupEnabled: false,
      databaseEnabled: false,
      redisEnabled: false,
      supportLevel: 'COMMUNITY' as SupportLevel,
      trialDays: 0,
      isPublic: true,
      isDefault: false,
      sortOrder: 1,
      icon: '🚀',
      color: '#6366f1',
    },
  });

  // Add features to Free plan
  await prisma.planFeature.createMany({
    data: [
      { planId: freePlan.id, name: 'GitHub Integration', included: true },
      { planId: freePlan.id, name: 'Basic Monitoring', included: true },
    ],
  });

  // Starter Plan
  const starterPlan = await prisma.plan.create({
    data: {
      name: 'Starter',
      slug: 'starter',
      description: 'For small projects and teams',
      monthlyPriceCents: 2999, // $29.99
      yearlyPriceCents: 29990, // $299.90 (20% off)
      cpuLimit: 2,
      memoryLimitMb: 2048,
      storageLimitGb: 50,
      bandwidthLimitGb: 100,
      maxApps: 5,
      maxDomains: 5,
      autoscalingEnabled: true,
      backupEnabled: true,
      databaseEnabled: false,
      redisEnabled: false,
      supportLevel: 'EMAIL' as SupportLevel,
      trialDays: 7,
      isPublic: true,
      isDefault: true,
      sortOrder: 2,
      icon: '⭐',
      color: '#10b981',
    },
  });

  // Add features to Starter plan
  await prisma.planFeature.createMany({
    data: [
      { planId: starterPlan.id, name: 'GitHub Integration', included: true },
      { planId: starterPlan.id, name: 'Email Support', included: true },
      { planId: starterPlan.id, name: 'Advanced Monitoring', included: true },
      { planId: starterPlan.id, name: 'API Access', included: true },
      { planId: starterPlan.id, name: 'Environment Variables', included: true },
    ],
  });

  // Add overage rules to Starter plan
  await prisma.overageRule.createMany({
    data: [
      {
        planId: starterPlan.id,
        overage: 'CPU',
        pricePerUnit: 0.5, // $0.50 per core per month
      },
      {
        planId: starterPlan.id,
        overage: 'MEMORY',
        pricePerUnit: 0.05, // $0.05 per GB per month
      },
      {
        planId: starterPlan.id,
        overage: 'STORAGE',
        pricePerUnit: 0.1, // $0.10 per GB per month
      },
    ],
  });

  // Professional Plan
  const professionalPlan = await prisma.plan.create({
    data: {
      name: 'Professional',
      slug: 'professional',
      description: 'For growing applications',
      monthlyPriceCents: 7999, // $79.99
      yearlyPriceCents: 79990, // $799.90 (20% off)
      cpuLimit: 8,
      memoryLimitMb: 8192,
      storageLimitGb: 250,
      bandwidthLimitGb: 500,
      maxApps: 25,
      maxDomains: 25,
      autoscalingEnabled: true,
      backupEnabled: true,
      databaseEnabled: true,
      redisEnabled: true,
      supportLevel: 'PRIORITY' as SupportLevel,
      trialDays: 14,
      isPublic: true,
      isDefault: false,
      sortOrder: 3,
      icon: '🌟',
      color: '#f59e0b',
    },
  });

  // Add features to Professional plan
  await prisma.planFeature.createMany({
    data: [
      { planId: professionalPlan.id, name: 'GitHub Integration', included: true },
      { planId: professionalPlan.id, name: 'Priority Email Support', included: true },
      { planId: professionalPlan.id, name: 'Advanced Monitoring', included: true },
      { planId: professionalPlan.id, name: 'API Access', included: true },
      { planId: professionalPlan.id, name: 'Environment Variables', included: true },
      { planId: professionalPlan.id, name: 'Managed PostgreSQL', included: true },
      { planId: professionalPlan.id, name: 'Redis Cache', included: true },
      { planId: professionalPlan.id, name: 'Custom Domains', included: true },
      { planId: professionalPlan.id, name: 'Advanced Security', included: true },
    ],
  });

  // Add overage rules to Professional plan
  await prisma.overageRule.createMany({
    data: [
      {
        planId: professionalPlan.id,
        overage: 'CPU',
        pricePerUnit: 0.25, // $0.25 per core per month
      },
      {
        planId: professionalPlan.id,
        overage: 'MEMORY',
        pricePerUnit: 0.025, // $0.025 per GB per month
      },
      {
        planId: professionalPlan.id,
        overage: 'STORAGE',
        pricePerUnit: 0.05, // $0.05 per GB per month
      },
      {
        planId: professionalPlan.id,
        overage: 'BANDWIDTH',
        pricePerUnit: 0.1, // $0.10 per GB per month
      },
    ],
  });

  // Enterprise Plan (hidden, contact sales)
  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'Enterprise',
      slug: 'enterprise',
      description: 'Custom solutions for large organizations',
      monthlyPriceCents: 0, // Custom pricing
      yearlyPriceCents: 0,
      cpuLimit: 64,
      memoryLimitMb: 65536,
      storageLimitGb: 2000,
      bandwidthLimitGb: 5000,
      maxApps: 200,
      maxDomains: 200,
      autoscalingEnabled: true,
      backupEnabled: true,
      databaseEnabled: true,
      redisEnabled: true,
      supportLevel: 'DEDICATED' as SupportLevel,
      trialDays: 30,
      isPublic: false, // Hidden from pricing page
      isDefault: false,
      sortOrder: 4,
      icon: '👑',
      color: '#8b5cf6',
    },
  });

  // Add features to Enterprise plan
  await prisma.planFeature.createMany({
    data: [
      { planId: enterprisePlan.id, name: 'Everything in Professional', included: true },
      { planId: enterprisePlan.id, name: '24/7 Dedicated Support', included: true },
      { planId: enterprisePlan.id, name: 'SLA Guarantee', included: true },
      { planId: enterprisePlan.id, name: 'Custom Integrations', included: true },
      { planId: enterprisePlan.id, name: 'Advanced Analytics', included: true },
      { planId: enterprisePlan.id, name: 'Multi-Cluster Support', included: true },
      { planId: enterprisePlan.id, name: 'Custom Billing', included: true },
    ],
  });

  console.log('Plans seeded successfully!');
  console.log('Created plans:');
  console.log('- Free');
  console.log('- Starter (default for new workspaces)');
  console.log('- Professional');
  console.log('- Enterprise (hidden)');
}

seedPlans()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
