'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Badge, Empty, Modal, PageHead, Tabs, useAction, useData } from '@/components/ui';
import { api, fmtDA, fmtDate } from '@/lib/api';
import { CART_STATUS } from '@/lib/labels';

// Étape suivante proposée au commercial pour chaque statut
const NEXT: Record<string, string[]> = {
  recue: ['contactee', 'annulee'],
  contactee: ['devis_envoye', 'confirmee', 'annulee'],
  devis_envoye: ['confirmee', 'annulee'],
  confirmee: ['en_production', 'annulee'],
  en_production: ['livree'],
};

function CartModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const { data: c, reload } = useData<any>(`/carts/${id}`);
  const [note, setNote] = useState('');
  const move = (status: string) =>
    run(() => api(`/carts/${id}/status`, { body: { status, note } }), `Statut : ${CART_STATUS[status][0]}`, () => { setNote(''); reload(); onDone(); });
  return (
    <Modal wide title={c ? `Panier ${c.code}` : 'Panier'} onClose={onClose}>
      {c && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="grid-2">
            <div><b>{c.name}</b>{c.company && <> · {c.company}</>}<span className="sub" style={{ display: "block" }}>{[c.phone, c.email].filter(Boolean).join(' · ')}</span></div>
            <div style={{ textAlign: 'right' }}><Badge map={CART_STATUS} value={c.status} /><span className="sub" style={{ display: "block" }}>{c.assigned_name ? `Conseiller : ${c.assigned_name}` : 'Pas encore de conseiller'}</span></div>
          </div>
          {c.message && <p style={{ color: 'var(--muted)', margin: 0 }}>« {c.message} »</p>}
          <div className="table-wrap">
            <table className="t">
              <thead><tr><th>Article</th><th>Qté</th><th>Prix</th><th>Total</th></tr></thead>
              <tbody>
                {c.items.map((i: any) => (
                  <tr key={i.id}>
                    <td><b>{i.label}</b><span className="sub">{i.kind === 'offer' ? 'Abonnement' : i.kind === 'devis' ? 'Sur devis' : 'Service'}</span></td>
                    <td>{i.quantity}</td>
                    <td>{i.kind === 'devis' ? 'Sur devis' : i.kind === 'offer' ? `${fmtDA(i.unit_price)} / mois` : fmtDA(i.unit_price)}</td>
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
          {NEXT[c.status] && (
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
  const [tab, setTab] = useState('actifs');
  const { data: rows, reload } = useData<any[]>('/carts');
  const [open, setOpen] = useState<number | null>(null);
  const active = rows?.filter((r) => !['livree', 'annulee'].includes(r.status)) || [];
  const shown = tab === 'actifs' ? active : rows?.filter((r) => ['livree', 'annulee'].includes(r.status)) || [];
  return (
    <>
      <PageHead title="Paniers du site" sub="Commandes composées par les visiteurs sur la landing page. Chaque changement de statut est visible par le client sur sa page de suivi." />
      <Tabs value={tab} onChange={setTab} items={[['actifs', 'En cours', active.length], ['clos', 'Clôturés']]} />
      {rows && shown.length === 0 ? <Empty>Aucun panier ici.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Code</th><th>Client</th><th>Contenu</th><th>Mensuel</th><th>Ponctuel</th><th>Statut</th><th>Reçu le</th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} onClick={() => setOpen(r.id)} style={{ cursor: 'pointer' }}>
                  <td><b style={{ fontFamily: 'var(--font-mono, monospace)' }}>{r.code}</b></td>
                  <td>{r.company || r.name}<span className="sub">{r.phone}</span></td>
                  <td style={{ maxWidth: 340, fontSize: 13.5, color: 'var(--muted)' }}>{r.summary}</td>
                  <td>{r.total_monthly ? fmtDA(r.total_monthly) : '—'}</td>
                  <td>{r.total_once ? fmtDA(r.total_once) : '—'}</td>
                  <td><Badge map={CART_STATUS} value={r.status} />{r.assigned_name && <span className="sub">{r.assigned_name}</span>}</td>
                  <td>{fmtDate(r.created_at, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <CartModal id={open} onClose={() => setOpen(null)} onDone={reload} />}
    </>
  );
}
