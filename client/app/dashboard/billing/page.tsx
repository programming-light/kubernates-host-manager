'use client';

import { useEffect, useState } from 'react';
import { useAuthStore, useBillingStore } from '@/store';
import api from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  CreditCard, 
  Loader2, 
  Sparkles, 
  Server, 
  Database,
  HardDrive,
  Cpu,
  MemoryStick,
  AlertCircle
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

const resourceIcons: Record<string, React.ReactNode> = {
  cpu: <Cpu className="h-5 w-5 text-blue-400" />,
  memory: <MemoryStick className="h-5 w-5 text-purple-400" />,
  storage: <HardDrive className="h-5 w-5 text-green-400" />,
  pods: <Server className="h-5 w-5 text-orange-400" />,
  databases: <Database className="h-5 w-5 text-cyan-400" />,
};

export default function BillingPage() {
  const { user } = useAuthStore();
  const { subscription, resources, setSubscription, setResources } = useBillingStore();
  const [loading, setLoading] = useState(true);
  const [billingInfo, setBillingInfo] = useState<{
    subscription: { status: string; plan: any } | null;
    resources: { resourceType: string; allocated: number; used: number; unit: string }[];
  } | null>(null);

  useEffect(() => {
    fetchBillingInfo();
  }, []);

  const fetchBillingInfo = async () => {
    setLoading(true);
    try {
      const response = await api.get('/payments/resources');
      const data = await response.json();
      
      if (data.subscription) {
        setSubscription(data.subscription);
      }
      if (data.resources) {
        setResources(data.resources);
      }
      setBillingInfo(data);
    } catch (error: any) {
      toast.error(error.message || 'Failed to load billing information');
    } finally {
      setLoading(false);
    }
  };

  const getUsagePercentage = (used: number, allocated: number) => {
    if (allocated === 0) return 0;
    return Math.min((used / allocated) * 100, 100);
  };

  const getProgressColor = (percentage: number) => {
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const formatResourceType = (type: string) => {
    return type.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Billing</h1>
          <p className="mt-1 text-gray-400">Manage your subscription and resource usage</p>
        </div>
        <Link href="/dashboard/pricing">
          <Button className="bg-blue-600 hover:bg-blue-700">
            <CreditCard className="mr-2 h-4 w-4" />
            Manage Subscription
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-white">Current Subscription</CardTitle>
                <CardDescription className="text-gray-400">Your active plan details</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {subscription ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-800/30 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-yellow-400" />
                      <span className="text-lg font-semibold text-white">
                        {subscription.plan?.name || 'Premium Plan'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-400">
                      Status: <span className="text-green-400">{subscription.status}</span>
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-white">
                      ${subscription.plan?.price || 0}
                    </p>
                    <p className="text-sm text-gray-500">
                      {subscription.plan?.interval || 'monthly'}
                    </p>
                  </div>
                </div>
                {subscription.endDate && (
                  <p className="text-sm text-gray-500">
                    Renewal Date: {new Date(subscription.endDate).toLocaleDateString()}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertCircle className="mb-4 h-10 w-10 text-yellow-500" />
                <h3 className="text-lg font-semibold text-white">No Active Subscription</h3>
                <p className="mt-1 text-sm text-gray-400">
                  Subscribe to a plan to unlock more resources
                </p>
                <Link href="/dashboard/pricing">
                  <Button className="mt-4 bg-blue-600 hover:bg-blue-700">
                    View Plans
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-gray-800 bg-gray-900/50">
          <CardHeader>
            <CardTitle className="text-white">Resource Usage</CardTitle>
            <CardDescription className="text-gray-400">Your current resource consumption</CardDescription>
          </CardHeader>
          <CardContent>
            {resources.length > 0 ? (
              <div className="space-y-6">
                {resources.map((resource) => {
                  const percentage = getUsagePercentage(resource.used, resource.allocated);
                  return (
                    <div key={resource.resourceType} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {resourceIcons[resource.resourceType] || (
                            <Server className="h-5 w-5 text-gray-400" />
                          )}
                          <span className="text-sm font-medium text-white">
                            {formatResourceType(resource.resourceType)}
                          </span>
                        </div>
                        <span className="text-sm text-gray-400">
                          {resource.used} / {resource.allocated} {resource.unit}
                        </span>
                      </div>
                      <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-800">
                        <div
                          className={`h-full transition-all duration-500 ${getProgressColor(percentage)}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500">{percentage.toFixed(1)}% used</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Server className="mb-4 h-10 w-10 text-gray-500" />
                <p className="text-gray-400">No resources allocated yet</p>
                <p className="text-sm text-gray-500">
                  Subscribe to a plan to get resources
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="border-gray-800 bg-gray-900/50">
        <CardHeader>
          <CardTitle className="text-white">Payment History</CardTitle>
          <CardDescription className="text-gray-400">Your recent transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <CreditCard className="mb-4 h-10 w-10 text-gray-500" />
            <p className="text-gray-400">No payment history available</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}