'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import { api, safeNext, setSession, User } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/labels';
import '../espace.css';

// Comptes de démonstration (base locale uniquement — voir backend/src/seed.js)
const DEMO = [
  ['ceo', 'admin'], ['resp.commercial', 'responsable_commercial'], ['sedentaire', 'commercial_sedentaire'], ['terrain', 'commercial_terrain'],
  ['resp.com', 'responsable_communication'], ['resp.tech', 'responsable_technique'], ['cc', 'charge_clientele'], ['gd', 'graphiste'],
  ['cm', 'community_manager'], ['photo', 'photographe'], ['dev', 'developpeur'], ['recouvrement', 'recouvrement'], ['client', 'client'],
];

export default function Login() {
  const [next, setNext] = useState('/dashboard');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => setNext(safeNext(new URLSearchParams(location.search).get('next'))), []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } });
      setSession(r.token, r.user);
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={<>Un seul espace,<br />du premier appel<br />à la publication</>}
      text="CRM commercial, suivi de production, validations clients et reporting : chaque rôle retrouve ce dont il a besoin."
    >
        <form onSubmit={submit} className="auth-form">
          <h2>Connexion</h2>
          <p style={{ color: 'var(--muted)', margin: '0 0 8px' }}>Accédez à votre espace collaborateur ou client.</p>
          <label className="field"><span>E-mail</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
          <label className="field"><span>Mot de passe</span><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <p style={{ color: 'var(--danger)', margin: 0, fontSize: 14 }}>{error}</p>}
          <button className="btn btn-primary" style={{ height: 46 }} disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
          <p className="auth-alt">Pas encore client ? <Link className="link" href={`/dashboard/inscription?next=${encodeURIComponent(next)}`}>Créer un compte</Link></p>

          {process.env.NEXT_PUBLIC_DEMO === "1" && (
          <details className="demo">
            <summary>Comptes de démonstration (local)</summary>
            <p>Mot de passe commun : <code>incom2026</code></p>
            <div className="demo-grid">
              {DEMO.map(([u, r]) => (
                <button type="button" key={u} onClick={() => { setEmail(`${u}@incom.dz`); setPassword('incom2026'); }}>
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
          </details>
          )}
        </form>
    </AuthShell>
  );
}
