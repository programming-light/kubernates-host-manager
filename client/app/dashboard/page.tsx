import { getCurrentUser } from '@/app/actions';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Suspense } from 'react';

const DashboardClient = dynamic(() => import('./DashboardClient'), {
  loading: () => (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
    </div>
  ),
});

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth?redirect=/dashboard');
  }

  return (
    <Suspense fallback={
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    }>
      <DashboardClient user={user} />
    </Suspense>
  );
}
