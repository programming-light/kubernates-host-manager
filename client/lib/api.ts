const API_VERSION = 'v1';
const baseURL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001') + `/api/${API_VERSION}`;

class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

function setAccessToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('accessToken', token);
  else localStorage.removeItem('accessToken');
}

function setRefreshToken(token: string | null) {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem('refreshToken', token);
  else localStorage.removeItem('refreshToken');
}

const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
  const method = options.method || 'GET';
  const hasBody = method === 'POST' || method === 'PUT' || method === 'PATCH';
  const token = getAccessToken();
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${baseURL}${url}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && token) {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      const refreshResponse = await fetch(`${baseURL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const tokens = await refreshResponse.json();
        setAccessToken(tokens.accessToken);
        setRefreshToken(tokens.refreshToken);
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
        const retryResponse = await fetch(`${baseURL}${url}`, {
          ...options,
          headers,
          credentials: 'include',
        });
        return retryResponse;
      } else {
        setAccessToken(null);
        setRefreshToken(null);
      }
    } catch (err) {
      console.error('[api] refresh token failed:', err);
      setAccessToken(null);
      setRefreshToken(null);
    }
  }

  return response;
};

export { setAccessToken, setRefreshToken, getAccessToken };

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
