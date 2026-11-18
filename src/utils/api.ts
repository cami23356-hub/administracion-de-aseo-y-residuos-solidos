export function getToken(): string | null {
  return localStorage.getItem('cesge_token');
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem('cesge_token', token);
  } else {
    localStorage.removeItem('cesge_token');
  }
}

export async function apiFetch<T>(url: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status} al comunicarse con el servidor.`);
  }
  return data as T;
}
