'use client';

import { createContext, useContext, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { logout as serverLogout } from '@/app/actions';
import { useCurrentUser } from '@/lib/queries/auth';
import { User } from './types';
import { useQueryClient } from '@tanstack/react-query';
import { authKeys } from '@/lib/queries/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const qc = useQueryClient();
  const { data: user, isLoading } = useCurrentUser();

  const refreshUser = async () => {
    await qc.invalidateQueries({ queryKey: authKeys.me });
  };

  const logout = async () => {
    await serverLogout();
    qc.setQueryData(authKeys.me, null);
  };

  return (
    <AuthContext.Provider
      value={{ user: user || null, loading: isLoading, isAuthenticated: !!user, logout, refreshUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    if (typeof window === 'undefined') {
      return { user: null, loading: true, isAuthenticated: false, logout: () => {}, refreshUser: async () => {} };
    }
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
