'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Badge, Modal, PageHead, useAction, useData, Empty } from '@/components/ui';
import { api, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DEPARTMENTS, TICKET_STATUS } from '@/lib/labels';

function NewTicket({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const run = useAction();
  const { data: clients } = useData<any[]>(me.role !== 'client' ? '/clients' : null);
  const [f, setF] = useState<any>({ department: 'commercial' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Nouveau ticket" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!f.subject} onClick={() => run(() => api('/tickets', { body: f }), 'Ticket envoyé', () => { onDone(); onClose(); })}>Envoyer</button></>}>
      {me.role !== 'client' && (
        <label className="field"><span>Client</span><select className="select" onChange={set('prospect_id')}><option value="">—</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      )}
      <label className="field"><span>Service concerné</span>
        <select className="select" value={f.department} onChange={set('department')}>{Object.entries(DEPARTMENTS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      </label>
      <label className="field"><span>Sujet</span><input className="input" onChange={set('subject')} /></label>
      <label className="field"><span>Message</span><textarea className="textarea" onChange={set('message')} /></label>
    </Modal>
  );
}

export default function Sav() {
  const me = useMe();
  const run = useAction();
  const { data: rows, reload } = useData<any[]>('/tickets');
  const [create, setCreate] = useState(false);
  const staff = me.role !== 'client';
  return (
    <>
      <PageHead
        title={staff ? 'SAV' : 'Support'}
        sub={staff ? 'Un ticket commercial revient au sédentaire qui a traité le dossier ; sinon le responsable l’attribue.' : 'Une question, une demande ? Notre équipe vous répond.'}
        actions={<button className="btn btn-primary" onClick={() => setCreate(true)}>+ Nouveau ticket</button>}
      />
      {rows?.length === 0 ? <Empty>Aucun ticket.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Sujet</th>{staff && <th>Client</th>}<th>Service</th><th>Statut</th><th>Pris en charge</th><th>Créé le</th><th></th></tr></thead>
            <tbody>
              {rows?.map((t) => (
                <tr key={t.id}>
                  <td><b>{t.subject}</b><span className="sub">{t.message}</span></td>
                  {staff && <td>{t.client_name}</td>}
                  <td>{DEPARTMENTS[t.department]}</td>
                  <td><Badge map={TICKET_STATUS} value={t.status} /></td>
                  <td>{t.assigned_name || '—'}</td>
                  <td>{fmtDate(t.created_at, true)}</td>
                  <td className="row-actions">
                    {staff && t.status === 'ouvert' && <button className="btn btn-dark btn-xs" onClick={() => run(() => api(`/tickets/${t.id}/take`, { method: 'POST' }), 'Ticket pris en charge', reload)}>Prendre en charge</button>}
                    {staff && t.status !== 'resolu' && <button className="btn btn-ghost btn-xs" onClick={() => run(() => api(`/tickets/${t.id}/resolve`, { method: 'POST' }), 'Ticket résolu', reload)}>Résolu</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {create && <NewTicket onClose={() => setCreate(false)} onDone={reload} />}
    </>
  );
}
