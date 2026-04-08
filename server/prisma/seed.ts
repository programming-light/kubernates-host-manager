import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const plans = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Free tier for testing',
    price: 0,
    interval: 'monthly',
    isActive: true,
    features: JSON.stringify([
      '1 Cluster',
      '1 Project',
      '1GB RAM',
      '1 CPU Core',
      'Community Support',
    ]),
    limits: JSON.stringify({
      cpu: 1,
      memory: 1,
      storage: 5,
      projects: 1,
      clusters: 1,
    }),
  },
  {
    name: 'Starter',
    slug: 'starter',
    description: 'Basic hosting for small projects',
    price: 9.99,
    interval: 'monthly',
    isActive: true,
    features: JSON.stringify([
      '2 Clusters',
      '5 Projects',
      '4GB RAM',
      '2 CPU Cores',
      '10GB Storage',
      'Email Support',
    ]),
    limits: JSON.stringify({
      cpu: 2,
      memory: 4,
      storage: 10,
      projects: 5,
      clusters: 2,
    }),
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Professional hosting',
    price: 29.99,
    interval: 'monthly',
    isActive: true,
    features: JSON.stringify([
      '5 Clusters',
      'Unlimited Projects',
      '16GB RAM',
      '8 CPU Cores',
      '50GB Storage',
      'Priority Support',
    ]),
    limits: JSON.stringify({
      cpu: 8,
      memory: 16,
      storage: 50,
      projects: 100,
      clusters: 5,
    }),
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Full resources for business',
    price: 99.99,
    interval: 'monthly',
    isActive: true,
    features: JSON.stringify([
      'Unlimited Clusters',
      'Unlimited Projects',
      '64GB RAM',
      '16 CPU Cores',
      '200GB Storage',
      '24/7 Support',
    ]),
    limits: JSON.stringify({
      cpu: 16,
      memory: 64,
      storage: 200,
      projects: -1,
      clusters: -1,
    }),
  },
];

async function main() {
  console.log('Seeding pricing plans...');

  for (const plan of plans) {
    await prisma.pricingPlan.upsert({
      where: { slug: plan.slug },
      update: plan,
      create: plan,
    });
  }

  console.log('Pricing plans seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });