'use server';

import { cookies } from 'next/headers';

const API_VERSION = 'v1';
const baseURL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + `/api/${API_VERSION}`;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function verifyOTP(email: string, otp: string, redirectPath?: string) {
  try {
    const response = await fetch(`${baseURL}/auth/otp/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: data.message || data.error || `Verification failed (${response.status})` };
    }

    if (data.accessToken) {
      const cookieStore = await cookies();

      cookieStore.set('accessToken', data.accessToken, {
        ...COOKIE_OPTIONS,
        maxAge: 24 * 60 * 60,
      });

      const result: any = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };

      if (data.isComplete === false) {
        result.requiresProfile = true;
        return result;
      }

      result.success = true;
      result.redirectTo = redirectPath || '/dashboard';
      return result;
    }

    return { error: 'Authentication failed' };
  } catch {
    return { error: 'Failed to verify OTP' };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('accessToken');
  return { success: true, redirectTo: '/auth' };
}

export async function getCurrentUser() {
  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get('accessToken')?.value;

    if (!accessToken) {
      return null;
    }

    const response = await fetch(`${baseURL}/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}
