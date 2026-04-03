import { PrismaClient, UserRole, PlanType, ClusterProvider, ClusterStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seed...');

  // Clean up existing data (dev only)
  await prisma.auditLog.deleteMany();
  await prisma.sslCertificate.deleteMany();
  await prisma.domain.deleteMany();
  await prisma.environment.deleteMany();
  await prisma.deployment.deleteMany();
  await prisma.project.deleteMany();
  await prisma.cluster.deleteMany();
  await prisma.billingHistory.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.tenantPlan.deleteMany();
  await prisma.user.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.plan.deleteMany();
  await prisma.featureFlag.deleteMany();

  // Create Plans
  const freePlan = await prisma.plan.create({
    data: {
      name: 'Free',
      type: PlanType.FREE,
      price: 0,
      projectLimit: 1,
      deploymentSlots: 10,
      storageGB: 5,
      bandwidthGB: 10,
      features: ['Basic deployment', 'Community support'],
    },
  });

  const starterPlan = await prisma.plan.create({
    data: {
      name: 'Starter',
      type: PlanType.STARTER,
      price: 29,
      projectLimit: 5,
      deploymentSlots: 100,
      storageGB: 50,
      bandwidthGB: 100,
      features: [
        'Unlimited deployments',
        'Custom domains',
        'Email support',
        'SSL certificates',
      ],
    },
  });

  const proPlan = await prisma.plan.create({
    data: {
      name: 'Professional',
      type: PlanType.PROFESSIONAL,
      price: 99,
      projectLimit: 20,
      deploymentSlots: 500,
      storageGB: 200,
      bandwidthGB: 500,
      features: [
        'Unlimited deployments',
        'Custom domains',
        'Priority support',
        'SSL certificates',
        'Auto-scaling',
        'Team collaboration',
      ],
    },
  });

  const enterprisePlan = await prisma.plan.create({
    data: {
      name: 'Enterprise',
      type: PlanType.ENTERPRISE,
      price: 299,
      projectLimit: 100,
      deploymentSlots: 5000,
      storageGB: 1000,
      bandwidthGB: 5000,
      features: [
        'Everything in Professional',
        'Dedicated support',
        'SLA guarantee',
        'Custom integrations',
        'Private cluster option',
      ],
    },
  });

  console.log('Created plans: Free, Starter, Professional, Enterprise');

  // Create Tenants
  const tenant1 = await prisma.tenant.create({
    data: {
      name: 'Acme Corp',
      slug: 'acme-corp',
      ownerId: 'temp-owner-1',
    },
  });

  const tenant2 = await prisma.tenant.create({
    data: {
      name: 'Tech Startup Inc',
      slug: 'tech-startup',
      ownerId: 'temp-owner-2',
    },
  });

  console.log('Created tenants: Acme Corp, Tech Startup Inc');

  // Create Users
  const hashedPassword = await bcrypt.hash('password123', 10);

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@acme.com',
      password: hashedPassword,
      name: 'Admin User',
      role: UserRole.ADMIN,
      tenantId: tenant1.id,
    },
  });

  const devUser = await prisma.user.create({
    data: {
      email: 'dev@acme.com',
      password: hashedPassword,
      name: 'Developer User',
      role: UserRole.DEVELOPER,
      tenantId: tenant1.id,
    },
  });

  const viewerUser = await prisma.user.create({
    data: {
      email: 'viewer@startup.com',
      password: hashedPassword,
      name: 'Viewer User',
      role: UserRole.VIEWER,
      tenantId: tenant2.id,
    },
  });

  console.log('Created users: admin@acme.com, dev@acme.com, viewer@startup.com');

  // Create Subscriptions
  const sub1 = await prisma.subscription.create({
    data: {
      tenantId: tenant1.id,
      planId: proPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  const sub2 = await prisma.subscription.create({
    data: {
      tenantId: tenant2.id,
      planId: starterPlan.id,
      status: 'ACTIVE',
      currentPeriodStart: new Date(),
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Created subscriptions for both tenants');

  // Create Clusters
  const cluster1 = await prisma.cluster.create({
    data: {
      tenantId: tenant1.id,
      name: 'production-us-east',
      provider: ClusterProvider.EKS,
      region: 'us-east-1',
      status: ClusterStatus.ACTIVE,
      apiEndpoint: 'https://eks-prod.amazonaws.com',
      caCertificate: 'encrypted_ca_cert_here',
      clientCert: 'encrypted_client_cert_here',
      clientKey: 'encrypted_client_key_here',
      token: 'encrypted_token_here',
    },
  });

  const cluster2 = await prisma.cluster.create({
    data: {
      tenantId: tenant2.id,
      name: 'staging-eu',
      provider: ClusterProvider.GKE,
      region: 'eu-central-1',
      status: ClusterStatus.ACTIVE,
      apiEndpoint: 'https://gke-staging.googleapis.com',
      caCertificate: 'encrypted_ca_cert_here',
      clientCert: 'encrypted_client_cert_here',
      clientKey: 'encrypted_client_key_here',
      token: 'encrypted_token_here',
    },
  });

  console.log('Created clusters: production-us-east, staging-eu');

  // Create Projects
  const project1 = await prisma.project.create({
    data: {
      tenantId: tenant1.id,
      clusterId: cluster1.id,
      name: 'Web Application',
      slug: 'web-app',
      description: 'Main web application',
      gitUrl: 'https://github.com/acme/web-app.git',
      namespace: 'acme-web-app',
      status: 'ACTIVE',
    },
  });

  const project2 = await prisma.project.create({
    data: {
      tenantId: tenant1.id,
      clusterId: cluster1.id,
      name: 'API Server',
      slug: 'api-server',
      description: 'Backend API',
      gitUrl: 'https://github.com/acme/api.git',
      namespace: 'acme-api',
      status: 'ACTIVE',
    },
  });

  const project3 = await prisma.project.create({
    data: {
      tenantId: tenant2.id,
      clusterId: cluster2.id,
      name: 'Startup Dashboard',
      slug: 'dashboard',
      description: 'Admin dashboard',
      gitUrl: 'https://github.com/startup/dashboard.git',
      namespace: 'startup-dashboard',
      status: 'ACTIVE',
    },
  });

  console.log('Created projects: Web Application, API Server, Startup Dashboard');

  // Create Deployments
  const deployment1 = await prisma.deployment.create({
    data: {
      projectId: project1.id,
      version: 1,
      status: 'RUNNING',
      commitSha: 'abc123def456',
      commitMessage: 'Initial deployment',
      deployedBy: adminUser.id,
      startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 10 * 60 * 1000),
      logs: 'Deployment successful',
    },
  });

  const deployment2 = await prisma.deployment.create({
    data: {
      projectId: project1.id,
      version: 2,
      status: 'RUNNING',
      commitSha: 'ghi789jkl012',
      commitMessage: 'Fix bug in user auth',
      deployedBy: devUser.id,
      startedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000 + 8 * 60 * 1000),
      logs: 'Deployment successful',
    },
  });

  console.log('Created deployments for Web Application');

  // Create Environments
  await prisma.environment.create({
    data: {
      projectId: project1.id,
      name: 'production',
      variables: JSON.stringify({
        DATABASE_URL: 'prod_db_url',
        API_KEY: 'prod_key',
        DEBUG: 'false',
      }),
    },
  });

  await prisma.environment.create({
    data: {
      projectId: project1.id,
      name: 'staging',
      variables: JSON.stringify({
        DATABASE_URL: 'staging_db_url',
        API_KEY: 'staging_key',
        DEBUG: 'true',
      }),
    },
  });

  console.log('Created environments: production, staging');

  // Create Domains
  const domain1 = await prisma.domain.create({
    data: {
      tenantId: tenant1.id,
      projectId: project1.id,
      domain: 'app.acme.com',
      status: 'VERIFIED',
      dnsRecord: 'CNAME app.acme.com.example.com',
    },
  });

  const domain2 = await prisma.domain.create({
    data: {
      tenantId: tenant2.id,
      projectId: project3.id,
      domain: 'dashboard.startup.io',
      status: 'PENDING',
      dnsRecord: null,
    },
  });

  console.log('Created domains: app.acme.com, dashboard.startup.io');

  // Create SSL Certificates
  await prisma.sslCertificate.create({
    data: {
      domainId: domain1.id,
      provider: 'letsencrypt',
      issuer: "Let's Encrypt",
      status: 'active',
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    },
  });

  console.log('Created SSL certificate for app.acme.com');

  // Create Feature Flags
  await prisma.featureFlag.create({
    data: {
      name: 'new_deployment_ui',
      enabled: true,
      value: 'v2',
    },
  });

  await prisma.featureFlag.create({
    data: {
      name: 'auto_scaling',
      enabled: false,
    },
  });

  console.log('Created feature flags: new_deployment_ui, auto_scaling');

  console.log('Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
