'use client';
// Suivi de commande : formulaire de code, et timeline animée d'un panier
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { fmt } from './cart';

export function TrackForm({ dark = false }: { dark?: boolean }) {
  const [code, setCode] = useState('');
  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => { try { setRecent(JSON.parse(localStorage.getItem('incom_orders') || '[]')); } catch { /* rien */ } }, []);
  const go = (c: string) => { window.location.href = `/suivi/${encodeURIComponent(c.trim().toUpperCase())}`; };
  return (
    <div className={`track-form ${dark ? 'dark' : ''}`}>
      <form onSubmit={(e) => { e.preventDefault(); if (code.trim()) go(code); }}>
        <label className="visually-hidden" htmlFor="track-code">Code de suivi</label>
        <input id="track-code" className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="IC-XXXXXX" autoComplete="off" spellCheck={false} />
        <button type="submit" className="btn btn-accent" data-magnet>Suivre</button>
      </form>
      {recent.length > 0 && (
        <p className="recent">Vos commandes sur cet appareil : {recent.map((c) => <a key={c} className="chip" href={`/suivi/${c}`}>{c}</a>)}</p>
      )}
    </div>
  );
}

const STEPS: [string, string, string][] = [
  ['recue', 'Commande reçue', 'Votre panier est bien arrivé chez nous.'],
  ['contactee', 'Conseiller en contact', 'Votre conseiller vous appelle pour préciser votre besoin.'],
  ['devis_envoye', 'Devis envoyé', 'La proposition chiffrée des prestations sur devis vous est adressée.'],
  ['confirmee', 'Commande confirmée', 'Contrat signé et premier paiement reçu : le projet est lancé.'],
  ['en_production', 'En production', 'Nos équipes créent vos contenus ; vous validez chacun depuis votre espace client.'],
  ['livree', 'Livrée', 'Tout est en ligne. Vos rapports arrivent chaque mois.'],
];

type Cart = {
  code: string; status: string; created_at: string; updated_at: string; first_name: string; company: string | null;
  total_once: number; total_monthly: number; conseiller: string | null;
  items: { kind: string; label: string; months: number | null; quantity: number; unit_price: number; total: number }[];
  events: { status: string; note: string | null; created_at: string }[];
};

const date = (s: string) => new Date(s.replace(' ', 'T')).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

export function TrackView({ code }: { code: string }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [err, setErr] = useState('');
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () => fetch(`${API_URL}/public/carts/${encodeURIComponent(code)}`)
      .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; })
      .then((j) => { if (alive) { setCart(j); setErr(''); window.setTimeout(() => setShown(true), 60); } })
      .catch((e) => alive && setErr(e.message || 'Suivi indisponible pour le moment.'));
    load();
    const id = window.setInterval(load, 30000);
    return () => { alive = false; window.clearInterval(id); };
  }, [code]);

  if (err) return (
    <div className="track-empty">
      <h1>Code introuvable.</h1>
      <p className="lead">{err}. Vérifiez le code reçu après votre commande, il commence par IC-.</p>
      <TrackForm />
    </div>
  );
  if (!cart) return <div className="track-loading" aria-busy="true"><span /><span /><span /></div>;

  const cancelled = cart.status === 'annulee';
  const seen = new Set(cart.events.map((e) => e.status));
  const cur = STEPS.findIndex(([s]) => s === cart.status);
  const lastDone = cancelled ? Math.max(...cart.events.map((e) => STEPS.findIndex(([s]) => s === e.status))) : cur;
  const pct = Math.max(0, lastDone) / (STEPS.length - 1);

  return (
    <div className={`track ${shown ? 'in' : ''}`}>
      <header className="track-head">
        <p className="track-code">{cart.code}</p>
        <h1>{cancelled ? 'Commande annulée.' : cart.status === 'livree' ? `C’est livré, ${cart.first_name}.` : `Bonjour ${cart.first_name}, on avance.`}</h1>
        <p className="lead">
          Commande passée le {date(cart.created_at)}{cart.company ? ` pour ${cart.company}` : ''}.
          {cart.conseiller ? ` Votre conseiller : ${cart.conseiller}.` : ' Un conseiller vous est attribué très vite.'}
        </p>
      </header>

      <ol className={`timeline ${cancelled ? 'cancelled' : ''}`} style={{ ['--pct' as string]: pct }}>
        {STEPS.map(([s, title, text], i) => {
          const ev = [...cart.events].reverse().find((e) => e.status === s);
          const state = s === 'devis_envoye' && i < lastDone && !seen.has(s) ? 'skip'
            : i < lastDone || (i === lastDone && (cart.status === 'livree' || cancelled)) ? 'done'
            : i === lastDone ? 'now' : 'todo';
          return (
            <li key={s} className={state} style={{ ['--i' as string]: i }}>
              <span className="pin" aria-hidden="true">{state === 'done' ? '✓' : i + 1}</span>
              <div>
                <h2>{title}{state === 'now' && <span className="live">en cours</span>}</h2>
                <p>{text}</p>
                {ev && <p className="when">{date(ev.created_at)}{ev.note && <> · {ev.note}</>}</p>}
              </div>
            </li>
          );
        })}
        {cancelled && <li className="now cancel"><span className="pin" aria-hidden="true">×</span><div><h2>Annulée</h2><p>{cart.events.at(-1)?.note || 'Contactez-nous si c’est une erreur.'}</p></div></li>}
      </ol>

      <section className="track-items" aria-labelledby="ti">
        <h2 id="ti">Le contenu de votre commande</h2>
        <ul>
          {cart.items.map((i, k) => (
            <li key={k}>
              <span>{i.label}{i.kind === 'service' && i.quantity > 1 && ` × ${i.quantity}`}</span>
              <b>{i.kind === 'devis' ? 'Sur devis' : i.kind === 'offer' ? `${fmt(i.unit_price)} DA / mois` : `${fmt(i.total)} DA`}</b>
            </li>
          ))}
        </ul>
        <dl>
          {cart.total_monthly > 0 && <div><dt>Abonnement</dt><dd>{fmt(cart.total_monthly)} DA / mois HT</dd></div>}
          {cart.total_once > 0 && <div><dt>Services ponctuels</dt><dd>{fmt(cart.total_once)} DA HT</dd></div>}
        </dl>
        <p className="muted small">Cette page se met à jour toute seule. Une fois la commande confirmée, vos identifiants d’espace client vous sont envoyés pour valider chaque contenu.</p>
      </section>
    </div>
  );
}
