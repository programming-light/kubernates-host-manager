const API_VERSION = 'v1';
const baseURL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + `/api/${API_VERSION}`;

let accessToken: string | null = null;

export const setTokens = (access: string, refresh: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
    accessToken = access;
  }
};

export const getAccessToken = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('accessToken');
  }
  return null;
};

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const token = accessToken || (typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null);
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${baseURL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401) {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
    if (refreshToken) {
      try {
        const refreshResponse = await fetch(`${baseURL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
          credentials: 'include',
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          setTokens(data.accessToken, data.refreshToken);
          
          (headers as Record<string, string>)['Authorization'] = `Bearer ${data.accessToken}`;
          const retryResponse = await fetch(`${baseURL}${url}`, {
            ...options,
            headers,
            credentials: 'include',
          });
          return retryResponse;
        }
      } catch {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          window.location.href = '/login';
        }
      }
    }
  }

  return response;
};

const api = {
  get: async (url: string) => {
    const response = await fetchWithAuth(url, { method: 'GET' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new ApiError(response.status, error.message || error.error);
    }
    return response;
  },
  post: async (url: string, body?: unknown) => {
    const response = await fetchWithAuth(url, { method: 'POST', body: JSON.stringify(body) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new ApiError(response.status, error.message || error.error);
    }
    return response;
  },
  put: async (url: string, body?: unknown) => {
    const response = await fetchWithAuth(url, { method: 'PUT', body: JSON.stringify(body) });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new ApiError(response.status, error.message || error.error);
    }
    return response;
  },
  delete: async (url: string) => {
    const response = await fetchWithAuth(url, { method: 'DELETE' });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new ApiError(response.status, error.message || error.error);
    }
    return response;
  },
};

export default api;