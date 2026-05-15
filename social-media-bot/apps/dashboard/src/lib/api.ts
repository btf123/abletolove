const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });
  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

export async function getOverview() {
  return fetchApi<any>('/api/overview');
}

export async function getContent(status?: string) {
  const query = status ? `?status=${status}` : '';
  return fetchApi<any[]>(`/api/content${query}`);
}

export async function updateContent(id: string, updates: { status?: string; caption?: string; hashtags?: string[] }) {
  return fetchApi<any>(`/api/content/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function getSchedule() {
  return fetchApi<any[]>('/api/schedule');
}

export async function getTrends() {
  return fetchApi<any[]>('/api/trends');
}

export async function getEngagement() {
  return fetchApi<any[]>('/api/engagement');
}

export async function getAccounts() {
  return fetchApi<any[]>('/api/accounts');
}

export async function addAccount(platform: string, accountName: string, credentials: Record<string, string>) {
  return fetchApi<any>('/api/accounts', {
    method: 'POST',
    body: JSON.stringify({ platform, accountName, credentials }),
  });
}

export async function getConfig() {
  return fetchApi<Array<{ key: string; value: any }>>('/api/config');
}

export async function setConfig(key: string, value: any) {
  return fetchApi<any>(`/api/config/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

export async function getAnalytics(accountId: string) {
  return fetchApi<any[]>(`/api/analytics/${accountId}`);
}
