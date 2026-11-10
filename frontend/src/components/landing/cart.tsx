'use client';
// Panier du site : formule (une seule), services à prix fixe et prestations sur devis.
// Le navigateur ne garde que des références ; les prix sont recalculés par l'API à l'envoi.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_URL, clearSession, getToken, getUser, User } from '@/lib/api';

export type CartItem = { kind: 'offer' | 'service' | 'devis'; ref: string; label: string; months?: number; quantity: number; unit_price: number };
type Ctx = {
  items: CartItem[];
  count: number;
  add: (item: Omit<CartItem, 'quantity'> & { quantity?: number }, from?: HTMLElement | null) => void;
  setQty: (key: string, q: number) => void;
  remove: (key: string) => void;
  has: (kind: string, ref: string) => boolean;
  openCart: () => void;
};

const CartCtx = createContext<Ctx | null>(null);
export const keyOf = (i: { kind: string; ref: string }) => `${i.kind}:${i.ref}`;
export const fmt = (n: number) => n.toLocaleString('fr-FR');
export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error('useCart hors CartProvider');
  return c;
}

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* stockage indisponible */ } };

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [open, setOpen] = useState(false);
  const [bump, setBump] = useState(0);
  const [resume, setResume] = useState(false);
  const ready = useRef(false);

  useEffect(() => {
    setItems(read('incom_cart', []));
    ready.current = true;
    // Retour de la connexion ou de l'inscription (?panier=1) : on rouvre le panier à l'étape d'envoi
    const url = new URL(location.href);
    if (url.searchParams.get('panier') === '1') {
      url.searchParams.delete('panier');
      history.replaceState(null, '', url.pathname + url.search + url.hash);
      setResume(true);
      setOpen(true);
    }
  }, []);
  useEffect(() => { if (ready.current) write('incom_cart', items); }, [items]);

  // Petite pastille orange qui vole du bouton jusqu'au panier
  const fly = (from?: HTMLElement | null) => {
    const to = document.querySelector('[data-cart-target]');
    if (!from || !to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = from.getBoundingClientRect();
    const b = to.getBoundingClientRect();
    const dot = document.createElement('span');
    dot.className = 'fly-dot';
    dot.style.left = `${a.left + a.width / 2 - 9}px`;
    dot.style.top = `${a.top + a.height / 2 - 9}px`;
    document.body.appendChild(dot);
    const dx = b.left + b.width / 2 - (a.left + a.width / 2);
    const dy = b.top + b.height / 2 - (a.top + a.height / 2);
    dot.animate(
      [
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.55}px, ${dy - 120}px) scale(1.25)`, opacity: 1, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(0.35)`, opacity: 0.6 },
      ],
      { duration: 720, easing: 'cubic-bezier(.5,0,.3,1)' },
    ).onfinish = () => dot.remove();
  };

  const add: Ctx['add'] = useCallback((item, from) => {
    setItems((prev) => {
      const k = keyOf(item);
      // Une seule formule par panier : la nouvelle remplace l'ancienne
      const base = item.kind === 'offer' ? prev.filter((p) => p.kind !== 'offer') : prev;
      const found = base.find((p) => keyOf(p) === k);
      if (found) return base.map((p) => (keyOf(p) === k ? { ...p, ...item, quantity: item.kind === 'service' ? p.quantity + 1 : 1 } : p));
      return [...base, { ...item, quantity: item.quantity ?? 1 }];
    });
    fly(from);
    window.setTimeout(() => setBump((b) => b + 1), 650);
  }, []);

  const setQty = useCallback((k: string, q: number) => setItems((prev) => prev.map((p) => (keyOf(p) === k ? { ...p, quantity: Math.max(1, Math.min(50, q)) } : p))), []);
  const remove = useCallback((k: string) => setItems((prev) => prev.filter((p) => keyOf(p) !== k)), []);
  const has = useCallback((kind: string, ref: string) => items.some((p) => p.kind === kind && p.ref === ref), [items]);
  const count = items.reduce((s, i) => s + (i.kind === 'service' ? i.quantity : 1), 0);

  return (
    <CartCtx.Provider value={{ items, count, add, setQty, remove, has, openCart: () => setOpen(true) }}>
      {children}
      <CartButtonPortal count={count} bump={bump} onOpen={() => setOpen(true)} />
      <CartDrawer open={open} onClose={() => setOpen(false)} items={items} setItems={setItems} resume={resume} />
    </CartCtx.Provider>
  );
}

