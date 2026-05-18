import api from './api';

class ApiClientError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await api.get(url);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function post<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.post(url, body);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function put<T>(url: string, body?: unknown): Promise<T> {
  const res = await api.put(url, body);
  if (res.status === 204) return undefined as T;
  return res.json();
}

async function del<T>(url: string): Promise<T> {
  const res = await api.delete(url);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const apiClient = {
  get: request,
  post,
  put,
  delete: del,
};

export { ApiClientError };
export type { };
