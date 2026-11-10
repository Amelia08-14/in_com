'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from '@/lib/api';

// ───────── Badge ─────────
export function Badge({ map, value }: { map: Record<string, [string, string]>; value: string }) {
  const [label, tone] = map[value] || [value, 'neutral'];
  return <span className={`badge ${tone === 'info' ? '' : tone}`}>{label}</span>;
}

// ───────── Modal ─────────
export function Modal({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Fermer">×</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

// ───────── Toast ─────────
const ToastCtx = createContext<(msg: string, error?: boolean) => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [t, setT] = useState<{ msg: string; error?: boolean } | null>(null);
  const show = useCallback((msg: string, error?: boolean) => {
    setT({ msg, error });
    setTimeout(() => setT(null), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {t && <div className={`toast ${t.error ? 'error' : ''}`}>{t.msg}</div>}
    </ToastCtx.Provider>
  );
}

// ───────── Data hook ─────────
export function useData<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try { setData(await api<T>(path)); setError(''); } catch (e: any) { setError(e.message); }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);
  useEffect(() => { load(); }, [load]);
  return { data, loading, error, reload: load, setData };
}

// Action avec toast + rechargement
export function useAction() {
  const toast = useToast();
  return useCallback(async (fn: () => Promise<any>, ok: string, after?: () => void) => {
    try { await fn(); toast(ok); after?.(); return true; } catch (e: any) { toast(e.message, true); return false; }
  }, [toast]);
}

// ───────── Page header ─────────
export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="page-head">
      <div><h1>{title}</h1>{sub && <p>{sub}</p>}</div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function Tabs({ value, onChange, items }: { value: string; onChange: (v: string) => void; items: [string, string, number?][] }) {
  return (
    <div className="tabs">
      {items.map(([v, l, n]) => (
        <button key={v} className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}{n != null && <span className="count">{n}</span>}
        </button>
      ))}
    </div>
  );
}

export function Kpi({ label, value, hint, tone }: { label: string; value: any; hint?: string | null; tone?: string | null }) {
  return (
    <div className={`kpi ${tone || ''}`}>
      <span>{label}</span>
      <b>{value}</b>
      {hint && <small>{hint}</small>}
    </div>
  );
}

export function Progress({ value, tone }: { value: number; tone?: string }) {
  return <div className="progress"><div style={{ width: `${Math.min(100, Math.round(value * 100))}%`, background: tone }} /></div>;
}
