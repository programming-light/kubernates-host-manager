import { getCurrentUser } from '@/app/actions';
import { redirect } from 'next/navigation';

export async function requireAuth(redirectPath?: string) {
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/auth?redirect=${redirectPath || '/dashboard'}`);
  }

  return user;
}
