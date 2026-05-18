import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api, { setAccessToken, setRefreshToken, getAccessToken } from '@/lib/api';

export const authKeys = {
  me: ['auth', 'me'] as const,
};

export function useCurrentUser() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: async () => {
      const token = getAccessToken();
      if (!token) return null;
      try {
        const res = await api.get('/auth/me');
        return res.json();
      } catch (err: any) {
        if (err?.status === 401) return null;
        throw err;
      }
    },
    retry: false,
    staleTime: 60 * 1000,
  });
}

export function useSendOTP() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await api.post('/auth', { email });
      return res.json();
    },
  });
}

export function useCompleteProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, email }: { name: string; email: string }) => {
      const res = await api.post('/auth/complete-profile', { name, email });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.accessToken) {
        setAccessToken(data.accessToken);
        setRefreshToken(data.refreshToken);
      }
      qc.invalidateQueries({ queryKey: authKeys.me });
    },
  });
}
