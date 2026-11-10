'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Badge, Modal, PageHead, useAction, useData, Empty } from '@/components/ui';
import { api, fmtDA, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { ORDER_STATUS } from '@/lib/labels';

function NewOrder({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const { data: services } = useData<any[]>('/services');
  const [sid, setSid] = useState('');
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState('');
  const s = services?.find((x) => String(x.id) === sid);
  return (
    <Modal title="Commander un service en extra" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!sid} onClick={() => run(() => api('/orders', { body: { service_id: sid, quantity: qty, note } }), 'Commande envoyée : un commercial vous contacte', () => { onDone(); onClose(); })}>Envoyer la commande</button></>}>
      <div style={{ display: 'grid', gap: 8 }}>
        {services?.map((x) => (
          <label key={x.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', padding: 14, margin: 0, borderColor: sid === String(x.id) ? 'var(--orange)' : undefined }}>
            <span><input type="radio" name="s" value={x.id} checked={sid === String(x.id)} onChange={(e) => setSid(e.target.value)} style={{ marginRight: 10 }} />{x.name}</span>
            <b>{fmtDA(x.price)}</b>
          </label>
        ))}
      </div>
      <div className="grid-2">
        <label className="field"><span>Quantité</span><input type="number" min={1} className="input" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label>
        <div className="field"><span>Total indicatif</span><b style={{ fontFamily: 'var(--font-slab)', fontSize: 24 }}>{s ? fmtDA(s.price * qty) : '—'}</b></div>
      </div>
      <label className="field"><span>Précisions</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></label>
    </Modal>
  );
}

export default function Commandes() {
  const me = useMe();
  const run = useAction();
  const { data: rows, reload } = useData<any[]>('/orders');
  const [create, setCreate] = useState(false);
  const isClient = me.role === 'client';
  const isCommercial = ['commercial_sedentaire', 'responsable_commercial', 'admin'].includes(me.role);
  return (
    <>
      <PageHead
        title={isClient ? 'Commander un extra' : 'Commandes client'}
        sub={isClient ? 'Ajoutez un service à votre formule. Les prix sont fixes ; un commercial confirme avec vous.'
          : me.role === 'recouvrement' ? 'Commandes validées par les commerciaux : clients prêts à payer.'
          : 'Demandes de services en extra (cross-sell). Vous validez la commande, pas le prix : elle part ensuite au recouvrement.'}
        actions={isClient && <button className="btn btn-primary" onClick={() => setCreate(true)}>+ Nouvelle commande</button>}
      />
      {rows?.length === 0 ? <Empty>Aucune commande.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Service</th>{!isClient && <th>Client</th>}<th>Qté</th><th>Montant</th><th>Statut</th><th>Date</th><th></th></tr></thead>
            <tbody>
              {rows?.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.service}</b>{o.note && <span className="sub">{o.note}</span>}</td>
                  {!isClient && <td>{o.client_name}<span className="sub">{o.phone}</span></td>}
                  <td>{o.quantity}</td>
                  <td>{fmtDA(o.price)}</td>
                  <td><Badge map={ORDER_STATUS} value={o.status} />{o.validated_by_name && <span className="sub">par {o.validated_by_name}</span>}</td>
                  <td>{fmtDate(o.created_at)}</td>
                  <td className="row-actions">
                    {isCommercial && o.status === 'en_attente' && <>
                      <button className="btn btn-dark btn-xs" onClick={() => run(() => api(`/orders/${o.id}/validate`, { method: 'POST' }), 'Commande validée → recouvrement', reload)}>Valider</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => run(() => api(`/orders/${o.id}/cancel`, { method: 'POST' }), 'Commande annulée', reload)}>Annuler</button>
                    </>}
                    {me.role === 'recouvrement' && o.status === 'recouvrement' && <button className="btn btn-ok btn-xs" onClick={() => run(() => api(`/orders/${o.id}/paid`, { method: 'POST' }), 'Paiement encaissé', reload)}>Encaissée</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {create && <NewOrder onClose={() => setCreate(false)} onDone={reload} />}
    </>
  );
}
