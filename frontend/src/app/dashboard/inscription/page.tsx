'use client';
// Inscription d'un client (particulier ou entreprise). Le compte est nécessaire pour demander un devis.
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuthShell from '@/components/AuthShell';
import { api, safeNext, setSession, User } from '@/lib/api';
import '../espace.css';

type Kind = 'particulier' | 'entreprise';

export default function Inscription() {
  const [kind, setKind] = useState<Kind>('entreprise');
  const [next, setNext] = useState('/dashboard');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => setNext(safeNext(new URLSearchParams(location.search).get('next'))), []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    setError('');
    try {
      const r = await api<{ token: string; user: User }>('/auth/register', { body: { ...f, account_type: kind } });
      setSession(r.token, r.user);
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur');
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title={<>Votre espace client,<br />vos devis,<br />vos projets</>}
      text="Créez votre compte pour demander un devis, suivre vos commandes et valider vos contenus avec nos équipes."
    >
      <form onSubmit={submit} className="auth-form">
        <h2>Créer un compte</h2>
        <p style={{ color: 'var(--muted)', margin: '0 0 4px' }}>Gratuit, sans engagement. Un conseiller vous recontacte après votre première demande.</p>

        <div className="acct-type" role="radiogroup" aria-label="Type de compte">
          {([['entreprise', 'Entreprise', 'Société, commerce, profession libérale'], ['particulier', 'Particulier', 'Projet personnel, événement']] as const).map(([v, l, s]) => (
            <button type="button" key={v} role="radio" aria-checked={kind === v} className={kind === v ? 'on' : ''} onClick={() => setKind(v)}>
              <b>{l}</b><small>{s}</small>
            </button>
          ))}
        </div>

        {kind === 'entreprise' && (
          <label className="field"><span>Nom de l’entreprise</span><input className="input" name="company" autoComplete="organization" required /></label>
        )}
        <label className="field"><span>{kind === 'entreprise' ? 'Votre nom et prénom' : 'Nom et prénom'}</span><input className="input" name="name" autoComplete="name" required /></label>
        <label className="field"><span>Téléphone</span><input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+213 5 00 00 00 00" required /></label>
        <label className="field"><span>E-mail</span><input className="input" name="email" type="email" autoComplete="email" required /></label>
        <label className="field">
          <span>Mot de passe <small style={{ color: 'var(--muted)', fontWeight: 400 }}>(8 caractères minimum)</small></span>
          <div className="pw">
            <input className="input" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{show ? 'Masquer' : 'Afficher'}</button>
          </div>
        </label>

        {error && <p style={{ color: 'var(--danger)', margin: 0, fontSize: 14 }} aria-live="polite">{error}</p>}
        <button className="btn btn-primary" style={{ height: 46 }} disabled={busy}>{busy ? 'Création du compte…' : 'Créer mon compte'}</button>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)', textAlign: 'center' }}>
          Déjà un compte ? <Link className="link" href={`/dashboard/connexion?next=${encodeURIComponent(next)}`}>Se connecter</Link>
        </p>
      </form>
    </AuthShell>
  );
}
