'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// « Mon profil » : informations du compte et changement de mot de passe.
// Client : profil complet (entreprise ou particulier), recopié sur sa fiche Univers pour l'équipe.
// Équipe : nom, téléphone et mot de passe.
import { useEffect, useState } from 'react';
import { PageHead, useAction, useData } from '@/components/ui';
import { api, getUser, setSession, getToken } from '@/lib/api';

export const PROFILE_EVENT = 'incom:profile';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="field">
      <span>{label}{hint && <small style={{ fontWeight: 400, marginLeft: 6 }}>{hint}</small>}</span>
      {children}
    </label>
  );
}

function PasswordCard() {
  const run = useAction();
  const [show, setShow] = useState(false);
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = Object.fromEntries(new FormData(form)) as Record<string, string>;
    setErr('');
    if (f.password !== f.confirm) return setErr('Les deux nouveaux mots de passe ne sont pas identiques');
    await run(() => api('/me/password', { body: { current: f.current, password: f.password } }), 'Mot de passe modifié', () => form.reset());
  }
  return (
    <form className="card profile-card" onSubmit={submit}>
      <h2>Mot de passe</h2>
      <div className="grid-2">
        <Field label="Mot de passe actuel"><input className="input" name="current" type={show ? 'text' : 'password'} autoComplete="current-password" required /></Field>
        <div />
        <Field label="Nouveau mot de passe" hint="8 caractères minimum"><input className="input" name="password" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required /></Field>
        <Field label="Confirmer le nouveau mot de passe"><input className="input" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} required /></Field>
      </div>
      {err && <p className="form-err">{err}</p>}
      <div className="profile-actions">
        <label className="check"><input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Afficher les mots de passe</label>
        <button className="btn btn-dark">Changer le mot de passe</button>
      </div>
    </form>
  );
}

export default function ProfilePage() {
  const { data: p, reload } = useData<any>('/me/profile');
  const run = useAction();
  const [type, setType] = useState<'entreprise' | 'particulier'>('entreprise');
  useEffect(() => { if (p?.account_type) setType(p.account_type); }, [p?.account_type]);
  if (!p) return null;
  const isClient = p.role === 'client';
  const ent = type === 'entreprise';

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget));
    await run(() => api('/me/profile', { method: 'PATCH', body: { ...f, account_type: type } }), 'Profil enregistré', () => {
      reload();
      const u = getUser(); const t = getToken();
      if (u && t) setSession(t, { ...u, name: String(f.name) });
      window.dispatchEvent(new Event(PROFILE_EVENT));
    });
  }

  return (
    <>
      <PageHead
        title="Mon profil"
        sub={isClient
          ? 'Ces informations permettent à votre conseiller de préparer vos devis et vos factures. Elles restent confidentielles.'
          : 'Vos coordonnées dans le CRM et votre mot de passe.'}
      />
      {isClient && p.missing?.length > 0 && (
        <div className="profile-missing">À compléter : <b>{p.missing.join(', ')}</b>.</div>
      )}

      <form className="card profile-card" onSubmit={save} key={p.id + type}>
        <h2>{isClient ? 'Informations du compte' : 'Mes informations'}</h2>
        {isClient && (
          <div className="acct-type" role="radiogroup" aria-label="Type de compte" style={{ maxWidth: 520 }}>
            {([['entreprise', 'Entreprise', 'Société, commerce, profession libérale'], ['particulier', 'Particulier', 'Projet personnel, événement']] as const).map(([v, l, s]) => (
              <button type="button" key={v} role="radio" aria-checked={type === v} className={type === v ? 'on' : ''} onClick={() => setType(v)}>
                <b>{l}</b><small>{s}</small>
              </button>
            ))}
          </div>
        )}

        {isClient && ent && (
          <>
            <h3>Entreprise</h3>
            <div className="grid-2">
              <Field label="Nom de l’entreprise"><input className="input" name="company" defaultValue={p.company || ''} required /></Field>
              <Field label="Secteur d’activité">
                <select className="input" name="activity" defaultValue={p.activity && p.activity !== 'Particulier' ? p.activity : ''} required>
                  <option value="" disabled>Choisir…</option>
                  {p.activities.filter((a: string) => a !== 'Particulier').map((a: string) => <option key={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="NIF" hint="facultatif, pour la facturation"><input className="input" name="nif" defaultValue={p.nif || ''} /></Field>
              <Field label="Registre du commerce (RC)" hint="facultatif"><input className="input" name="rc" defaultValue={p.rc || ''} /></Field>
            </div>
          </>
        )}

        {isClient && <h3>{ent ? 'Contact' : 'Vos coordonnées'}</h3>}
        <div className="grid-2">
          <Field label={ent && isClient ? 'Votre nom et prénom' : 'Nom et prénom'}><input className="input" name="name" defaultValue={p.name} autoComplete="name" required /></Field>
          <Field label="Téléphone"><input className="input" name="phone" type="tel" defaultValue={p.phone || ''} autoComplete="tel" required={isClient} /></Field>
          <Field label="E-mail" hint="identifiant de connexion"><input className="input" value={p.email} disabled readOnly /></Field>
          {isClient && <Field label="Ville / wilaya"><input className="input" name="city" defaultValue={p.city || ''} autoComplete="address-level2" placeholder="Alger, Oran, Blida…" required /></Field>}
          {isClient && <Field label="Adresse" hint={ent ? undefined : 'facultatif'}><input className="input" name="address" defaultValue={p.address || ''} autoComplete="street-address" required={ent} /></Field>}
        </div>

        {isClient && (
          <>
            <h3>Présence en ligne <small>facultatif</small></h3>
            <div className="grid-2">
              <Field label="Site web"><input className="input" name="website" defaultValue={p.website || ''} placeholder="www.exemple.dz" /></Field>
              <Field label="Page Instagram ou Facebook"><input className="input" name="social_url" defaultValue={p.social_url || ''} placeholder="instagram.com/votre-page" /></Field>
            </div>
          </>
        )}
        <div className="profile-actions"><span /><button className="btn btn-primary">Enregistrer</button></div>
      </form>

      <PasswordCard />
    </>
  );
}
