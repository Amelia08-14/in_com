'use client';
import { useEffect, useRef, useState } from 'react';
import { API_URL } from '@/lib/api';

export default function ContactForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');
  const [error, setError] = useState('');
  const [offer, setOffer] = useState('');
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => { try { setOffer(sessionStorage.getItem('incom_offer') || ''); } catch {} };
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setState('sending');
    try {
      const res = await fetch(`${API_URL}/public/contact`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setState('ok');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'La demande n’a pas pu être envoyée. Réessayez dans un instant.');
      setState('error');
      first.current?.focus();
    }
  }

  if (state === 'ok') {
    return (
      <div className="form done" role="status">
        <h3>Votre demande est bien reçue.</h3>
        <p>Un conseiller IN COM vous rappelle sous 24h ouvrées.</p>
      </div>
    );
  }

  return (
    <form className="form" onSubmit={submit}>
      <div className="row">
        <label className="field"><span>Nom et prénom</span><input ref={first} className="input" name="name" autoComplete="name" required /></label>
        <label className="field"><span>Entreprise</span><input className="input" name="company" autoComplete="organization" /></label>
      </div>
      <div className="row">
        <label className="field"><span>Téléphone</span><input className="input" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+213" required /></label>
        <label className="field"><span>E-mail</span><input className="input" name="email" type="email" autoComplete="email" /></label>
      </div>
      <label className="field">
        <span>Formule qui vous intéresse</span>
        <select className="input" name="offer" value={offer} onChange={(e) => setOffer(e.target.value)}>
          <option value="">Je ne sais pas encore</option>
          <option value="essentiel">Essentiel</option>
          <option value="pro">Pro</option>
          <option value="premium">Premium</option>
          <option value="sur_devis">Prestation sur devis</option>
        </select>
      </label>
      <label className="field"><span>Votre projet</span><textarea className="input" name="message" placeholder="Votre besoin en quelques lignes" /></label>
      <p className="error" aria-live="polite">{state === 'error' ? error : ''}</p>
      <button type="submit" className="btn btn-primary" disabled={state === 'sending'}>{state === 'sending' ? 'Envoi en cours…' : 'Envoyer ma demande'}</button>
    </form>
  );
}
