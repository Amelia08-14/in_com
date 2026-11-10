'use client';
// Formulaire de connexion commun. Après connexion, chacun va dans son espace :
// les clients sur /espace-client, l'équipe sur /dashboard, quelle que soit la page utilisée.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, homeAfterLogin, setSession, User } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/labels';

// demo : comptes de démonstration affichés seulement en local (NEXT_PUBLIC_DEMO=1), mot de passe incom2026
export default function LoginForm({ space, demo }: { space: 'team' | 'client'; demo?: string[][] }) {
  const [next, setNext] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setNext(new URLSearchParams(location.search).get('next') || ''), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } });
      setSession(r.token, r.user);
      window.location.href = homeAfterLogin(r.user.role, next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="auth-form">
      <h2>{space === 'client' ? 'Espace client' : 'Espace équipe'}</h2>
      <p style={{ color: 'var(--muted)', margin: '0 0 8px' }}>
        {space === 'client' ? 'Connectez-vous pour demander un devis et suivre vos projets.' : 'Connexion réservée aux collaborateurs IN COM.'}
      </p>
      <label className="field"><span>E-mail</span><input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
      <label className="field"><span>Mot de passe</span><input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
      {error && <p style={{ color: 'var(--danger)', margin: 0, fontSize: 14 }}>{error}</p>}
      <button className="btn btn-primary" style={{ height: 46 }} disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      {space === 'client' && (
        <p className="auth-alt">Pas encore de compte ? <Link className="link" href={`/espace-client/inscription${next ? `?next=${encodeURIComponent(next)}` : ''}`}>Créer un compte</Link></p>
      )}
      {demo && process.env.NEXT_PUBLIC_DEMO === '1' && (
        <details className="demo">
          <summary>Comptes de démonstration (local)</summary>
          <p>Mot de passe commun : <code>incom2026</code></p>
          <div className="demo-grid">
            {demo.map(([u, role]) => (
              <button type="button" key={u} onClick={() => { setEmail(`${u}@incom.dz`); setPassword('incom2026'); }}>{ROLE_LABELS[role]}</button>
            ))}
          </div>
        </details>
      )}
    </form>
  );
}
