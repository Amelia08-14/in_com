'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PageHead, Progress, useAction, useData, Empty } from '@/components/ui';
import { api } from '@/lib/api';
import { useMe } from '@/lib/me';

export default function Clients() {
  const me = useMe();
  const run = useAction();
  const { data: rows, reload } = useData<any[]>('/tasks/quotas');
  const canAssign = ['responsable_technique', 'responsable_communication', 'admin'].includes(me.role);
  const { data: gds } = useData<any[]>(canAssign ? '/users?role=graphiste' : null);

  return (
    <>
      <PageHead
        title={canAssign ? 'Clients & quotas' : 'Mes clients'}
        sub="Offre souscrite, quota mensuel de conceptions et de stories, réalisé et restant ce mois-ci."
      />
      {rows?.length === 0 ? <Empty>Aucun client attribué.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Client</th><th>Formule</th><th style={{ minWidth: 180 }}>Conceptions</th><th style={{ minWidth: 180 }}>Stories</th><th>Équipe</th>{canAssign && <th>Graphiste</th>}</tr></thead>
            <tbody>
              {rows?.map((c) => (
                <tr key={c.id}>
                  <td><b>{c.name}</b>{c.priority === 1 && <span className="badge accent" style={{ marginLeft: 6 }}>Prioritaire</span>}
                    {c.documents_url && <span className="sub"><a href={c.documents_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>Charte, logos & documents</a></span>}</td>
                  <td>{c.offer || '—'}</td>
                  <td>{c.posts_month ? <><Progress value={c.posts_done / c.posts_month} /><span className="sub">{c.posts_done} / {c.posts_month} · reste {Math.max(0, c.posts_month - c.posts_done)}</span></> : '—'}</td>
                  <td>{c.stories_month ? <><Progress value={c.stories_done / c.stories_month} tone="var(--blue)" /><span className="sub">{c.stories_done} / {c.stories_month} · reste {Math.max(0, c.stories_month - c.stories_done)}</span></> : '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 280 }}>{c.team || '—'}</td>
                  {canAssign && (
                    <td>
                      <select className="select" style={{ height: 32 }} defaultValue=""
                        onChange={(e) => e.target.value && run(() => api(`/tasks/clients/${c.id}/assign`, { body: { user_id: e.target.value, role: 'graphiste' } }), 'Graphiste attribué', reload)}>
                        <option value="">Attribuer…</option>{gds?.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
