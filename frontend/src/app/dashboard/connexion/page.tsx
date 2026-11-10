'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Logo from '@/components/Logo';
import { api, setSession, User } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/labels';
import '../espace.css';

// Comptes de démonstration (base locale uniquement — voir backend/src/seed.js)
const DEMO = [
  ['ceo', 'admin'], ['resp.commercial', 'responsable_commercial'], ['sedentaire', 'commercial_sedentaire'], ['terrain', 'commercial_terrain'],
  ['resp.com', 'responsable_communication'], ['resp.tech', 'responsable_technique'], ['cc', 'charge_clientele'], ['gd', 'graphiste'],
  ['cm', 'community_manager'], ['photo', 'photographe'], ['dev', 'developpeur'], ['recouvrement', 'recouvrement'], ['client', 'client'],
];

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token: string; user: User }>('/auth/login', { body: { email, password } });
      setSession(r.token, r.user);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth-side">
        <Link href="/"><Logo /></Link>
        <div>
          <div className="eyebrow">Plateforme IN COM</div>
          <h1>Un seul espace,<br />du premier appel<br />à la publication<span style={{ color: 'var(--orange)' }}>.</span></h1>
          <p>CRM commercial, suivi de production, validations clients et reporting : chaque rôle retrouve ce dont il a besoin.</p>
        </div>
        <small>© IN COMMUNICATION · La Maison IN Groupe</small>
      </div>
      <div className="auth-main">
        <form onSubmit={submit} className="auth-form">
          <h2>Connexion</h2>
          <p style={{ color: 'var(--muted)', margin: '0 0 8px' }}>Accédez à votre espace collaborateur ou client.</p>
          <label className="field"><span>E-mail</span><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
          <label className="field"><span>Mot de passe</span><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {error && <p style={{ color: 'var(--danger)', margin: 0, fontSize: 14 }}>{error}</p>}
          <button className="btn btn-primary" style={{ height: 46 }} disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>

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
      </div>
    </div>
  );
}
