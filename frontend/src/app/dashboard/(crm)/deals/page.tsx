'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Badge, Modal, PageHead, Tabs, useAction, useData, Empty } from '@/components/ui';
import { OutcomeModal, ScheduleModal } from '@/components/DealModals';
import { api, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DEAL_STATUS } from '@/lib/labels';

// Correction d'un deal par la direction ou le responsable commercial
function EditDeal({ deal, onClose, onDone }: { deal: any; onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const [f, setF] = useState<any>({ status: deal.status, type: deal.type, notes: deal.notes || '', scheduled_at: deal.scheduled_at ? String(deal.scheduled_at).replace(' ', 'T').slice(0, 16) : '' });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const remove = () => {
    if (!confirm(`Supprimer le deal ${deal.prospect_name} ? Cette action est définitive.`)) return;
    run(() => api(`/deals/${deal.id}`, { method: 'DELETE' }), 'Deal supprimé', () => { onDone(); onClose(); });
  };
  return (
    <Modal title={`Deal · ${deal.prospect_name}`} onClose={onClose}
      footer={<>
        <button className="btn btn-ghost danger-text" style={{ marginRight: 'auto' }} onClick={remove}>Supprimer</button>
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={() => run(() => api(`/deals/${deal.id}`, { method: 'PATCH', body: f }), 'Deal modifié', () => { onDone(); onClose(); })}>Enregistrer</button>
      </>}>
      <div className="grid-2">
        <label className="field"><span>Statut</span>
          <select className="select" value={f.status} onChange={set('status')}>{Object.entries(DEAL_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="field"><span>Type</span>
          <select className="select" value={f.type} onChange={set('type')}><option value="terrain">Terrain</option><option value="bureau">Bureau</option></select>
        </label>
        <label className="field"><span>Rendez-vous</span><input className="input" type="datetime-local" value={f.scheduled_at} onChange={set('scheduled_at')} /></label>
      </div>
      <label className="field"><span>Notes</span><textarea className="textarea" value={f.notes} onChange={set('notes')} /></label>
    </Modal>
  );
}

// Prochaine étape d'un deal, dite à la personne qui regarde : à elle d'agir, ou qui attendre
function dealNext(d: any, meId: number, isManager: boolean): [string, boolean] {
  const mine = d.assigned_to === meId || (!d.assigned_to && d.created_by === meId);
  switch (d.status) {
    case 'a_attribuer': return isManager ? ['À vous : choisir le commercial', true] : ['Attribution par le responsable commercial', false];
    case 'attribue': return mine || isManager ? ['À vous : appeler et programmer le RDV', true] : [`Programmation par ${d.assigned_name || 'le commercial'}`, false];
    case 'programme': return mine || isManager ? ['Après le RDV : enregistrer l’issue', true] : [`RDV de ${d.assigned_name || 'du commercial'}`, false];
    case 'a_relancer': return d.created_by === meId || isManager ? ['À vous : rappeler et fixer une nouvelle date', true] : ['Relance par le créateur du deal', false];
    case 'gagne': return ['Client signé : le dossier suit tout seul', false];
    default: return ['Clos', false];
  }
}

export default function Deals() {
  const me = useMe();
  const run = useAction();
  const isManager = ['admin', 'responsable_commercial'].includes(me.role);
  const { data: rows, reload } = useData<any[]>('/deals');
  const { data: team } = useData<any[]>(isManager ? '/users?role=commercial_terrain,commercial_sedentaire,responsable_commercial' : null);
  const [edit, setEdit] = useState<any>(null);
  const [tab, setTab] = useState('actifs');
  const [sched, setSched] = useState<any>(null);
  const [out, setOut] = useState<any>(null);
  useEffect(() => { const s = new URLSearchParams(window.location.search).get('status'); if (s) setTab(s); }, []);

  const groups: Record<string, (d: any) => boolean> = {
    actifs: (d) => ['a_attribuer', 'attribue', 'programme', 'a_relancer'].includes(d.status),
    a_attribuer: (d) => d.status === 'a_attribuer',
    attribue: (d) => d.status === 'attribue',
    programme: (d) => d.status === 'programme',
    a_relancer: (d) => d.status === 'a_relancer',
    clos: (d) => ['gagne', 'perdu'].includes(d.status),
  };
  const list = (rows || []).filter(groups[tab] || groups.actifs);
  const n = (k: string) => (rows || []).filter(groups[k]).length;

  return (
    <>
      <PageHead
        title="Deals"
        sub={isManager ? 'Attribuez chaque deal à un commercial ou prenez-le en charge vous-même, puis suivez son issue.'
          : me.role === 'commercial_terrain' ? 'Les deals que votre responsable vous attribue.' : 'Les deals nés de vos appels, vos deals bureau et ceux à relancer.'}
      />
      <Tabs value={tab} onChange={setTab} items={[
        ['actifs', 'En cours', n('actifs')],
        ...(isManager ? [['a_attribuer', 'À attribuer', n('a_attribuer')] as [string, string, number]] : []),
        ['attribue', 'À programmer', n('attribue')], ['programme', 'Programmés', n('programme')],
        ['a_relancer', 'À relancer', n('a_relancer')], ['clos', 'Gagnés / perdus'],
      ]} />
      {list.length === 0 ? <Empty>Aucun deal ici.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Prospect</th><th>Type</th><th>Statut</th><th>Créé par</th><th>Attribué à</th><th>RDV</th><th></th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id}>
                  <td><b>{d.prospect_name}</b><span className="sub">{d.sector} · {d.phone} · {d.visits} visites</span></td>
                  <td>{d.type === 'terrain' ? 'Terrain' : 'Bureau'}</td>
                  <td><Badge map={DEAL_STATUS} value={d.status} />{(() => { const [t, act] = dealNext(d, me.id, isManager); return <span className={`next-hint ${act ? '' : 'wait'}`}>{t}</span>; })()}</td>
                  <td>{d.created_by_name}<span className="sub">{fmtDate(d.created_at)}</span></td>
                  <td>
                    {isManager && !['gagne', 'perdu'].includes(d.status) ? (
                      <select className="select" style={{ height: 32, minWidth: 170 }} value={d.assigned_to || ''}
                        onChange={(e) => e.target.value && run(() => api(`/deals/${d.id}/assign`, { body: { user_id: e.target.value } }), Number(e.target.value) === me.id ? 'Deal pris en charge' : 'Deal attribué', reload)}>
                        <option value="">Choisir…</option>
                        <option value={me.id}>Moi ({me.name})</option>
                        {team?.filter((u) => u.id !== me.id).map((u) => <option key={u.id} value={u.id}>{u.name} · {u.role === 'commercial_terrain' ? 'terrain' : u.role === 'commercial_sedentaire' ? 'sédentaire' : 'responsable'}{u.sectors ? ` (${u.sectors})` : ''}</option>)}
                      </select>
                    ) : (d.assigned_name || '—')}
                  </td>
                  <td>{d.scheduled_at ? fmtDate(d.scheduled_at, true) : '—'}</td>
                  <td className="row-actions">
                    {['attribue', 'a_relancer'].includes(d.status) && (d.assigned_to === me.id || d.created_by === me.id || isManager) && (
                      <button className="btn btn-dark btn-xs" onClick={() => setSched(d)}>Programmer</button>
                    )}
                    {d.status === 'programme' && (d.assigned_to === me.id || isManager) && (
                      <button className="btn btn-primary btn-xs" onClick={() => setOut(d)}>Issue</button>
                    )}
                    {isManager && <button className="btn btn-ghost btn-xs" onClick={() => setEdit(d)}>Modifier</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sched && <ScheduleModal deal={sched} onClose={() => setSched(null)} onDone={reload} />}
      {out && <OutcomeModal deal={out} onClose={() => setOut(null)} onDone={reload} />}
      {edit && <EditDeal deal={edit} onClose={() => setEdit(null)} onDone={reload} />}
    </>
  );
}
