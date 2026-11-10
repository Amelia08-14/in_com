'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Badge, PageHead, Tabs, useAction, useData, Empty } from '@/components/ui';
import { OutcomeModal, ScheduleModal } from '@/components/DealModals';
import { api, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DEAL_STATUS } from '@/lib/labels';

export default function Deals() {
  const me = useMe();
  const run = useAction();
  const isManager = ['admin', 'responsable_commercial'].includes(me.role);
  const { data: rows, reload } = useData<any[]>('/deals');
  const { data: terrain } = useData<any[]>(isManager ? '/users?role=commercial_terrain' : null);
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
        sub={isManager ? 'Attribuez les deals terrain aux commerciaux et suivez leur issue.'
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
                  <td><Badge map={DEAL_STATUS} value={d.status} /></td>
                  <td>{d.created_by_name}<span className="sub">{fmtDate(d.created_at)}</span></td>
                  <td>
                    {isManager && d.type === 'terrain' && ['a_attribuer', 'attribue', 'a_relancer'].includes(d.status) ? (
                      <select className="select" style={{ height: 32, minWidth: 150 }} value={d.assigned_to || ''}
                        onChange={(e) => run(() => api(`/deals/${d.id}/assign`, { body: { user_id: e.target.value } }), 'Deal attribué', reload)}>
                        <option value="">Choisir…</option>
                        {terrain?.map((u) => <option key={u.id} value={u.id}>{u.name} {u.sectors ? `(${u.sectors})` : ''}</option>)}
                      </select>
                    ) : (d.assigned_name || '—')}
                  </td>
                  <td>{d.scheduled_at ? fmtDate(d.scheduled_at, true) : '—'}</td>
                  <td className="row-actions">
                    {['attribue', 'a_relancer'].includes(d.status) && (d.assigned_to === me.id || d.created_by === me.id) && (
                      <button className="btn btn-dark btn-xs" onClick={() => setSched(d)}>Programmer</button>
                    )}
                    {d.status === 'programme' && d.assigned_to === me.id && (
                      <button className="btn btn-primary btn-xs" onClick={() => setOut(d)}>Issue</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {sched && <ScheduleModal deal={sched} onClose={() => setSched(null)} onDone={reload} />}
      {out && <OutcomeModal deal={out} onClose={() => setOut(null)} onDone={reload} />}
    </>
  );
}