// Le bouton vit dans la barre de navigation, rendu à la place du marqueur [data-cart-slot]
function CartButtonPortal({ count, bump, onOpen }: { count: number; bump: number; onOpen: () => void }) {
  const [slot, setSlot] = useState<Element | null>(null);
  useEffect(() => setSlot(document.querySelector('[data-cart-slot]')), []);
  if (!slot) return null;
  return createPortal(
    <button type="button" className="cart-btn" data-cart-target onClick={onOpen} aria-label={`Ouvrir le panier, ${count} article${count > 1 ? 's' : ''}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4h3l2.4 11.2a1 1 0 0 0 1 .8h8.9a1 1 0 0 0 1-.8L21 8H7" /><circle cx="10" cy="20" r="1.3" /><circle cx="18" cy="20" r="1.3" /></svg>
      <span>Panier</span>
      <b key={bump} className={count ? 'n on' : 'n'}>{count}</b>
    </button>,
    slot,
  );
}

const AUTH_NEXT = encodeURIComponent('/?panier=1');

function CartDrawer({ open, onClose, items, setItems, resume }: { open: boolean; onClose: () => void; items: CartItem[]; setItems: (v: CartItem[]) => void; resume: boolean }) {
  const { setQty, remove } = useCart();
  const [stage, setStage] = useState<'cart' | 'form' | 'done'>('cart');
  const [state, setState] = useState<'idle' | 'sending' | 'error'>('idle');
  const [error, setError] = useState('');
  const [code, setCode] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const panel = useRef<HTMLDivElement>(null);

  // Le compte client (connexion faite sur /dashboard, même domaine) est relu à chaque ouverture
  useEffect(() => { if (open) setUser(getToken() ? getUser() : null); }, [open]);
  useEffect(() => { if (resume) setStage('form'); }, [resume]);
  const signOut = () => { clearSession(); setUser(null); };

  useEffect(() => {
    if (!open) return;
    document.documentElement.classList.add('cart-open');
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    window.setTimeout(() => panel.current?.querySelector<HTMLElement>('button, input, a')?.focus(), 80);
    return () => { window.removeEventListener('keydown', k); document.documentElement.classList.remove('cart-open'); };
  }, [open, onClose]);
  useEffect(() => { if (!open && stage === 'done') setStage('cart'); }, [open, stage]);

  const offer = items.find((i) => i.kind === 'offer');
  const once = items.filter((i) => i.kind === 'service').reduce((s, i) => s + i.unit_price * i.quantity, 0);
  const devis = items.filter((i) => i.kind === 'devis').length;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    setState('sending');
    try {
      const res = await fetch(`${API_URL}/public/carts`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ message: data.message, items: items.map(({ kind, ref, months, quantity }) => ({ kind, ref, months, quantity })) }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 401) { signOut(); setState('idle'); return; }
      if (!res.ok) throw new Error(json.error);
      setCode(json.code);
      write('incom_orders', [json.code, ...read<string[]>('incom_orders', []).filter((c) => c !== json.code)].slice(0, 10));
      setItems([]);
      setStage('done');
      setState('idle');
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Envoi impossible. Réessayez dans un instant.');
      setState('error');
    }
  }

  return (
    <div className={`drawer-root ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="drawer-scrim" onClick={onClose} />
      <div ref={panel} className="drawer" role="dialog" aria-modal="true" aria-labelledby="cart-title" inert={!open}>
        <header className="drawer-head">
          <h2 id="cart-title">{stage === 'done' ? 'Demande envoyée' : stage === 'form' ? (user ? 'Finaliser la demande' : 'Votre compte client') : 'Votre panier'}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer le panier">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </header>

        {stage === 'done' ? (
          <div className="drawer-body done">
            <div className="check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" /><path d="M15 27l7 7 15-16" /></svg></div>
            <p>Votre code de suivi</p>
            <p className="code">{code}</p>
            <p className="muted">Un conseiller vous appelle sous 24 h ouvrées pour confirmer votre commande. Gardez ce code : il vous permet de suivre chaque étape.</p>
            <a className="btn btn-primary btn-block" href={`/suivi/${code}`}>Suivre ma commande</a>
            <a className="btn btn-ghost btn-block" href="/dashboard/mes-demandes">Voir toutes mes demandes</a>
          </div>
        ) : items.length === 0 ? (
          <div className="drawer-body empty">
            <div className="empty-art" aria-hidden="true"><span /><span /><span /></div>
            <p>Votre panier est vide.</p>
            <p className="muted">Choisissez une formule, ajoutez des services ou demandez un devis pour un métier.</p>
            <a className="btn btn-primary" href="#offres" onClick={onClose}>Voir les formules</a>
            <a className="link" href="/suivi" style={{ marginTop: 8 }}>J’ai déjà un code de suivi</a>
          </div>
        ) : stage === 'cart' ? (
          <>
            <ul className="drawer-body lines">
              {items.map((i) => (
                <li key={keyOf(i)} className={`line k-${i.kind}`}>
                  <span className="dot" aria-hidden="true" />
                  <div className="what">
                    <b>{i.label}</b>
                    <small>{i.kind === 'offer' ? `${fmt(i.unit_price)} DA par mois, engagement ${i.months} mois` : i.kind === 'devis' ? 'Sur devis : un conseiller chiffre votre besoin' : `${fmt(i.unit_price)} DA l’unité`}</small>
                  </div>
                  {i.kind === 'service' && (
                    <div className="qty" role="group" aria-label={`Quantité, ${i.label}`}>
                      <button type="button" onClick={() => setQty(keyOf(i), i.quantity - 1)} aria-label="Retirer un">−</button>
                      <output>{i.quantity}</output>
                      <button type="button" onClick={() => setQty(keyOf(i), i.quantity + 1)} aria-label="Ajouter un">+</button>
                    </div>
                  )}
                  <span className="amt">{i.kind === 'devis' ? 'Devis' : `${fmt(i.kind === 'offer' ? i.unit_price * (i.months || 1) : i.unit_price * i.quantity)} DA`}</span>
                  <button type="button" className="rm" onClick={() => remove(keyOf(i))} aria-label={`Retirer ${i.label}`}>
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
                  </button>
                </li>
              ))}
            </ul>
            <footer className="drawer-foot">
              <dl>
                {offer && <div><dt>Abonnement</dt><dd>{fmt(offer.unit_price)} DA / mois</dd></div>}
                {once > 0 && <div><dt>Services ponctuels</dt><dd>{fmt(once)} DA</dd></div>}
                {devis > 0 && <div><dt>Sur devis</dt><dd>{devis} prestation{devis > 1 ? 's' : ''}</dd></div>}
              </dl>
              <p className="muted small">Montants HT. Aucun paiement en ligne : un conseiller confirme avec vous avant toute facturation.</p>
              <button type="button" className="btn btn-accent btn-block" onClick={() => setStage('form')}>Passer la commande</button>
            </footer>
          </>
        ) : !user ? (
          <div className="drawer-body form-drawer account-gate">
            <button type="button" className="back" onClick={() => setStage('cart')}>← Revenir au panier</button>
            <p className="gate-title">Un compte client est nécessaire pour envoyer votre demande.</p>
            <p className="muted">Il vous permet de recevoir votre devis, de suivre chaque commande et d’échanger avec votre conseiller. Votre panier reste enregistré pendant la création du compte.</p>
            <a className="btn btn-accent btn-block" href={`/dashboard/inscription?next=${AUTH_NEXT}`}>Créer mon compte</a>
            <a className="btn btn-ghost btn-block" href={`/dashboard/connexion?next=${AUTH_NEXT}`}>J’ai déjà un compte</a>
          </div>
        ) : (
          <form className="drawer-body form-drawer" onSubmit={submit}>
            <button type="button" className="back" onClick={() => setStage('cart')}>← Revenir au panier</button>
            <div className="who">
              <span>Envoyée au nom de</span>
              <b>{user.name}</b>
              <small>{user.email}</small>
              <button type="button" className="link" onClick={signOut}>Ce n’est pas vous ? Changer de compte</button>
            </div>
            <label className="field"><span>Précisions</span><textarea className="input" name="message" placeholder="Votre activité, vos délais, vos questions" /></label>
            <p className="error" aria-live="polite">{state === 'error' ? error : ''}</p>
            <button type="submit" className="btn btn-accent btn-block" disabled={state === 'sending'}>{state === 'sending' ? 'Envoi…' : `Envoyer ma demande (${items.length} article${items.length > 1 ? 's' : ''})`}</button>
          </form>
        )}
      </div>
    </div>
  );
}

// Bouton « ajouter » réutilisable, avec état « dans le panier »
export function AddButton({ item, label = 'Ajouter au panier', className = 'btn btn-primary' }: { item: Omit<CartItem, 'quantity'>; label?: string; className?: string }) {
  const { add, has, openCart } = useCart();
  const inCart = has(item.kind, item.ref) && item.kind !== 'service';
  const [pulse, setPulse] = useState(false);
  return (
    <button
      type="button"
      className={`${className} add ${inCart ? 'in' : ''} ${pulse ? 'pulse' : ''}`}
      onClick={(e) => {
        if (inCart && item.kind === 'devis') return openCart();
        add(item, e.currentTarget);
        setPulse(true);
        window.setTimeout(() => setPulse(false), 500);
      }}
    >
      <span className="add-ico" aria-hidden="true">{inCart ? '✓' : '+'}</span>
      {inCart ? (item.kind === 'offer' ? 'Formule dans le panier' : 'Dans le panier') : label}
    </button>
  );
}
