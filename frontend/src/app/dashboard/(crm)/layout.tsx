'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { UserCtx } from '@/lib/me';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { ToastProvider } from '@/components/ui';
import { api, getToken, getUser, logout, User, fmtDate } from '@/lib/api';
import { NAV } from '@/lib/nav';
import { ROLE_LABELS } from '@/lib/labels';
import '../espace.css';

function Bell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const load = () => api('/notifications').then(setItems).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <div className="bell">
      <button aria-label="Notifications" onClick={() => { setOpen(!open); if (!open && unread) api('/notifications/read', { method: 'POST' }).then(load); }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4" /></svg>
      </button>
      {unread > 0 && <span className="dot">{unread}</span>}
      {open && (
        <div className="notif-panel">
          {items.length === 0 && <div className="n">Aucune notification</div>}
          {items.map((n) => (
            <Link key={n.id} href={n.link || '/dashboard'} className={n.read_at ? '' : 'unread'} onClick={() => setOpen(false)}>
              {n.message}<small>{fmtDate(n.created_at, true)}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EspaceLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    if (!getToken()) { router.replace('/dashboard/connexion'); return; }
    setMe(getUser());
    api('/auth/me').then(setMe).catch(() => {});
  }, [router]);

  if (!me) return null;
  const nav = NAV[me.role] || NAV.client;
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <UserCtx.Provider value={me}>
      <ToastProvider>
        <div className="app">
          <aside className="side">
            <Link href="/" style={{ padding: '4px 6px' }}><Logo /></Link>
            <div className="who"><b>{me.name}</b><span>{ROLE_LABELS[me.role]}</span></div>
            <nav>
              {nav.map((n) => {
                const on = n.href === '/dashboard' ? path === '/dashboard' : path.startsWith(n.href);
                return (
                  <Link key={n.href} href={n.href} className={on ? 'on' : ''}>
                    <svg viewBox="0 0 24 24"><path d={n.icon} /></svg>{n.label}
                  </Link>
                );
              })}
            </nav>
            <div className="bottom">
              <Link href="/">Voir le site</Link>
              <button onClick={logout}>Se déconnecter</button>
            </div>
          </aside>
          <div className="main">
            <div className="topbar">
              <span className="date">{today}</span>
              <Bell />
            </div>
            <div className="content">{children}</div>
          </div>
        </div>
      </ToastProvider>
    </UserCtx.Provider>
  );
}
