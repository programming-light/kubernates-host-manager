'use client';

import { useState, useEffect, Suspense } from 'react';
import { useAuthStore, useBillingStore } from '@/store';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription, ModalFooter } from '@/components/ui/modal';
import { Check, CreditCard, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const planIcons: Record<string, React.ReactNode> = {
  starter: <Sparkles className="h-6 w-6 text-blue-400" />,
  pro: <Sparkles className="h-6 w-6 text-purple-400" />,
  enterprise: <Sparkles className="h-6 w-6 text-yellow-400" />,
};

const planColors: Record<string, string> = {
  starter: 'from-blue-500/20 to-blue-600/20',
  pro: 'from-purple-500/20 to-purple-600/20',
  enterprise: 'from-yellow-500/20 to-yellow-600/20',
};

function PricingContent({ plans }: { plans: any[] }) {
  const { subscription } = useBillingStore();
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [processingPlan, setProcessingPlan] = useState<string | null>(null);
  const router = useRouter();
  const currentPlanId = subscription?.planId;

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
    setShowPaymentModal(true);
  };

  const handleInitiatePayment = async (paymentMethod: string) => {
    if (!selectedPlan) return;
    setProcessingPlan(paymentMethod);

    try {
      const response = await api.post('/payments/initiate', {
        planId: selectedPlan,
        paymentMethod,
      });
      const data = await response.json();

      if (paymentMethod === 'sslcommerz' && data.paymentUrl) {
        toast.success('Redirecting to payment gateway...');
        window.location.href = data.paymentUrl;
      } else if (paymentMethod === 'stripe') {
        toast.success('Stripe payment initialized');
        setShowPaymentModal(false);
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to initiate payment');
    } finally {
      setProcessingPlan(null);
    }
  };

  if (!plans || plans.length === 0) {
    return (
      <Card className="border-gray-800 bg-gray-900/50">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Sparkles className="mb-4 h-10 w-10 text-gray-500" />
          <p className="text-gray-400">No pricing plans available</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan: any) => {
          const features = Array.isArray(plan.features) ? plan.features : [];
          const limits = plan.limits as Record<string, number>;
          const isCurrent = currentPlanId === plan.id;

          return (
            <Card
              key={plan.id}
              className={`relative overflow-hidden border-gray-800 bg-gray-900/50 transition-all duration-300 hover:border-gray-700 ${
                isCurrent ? 'ring-2 ring-green-500/50' : ''
              }`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${planColors[plan.slug] || 'from-gray-500/20 to-gray-600/20'} opacity-50`} />
              <CardHeader className="relative">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-800">
                  {planIcons[plan.slug] || <Sparkles className="h-6 w-6 text-gray-400" />}
                </div>
                <CardTitle className="text-xl text-white">{plan.name}</CardTitle>
                <p className="text-sm text-gray-400">
                  {plan.description || `$${plan.price}/${plan.interval}`}
                </p>
              </CardHeader>
              <CardContent className="relative space-y-6">
                <div>
                  <span className="text-4xl font-bold text-white">${plan.price}</span>
                  <span className="text-gray-500">/{plan.interval}</span>
                </div>

                <ul className="space-y-3">
                  {features.map((feature: string, index: number) => (
                    <li key={index} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="h-4 w-4 text-green-400" />
                      {feature}
                    </li>
                  ))}
                  {Object.entries(limits || {}).slice(0, 3).map(([key, value]) => (
                    <li key={key} className="flex items-center gap-2 text-sm text-gray-300">
                      <Check className="h-4 w-4 text-green-400" />
                      {value} {key.replace(/([A-Z])/g, ' $1').toLowerCase()}
                    </li>
                  ))}
                </ul>

                <Button
                  onClick={() => handleSelectPlan(plan.id)}
                  disabled={isCurrent}
                  className={`w-full ${
                    isCurrent
                      ? 'bg-green-600 hover:bg-green-700'
                      : plan.slug === 'pro'
                      ? 'bg-purple-600 hover:bg-purple-700'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  {isCurrent ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Current Plan
                    </>
                  ) : (
                    'Select Plan'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Modal open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Choose Payment Method</ModalTitle>
            <ModalDescription>
              Select your preferred payment method to complete your subscription
            </ModalDescription>
          </ModalHeader>
          <div className="space-y-4 py-4">
            <Button
              onClick={() => handleInitiatePayment('sslcommerz')}
              disabled={processingPlan !== null}
              className="w-full justify-start bg-gray-800 hover:bg-gray-700"
            >
              {processingPlan === 'sslcommerz' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pay with SSLCommerz
            </Button>
            <Button
              onClick={() => handleInitiatePayment('stripe')}
              disabled={processingPlan !== null}
              className="w-full justify-start bg-gray-800 hover:bg-gray-700"
            >
              {processingPlan === 'stripe' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              Pay with Stripe
            </Button>
          </div>
          <ModalFooter>
            <Button variant="outline" onClick={() => setShowPaymentModal(false)} className="border-gray-700">
              Cancel
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
}

export function PricingClient({ plans }: { plans: any[] }) {
  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
      </div>
    }>
      <PricingContent plans={plans} />
    </Suspense>
  );
}