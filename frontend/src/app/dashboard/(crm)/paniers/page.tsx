'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Badge, Empty, Modal, PageHead, Tabs, useAction, useData } from '@/components/ui';
import { api, API_URL, fmtDA, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { CART_STATUS } from '@/lib/labels';
import NextStep, { type Step } from '@/components/NextStep';
import SignFields, { EMPTY_SIGN, signBody, signReady, type Sign } from '@/components/SignFields';
import { EMPTY_CUSTOM } from '@/components/CustomOffer';

// Une formule par devis : un pack du catalogue (offer) ou une formule sur mesure (custom : quotas et prix choisis)
type Line = { kind: 'offer' | 'service' | 'devis' | 'custom'; ref: string; label: string; months?: number; quantity: number; price: number;
  posts_month?: number; stories_month?: number; reels_month?: number };
const FORMULA = ['offer', 'custom'];

// Demande de devis saisie par un commercial pour un prospect ou un client de l'Univers
function NewQuote({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const [name, setName] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [picked, setPicked] = useState<any>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [message, setMessage] = useState('');
  const [code, setCode] = useState('');
  const { data: offers } = useData<any[]>('/offers');
  const { data: services } = useData<any[]>('/services');
  const [devis, setDevis] = useState<any[]>([]);
  useEffect(() => { fetch(`${API_URL}/public/devis`).then((r) => r.json()).then(setDevis).catch(() => {}); }, []);
  useEffect(() => {
    if (picked || name.length < 2) { setMatches([]); return; }
    const t = setTimeout(() => api(`/prospects/lookup?name=${encodeURIComponent(name)}`).then(setMatches).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [name, picked]);
  const add = (l: Line) => setLines((prev) => {
    const base = FORMULA.includes(l.kind) ? prev.filter((x) => !FORMULA.includes(x.kind)) : prev;
    return base.some((x) => x.kind === l.kind && x.ref === l.ref) ? base : [...base, l];
  });
  const setLine = (i: number, patch: Partial<Line>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  const total = lines.filter((l) => l.kind === 'service').reduce((sum, l) => sum + l.price * l.quantity, 0);
  const offer = lines.find((l) => FORMULA.includes(l.kind));
  const customOk = !lines.some((l) => l.kind === 'custom' && (!l.price || !((l.posts_month || 0) + (l.stories_month || 0) + (l.reels_month || 0))));

  const submit = () => run(async () => {
    const r = await api('/carts', { body: { prospect_id: picked.id, message, items: lines.map(({ kind, ref, months, quantity, price, posts_month, stories_month, reels_month }) => (
      kind === 'custom' ? { kind, ref, months, quantity, unit_price: price, posts_month, stories_month, reels_month } : { kind, ref, months, quantity })) } });
    setCode(r.code);
  }, 'Demande de devis enregistrée', onDone);

  return (
    <Modal wide title="Nouvelle demande de devis" onClose={onClose}
      footer={code ? <button className="btn btn-dark" onClick={onClose}>Fermer</button> : <>
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!picked || !lines.length || !customOk} onClick={submit}>Enregistrer la demande</button>
      </>}>
      {code ? (
        <div className="effects">
          <div>✓ Demande enregistrée avec le code <b>{code}</b>.</div>
          <div>Le client suit l’avancement sur <a className="link" href={`/suivi/${code}`} target="_blank" rel="noreferrer">in-com-dz.com/suivi/{code}</a>. Vous en êtes le conseiller.</div>
        </div>
      ) : <>
        <label className="field"><span>Prospect ou client (fiche de l’Univers)</span>
          <input className="input" value={name} autoFocus placeholder="Commencez à taper le nom…" onChange={(e) => { setName(e.target.value); setPicked(null); }} />
        </label>
        {!picked && matches.length > 0 && (
          <div className="table-wrap"><table className="t"><tbody>
            {matches.map((m) => (
              <tr key={m.id} className="click" onClick={() => { setPicked(m); setName(m.name); }}>
                <td><b>{m.name}</b><span className="sub">{m.sector || '—'} · {m.phone || 'sans téléphone'}</span></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {!picked && name.length >= 2 && matches.length === 0 && <p style={{ margin: 0, fontSize: 13.5, color: 'var(--muted)' }}>Aucune fiche à ce nom : créez-la d’abord en déclarant un appel ou une visite dans Reporting.</p>}
        {picked && <div className="notice" style={{ background: 'var(--info-soft)', color: 'var(--navy)' }}>Demande pour <b>{picked.name}</b>{picked.phone ? ` · ${picked.phone}` : ''}</div>}

        <div className="grid-3">
          <label className="field"><span>Formule : pack ou sur mesure</span>
            <select className="select" value="" onChange={(e) => {
              if (e.target.value === 'custom') { add({ kind: 'custom', ref: 'custom', label: 'Formule sur mesure', months: 6, quantity: 1, price: 0, posts_month: 0, stories_month: 0, reels_month: 0 }); return; }
              const o = offers?.find((x) => x.code === e.target.value);
              if (o) add({ kind: 'offer', ref: o.code, label: `Pack ${o.name}`, months: 6, quantity: 1, price: o.price_month });
            }}><option value="">Ajouter une formule…</option>{offers?.filter((o) => o.active).map((o) => <option key={o.id} value={o.code}>Pack {o.name} · {fmtDA(o.price_month)} / mois</option>)}
              <option value="custom">Formule sur mesure (posts, stories, reels et prix au choix)</option></select>
          </label>
          <label className="field"><span>Service à la carte</span>
            <select className="select" value="" onChange={(e) => {
              const sv = services?.find((x) => String(x.id) === e.target.value);
              if (sv) add({ kind: 'service', ref: String(sv.id), label: sv.name, quantity: 1, price: sv.price });
            }}><option value="">Ajouter un service…</option>{services?.filter((x) => x.active !== 0).map((x) => <option key={x.id} value={x.id}>{x.name} · {fmtDA(x.price)}</option>)}</select>
          </label>
          <label className="field"><span>Prestation sur devis</span>
            <select className="select" value="" onChange={(e) => {
              const d = devis.find((x) => x.ref === e.target.value);
              if (d) add({ kind: 'devis', ref: d.ref, label: d.label, quantity: 1, price: 0 });
            }}><option value="">Ajouter une prestation…</option>{devis.map((d) => <option key={d.ref} value={d.ref}>{d.label}</option>)}</select>
          </label>
        </div>

        {lines.length > 0 && (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Article</th><th>Détail</th><th>Montant</th><th></th></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={`${l.kind}-${l.ref}`}>
                  <td><b>{l.label}</b></td>
                  <td>
                    {l.kind === 'offer' && <select className="select" style={{ height: 32 }} value={l.months} onChange={(e) => setLine(i, { months: Number(e.target.value) })}><option value={3}>3 mois</option><option value={6}>6 mois</option></select>}
                    {l.kind === 'custom' && (
                      <div className="custom-line">
                        {([['posts_month', 'Posts / mois'], ['stories_month', 'Stories / mois'], ['reels_month', 'Reels / mois']] as const).map(([k, lab]) => (
                          <label key={k}><span>{lab}</span><input className="input" type="number" min={0} value={l[k] || 0} onChange={(e) => setLine(i, { [k]: Math.max(0, Number(e.target.value) || 0) })} /></label>
                        ))}
                        <label><span>Prix / mois (DA)</span><input className="input" type="number" min={0} value={l.price || 0} onChange={(e) => setLine(i, { price: Math.max(0, Number(e.target.value) || 0) })} /></label>
                        <label><span>Durée</span><select className="select" value={l.months} onChange={(e) => setLine(i, { months: Number(e.target.value) })}><option value={1}>1 mois</option><option value={3}>3 mois</option><option value={6}>6 mois</option><option value={12}>12 mois</option></select></label>
                      </div>
                    )}
                    {l.kind === 'service' && <input className="input" style={{ height: 32, width: 80 }} type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />}
                    {l.kind === 'devis' && <span className="sub">Sur devis</span>}
                  </td>
                  <td>{l.kind === 'devis' ? '—' : FORMULA.includes(l.kind) ? `${fmtDA(l.price)} / mois` : fmtDA(l.price * l.quantity)}</td>
                  <td><button className="btn btn-ghost btn-xs" onClick={() => setLines(lines.filter((_, k) => k !== i))}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        {lines.some((l) => l.kind === 'custom') && !customOk && <p className="form-err" style={{ margin: 0 }}>Formule sur mesure : indiquez au moins un nombre de posts, stories ou reels, et le prix mensuel.</p>}
        {(offer || total > 0) && <p style={{ margin: 0, fontSize: 14 }}>{offer && <>Abonnement : <b>{fmtDA(offer.price)} / mois</b> sur {offer.months} mois. </>}{total > 0 && <>Services : <b>{fmtDA(total)}</b>.</>} Les prix sont recalculés à l’enregistrement.</p>}
        <label className="field"><span>Précisions (visibles par l’équipe)</span><textarea className="textarea" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Besoin du client, délais, budget…" /></label>
      </>}
    </Modal>
  );
}

// Étapes posées à la main avant la signature. Ensuite le devis suit son dossier :
// « Client signé » → paiement confirmé (en production) → livré, sans action sur le panier.
const NEXT: Record<string, string[]> = {
  recue: ['contactee', 'annulee'],
  contactee: ['devis_envoye', 'annulee'],
  devis_envoye: ['annulee'],
};

function cartStep(c: any): Step {
  const who = c.company || c.name;
  switch (c.status) {
    case 'recue': return { title: 'Appeler le client', you: `Appelez ${who}${c.phone ? ` au ${c.phone}` : ''} sous 24 h, puis passez à « Client contacté ».`, then: 'le client voit l’étape sur sa page de suivi.' };
    case 'contactee': return { title: 'Envoyer le devis', you: 'Envoyez le devis au client, puis passez à « Devis envoyé ». S’il accepte tout de suite, cliquez « Client signé ».', then: 'le client est prévenu que son devis est prêt.' };
    case 'devis_envoye': return { title: 'Obtenir la signature', you: 'Relancez le client. Quand il accepte, cliquez « Client signé » avec la formule et les documents.', then: 'le dossier est créé et le recouvrement reçoit « Encaisser ».' };
    case 'confirmee': return { tone: 'wait', title: 'Paiement attendu', you: 'Le recouvrement encaisse et confirme le paiement dans le dossier. Rien à faire sur ce devis.', then: 'l’équipe est attribuée, la production démarre et ce devis passe « En production » tout seul.' };
    case 'en_production': return { tone: 'wait', title: 'En production', you: 'L’équipe produit ; le client valide chaque contenu.', then: 'quand tout est produit, le devis passe « Livrée » et vous êtes prévenu.' };
    case 'livree': return { tone: 'done', title: 'Livré', you: 'Appelez le client pour son avis et proposez la suite (extra, renouvellement).' };
    default: return { tone: 'done', title: 'Devis clôturé' };
  }
}

function CartModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const { data: c, reload } = useData<any>(`/carts/${id}`);
  const { data: offers } = useData<any[]>('/offers');
  const [note, setNote] = useState('');
  const [signing, setSigning] = useState(false);
  const [sign, setSign] = useState<Sign>(EMPTY_SIGN);
  const move = (status: string) =>
    run(() => api(`/carts/${id}/status`, { body: { status, note } }), `Statut : ${CART_STATUS[status][0]}`, () => { setNote(''); reload(); onDone(); });
  const startSign = () => {
    // La formule du devis est reprise d'office : pack, ou formule sur mesure avec ses quotas et ses services
    const sur = c?.items.find((i: any) => i.kind === 'custom');
    if (sur) {
      setSign({ ...EMPTY_SIGN, offer_id: 'custom', engagement_months: String(sur.months || 6), custom: {
        ...EMPTY_CUSTOM, posts_month: sur.posts_month || 0, stories_month: sur.stories_month || 0, reels_month: sur.reels_month || 0, price_month: sur.unit_price,
        items: c.items.filter((i: any) => i.kind === 'service').map((i: any) => ({ service_id: i.ref, label: i.label, quantity: i.quantity, unit_price: i.unit_price })),
      } });
    } else {
      const pack = c?.items.find((i: any) => i.kind === 'offer');
      const o = offers?.find((x) => x.code === pack?.ref);
      setSign({ ...EMPTY_SIGN, offer_id: o ? String(o.id) : '', engagement_months: String(pack?.months || 6) });
    }
    setSigning(true);
  };
  return (
    <Modal wide title={c ? `Panier ${c.code}` : 'Panier'} onClose={onClose}>
      {c && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="grid-2">
            <div><b>{c.name}</b>{c.company && <> · {c.company}</>}<span className="sub" style={{ display: "block" }}>{[c.phone, c.email].filter(Boolean).join(' · ')}</span></div>
            <div style={{ textAlign: 'right' }}><Badge map={CART_STATUS} value={c.status} /><span className="sub" style={{ display: "block" }}>{c.assigned_name ? `Conseiller : ${c.assigned_name}` : 'Pas encore de conseiller'}</span></div>
          </div>
          {(c.client_type || c.client_activity) && (
            <dl className="kv">
              <dt>Compte</dt><dd>{c.client_type === 'entreprise' ? 'Entreprise' : 'Particulier'}{c.client_activity && c.client_activity !== 'Particulier' && ` · ${c.client_activity}`}</dd>
              {(c.client_address || c.client_city) && <><dt>Adresse</dt><dd>{[c.client_address, c.client_city].filter(Boolean).join(', ')}</dd></>}
              {(c.client_website || c.client_social) && <><dt>En ligne</dt><dd>{[c.client_website, c.client_social].filter(Boolean).map((l: string) => <a key={l} className="link" href={l} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>{l.replace(/^https?:\/\//, '')}</a>)}</dd></>}
              {(c.client_nif || c.client_rc) && <><dt>NIF / RC</dt><dd>{[c.client_nif, c.client_rc].filter(Boolean).join(' · ')}</dd></>}
            </dl>
          )}
          {c.message && <p style={{ color: 'var(--muted)', margin: 0 }}>« {c.message} »</p>}
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
              <tbody>
                {c.items.map((i: any) => (
                  <tr key={i.id}>
                    <td><b>{i.label}</b><span className="sub">{i.kind === 'offer' ? 'Pack' : i.kind === 'custom' ? 'Formule sur mesure' : i.kind === 'devis' ? 'Sur devis' : 'Service'}</span></td>
                    <td>{i.quantity}</td>
                    <td>{i.kind === 'devis' ? 'Sur devis' : FORMULA.includes(i.kind) ? `${fmtDA(i.unit_price)} / mois` : fmtDA(i.unit_price)}</td>
                    <td>{i.kind === 'devis' ? '—' : fmtDA(i.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h4 style={{ margin: '0 0 8px' }}>Historique, visible par le client sur sa page de suivi</h4>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
              {c.events.map((e: any, k: number) => (
                <li key={k}><Badge map={CART_STATUS} value={e.status} /> <span style={{ color: 'var(--muted)', fontSize: 13 }}>{fmtDate(e.created_at, true)}{e.user_name && ` · ${e.user_name}`}</span>{e.note && <div style={{ fontSize: 14 }}>{e.note}</div>}</li>
              ))}
            </ol>
          </div>
          <NextStep step={cartStep(c)}>
            {['recue', 'contactee', 'devis_envoye'].includes(c.status) && !signing && <button className="btn btn-ok btn-sm" onClick={startSign}>Client signé</button>}
          </NextStep>
          {signing && (
            <div style={{ display: 'grid', gap: 10 }}>
              <SignFields value={sign} onChange={setSign} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-ghost" onClick={() => setSigning(false)}>Annuler</button>
                <button className="btn btn-primary" disabled={!signReady(sign)} onClick={() => run(() => api(`/carts/${id}/sign`, { body: signBody(sign) }),
                  'Client signé : dossier créé, le recouvrement encaisse', () => { setSigning(false); reload(); onDone(); })}>Enregistrer la signature</button>
              </div>
            </div>
          )}
          {NEXT[c.status] && !signing && (
            <div style={{ display: 'grid', gap: 10 }}>
              <label className="field"><span>Note pour le client (facultative)</span>
                <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex. : devis envoyé par e-mail, rendez-vous fixé mardi à 10 h" />
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {NEXT[c.status].map((s) => (
                  <button key={s} className={`btn ${s === 'annulee' ? 'btn-ghost' : 'btn-primary'}`} onClick={() => move(s)}>
                    {s === 'annulee' ? 'Annuler le panier' : `Passer à « ${CART_STATUS[s][0]} »`}
                  </button>
                ))}
              </div>
            </div>
          )}
          <p style={{ fontSize: 13, color: 'var(--muted)', margin: 0 }}>Lien de suivi du client : <a className="link" href={`/suivi/${c.code}`} target="_blank" rel="noreferrer">/suivi/{c.code}</a></p>
        </div>
      )}
    </Modal>
  );
}

export default function Paniers() {
  const me = useMe();
  const run = useAction();
  const [quote, setQuote] = useState(false);
  const [tab, setTab] = useState('actifs');
  const { data: rows, reload } = useData<any[]>('/carts');
  const [open, setOpen] = useState<number | null>(null);
  const active = rows?.filter((r) => !['livree', 'annulee'].includes(r.status)) || [];
  const shown = tab === 'actifs' ? active : rows?.filter((r) => ['livree', 'annulee'].includes(r.status)) || [];
  return (
    <>
      <PageHead title="Paniers et devis" sub="Paniers envoyés depuis le site et demandes de devis saisies par l’équipe. Chaque changement de statut est visible par le client sur sa page de suivi."
        actions={<button className="btn btn-primary" onClick={() => setQuote(true)}>+ Demande de devis</button>} />
      <Tabs value={tab} onChange={setTab} items={[['actifs', 'En cours', active.length], ['clos', 'Clôturés']]} />
      {rows && shown.length === 0 ? <Empty>Aucun panier ici.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Code</th><th>Client</th><th>Contenu</th><th>Mensuel</th><th>Ponctuel</th><th>Statut</th><th>Reçu le</th>{me.role === 'admin' && <th />}</tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r.id)} style={{ cursor: 'pointer' }}>
                  <td><b style={{ fontFamily: 'var(--font-mono, monospace)' }}>{r.code}</b></td>
                  <td>{r.company || r.name}<span className="sub">{r.phone}{r.created_by_name ? ` · saisi par ${r.created_by_name}` : ' · site'}</span></td>
                  <td style={{ maxWidth: 340, fontSize: 13.5, color: 'var(--muted)' }}>{r.summary}</td>
                  <td>{r.total_monthly ? fmtDA(r.total_monthly) : '—'}</td>
                  <td>{r.total_once ? fmtDA(r.total_once) : '—'}</td>
                  <td><Badge map={CART_STATUS} value={r.status} />{r.assigned_name && <span className="sub">{r.assigned_name}</span>}</td>
                  <td>{fmtDate(r.created_at, true)}</td>
                  {me.role === 'admin' && <td onClick={(e) => e.stopPropagation()}>
                    <button className="btn btn-ghost btn-xs danger-text" onClick={() => confirm(`Supprimer le panier ${r.code} ? Le client ne pourra plus le suivre.`) && run(() => api(`/carts/${r.id}`, { method: 'DELETE' }), 'Panier supprimé', reload)}>Supprimer</button>
                  </td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <CartModal id={open} onClose={() => setOpen(null)} onDone={reload} />}
      {quote && <NewQuote onClose={() => setQuote(false)} onDone={reload} />}
    </>
  );
}
