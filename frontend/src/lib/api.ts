export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export type User = { id: number; name: string; role: string; email: string };

export function getToken() {
  if (typeof window === 'undefined') return null;
  try { return localStorage.getItem('incom_token'); } catch { return null; }
}

export function setSession(token: string, user: User) {
  localStorage.setItem('incom_token', token);
  localStorage.setItem('incom_user', JSON.stringify(user));
}

export function getUser(): User | null {
  try { return JSON.parse(localStorage.getItem('incom_user') || 'null'); } catch { return null; }
}

export function clearSession() {
  try { localStorage.removeItem('incom_token'); localStorage.removeItem('incom_user'); } catch { /* stockage indisponible */ }
}

export function logout() {
  clearSession();
  window.location.href = '/dashboard/connexion';
}

// Retour après connexion ou inscription : seulement un chemin interne au site
export function safeNext(v: string | null | undefined, fallback = '/dashboard') {
  return v && v.startsWith('/') && !v.startsWith('//') ? v : fallback;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(API_URL + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && typeof window !== 'undefined' && !path.startsWith('/auth/login') && !path.startsWith('/auth/register')) {
    logout();
  }
  if (!res.ok) throw new Error(data.error || 'Erreur réseau');
  return data as T;
}

export const qs = (o: Record<string, unknown>) => {
  const p = Object.entries(o).filter(([, v]) => v !== '' && v != null && v !== undefined);
  return p.length ? '?' + new URLSearchParams(p.map(([k, v]) => [k, String(v)])).toString() : '';
};

export const fmtDate = (s?: string | null, withTime = false) => {
  if (!s) return '—';
  const d = new Date(s.replace(' ', 'T'));
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}) });
};

export const fmtDA = (n?: number | null) => (n == null ? '—' : `${Number(n).toLocaleString('fr-FR')} DA`);
