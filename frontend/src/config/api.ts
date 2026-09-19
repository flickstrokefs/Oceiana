/**
 * Frontend API origin.
 * Uses VITE_API_BASE_URL only. Never VITE_API_URL.
 * Empty base keeps relative `/api` paths so the Vite dev proxy still works.
 */
export function getApiBaseUrl(): string {
  const raw = import.meta.env.VITE_API_BASE_URL;
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim().replace(/\/+$/, '');
  }
  return '';
}

export function apiUrl(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalized}`;
}

export async function fetchApiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === 'string') detail = body.detail;
      else if (body?.detail) detail = JSON.stringify(body.detail);
    } catch {
      /* keep statusText */
    }
    throw new Error(detail || `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}
