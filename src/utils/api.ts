import { getLocalToken, setLocalToken } from './localAuth';
import { handleLocalApiRequest } from './localDataEngine';

export function getToken(): string | null {
  return getLocalToken();
}

export function setToken(token: string | null) {
  setLocalToken(token);
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  return handleLocalApiRequest<T>(url, options);
}
