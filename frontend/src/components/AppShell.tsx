'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Cadre commun aux deux espaces connectés :
// - space="team"   → /dashboard, le CRM de l'équipe (aucun client n'y entre)
// - space="client" → /espace-client, l'espace des clients (aucun membre de l'équipe n'y entre)
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { ToastProvider } from '@/components/ui';
import { UserCtx } from '@/lib/me';
import { api, fmtDate, getToken, getUser, logout, User, CLIENT_HOME, TEAM_HOME } from '@/lib/api';
import { CLIENT_NAV, NAV, clientLink } from '@/lib/nav';
import { ROLE_LABELS } from '@/lib/labels';
import '@/app/dashboard/espace.css';

type Space = 'team' | 'client';

function Bell({ space }: { space: Space }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const load = () => api('/notifications').then(setItems).catch(() => {});
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, []);
  const unread = items.filter((n) => !n.read_at).length;
  const href = (link?: string | null) => (space === 'client' ? clientLink(link) : link || TEAM_HOME);
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
            <Link key={n.id} href={href(n.link)} className={n.read_at ? '' : 'unread'} onClick={() => setOpen(false)}>
              {n.message}<small>{fmtDate(n.created_at, true)}</small>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ space, children }: { space: Space; children: React.ReactNode }) {
  const router = useRouter();
  const path = usePathname();
  const [me, setMe] = useState<User | null>(null);
  const home = space === 'client' ? CLIENT_HOME : TEAM_HOME;

  useEffect(() => {
    if (!getToken()) { router.replace(`${home}/connexion?next=${encodeURIComponent(path)}`); return; }
    // Chacun dans son espace : un client est renvoyé vers /espace-client, l'équipe vers /dashboard
    const check = (u: User | null) => {
      if (!u) return;
      const isClient = u.role === 'client';
      if (space === 'team' && isClient) router.replace(CLIENT_HOME);
      else if (space === 'client' && !isClient) router.replace(TEAM_HOME);
      else setMe(u);
    };
    check(getUser());
    api('/auth/me').then(check).catch(() => {});
  }, [router, space, home, path]);

  if (!me) return null;
  const nav = space === 'client' ? CLIENT_NAV : NAV[me.role] || [];
  const today = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <UserCtx.Provider value={me}>
      <ToastProvider>
        <div className={`app space-${space}`}>
          <aside className="side">
            <Link href="/" style={{ padding: '4px 6px' }}><Logo /></Link>
            <div className="who"><b>{me.name}</b><span>{space === 'client' ? 'Espace client' : ROLE_LABELS[me.role]}</span></div>
            <nav>
              {nav.map((n) => {
                const on = n.href === home ? path === home : path.startsWith(n.href);
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
              <Bell space={space} />
            </div>
            <div className="content">{children}</div>
          </div>
        </div>
      </ToastProvider>
    </UserCtx.Provider>
  );
}
