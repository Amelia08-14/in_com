'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Badge, Modal, useData } from '@/components/ui';
import { fmtDate } from '@/lib/api';
import { DEAL_STATUS, PROSPECT_LABEL, REASON_LABEL, ROLE_LABELS, SOURCE_LABEL } from '@/lib/labels';

export default function ProspectDrawer({ id, onClose }: { id: number; onClose: () => void }) {
  const { data: p } = useData<any>(`/prospects/${id}`);
  return (
    <Modal title={p?.name || 'Fiche'} onClose={onClose} wide>
      {!p ? <p>Chargement…</p> : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Badge map={PROSPECT_LABEL} value={p.label} />
            <span className="badge neutral">{SOURCE_LABEL[p.source]}</span>
            {p.offer && <span className="badge navy">Formule {p.offer}</span>}
          </div>
          <div className="grid-3">
            <div className="kpi"><span>Visites</span><b>{p.visits}</b></div>
            <div className="kpi"><span>Relances</span><b>{p.relances}</b></div>
            <div className="kpi"><span>Deals</span><b>{p.deals_count}</b></div>
          </div>
          <dl className="kv">
            <dt>Contact</dt><dd>{p.contact_name || '—'}</dd>
            <dt>Spécialité</dt><dd>{p.specialty || '—'}</dd>
            <dt>Téléphone</dt><dd>{p.phone ? <a href={`tel:${p.phone}`}>{p.phone}</a> : '—'}</dd>
            <dt>Secteur</dt><dd>{p.sector || '—'}</dd>
            <dt>Adresse</dt><dd>{p.address || '—'} {p.maps_url && <a href={p.maps_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>· Maps</a>}</dd>
            {p.documents_url && <><dt>Documents</dt><dd><a href={p.documents_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>Ouvrir le dossier</a></dd></>}
            {p.team?.length > 0 && <><dt>Équipe</dt><dd>{p.team.map((t: any) => `${t.name} (${ROLE_LABELS[t.role] || t.role})`).join(', ')}</dd></>}
          </dl>
          {p.deals?.length > 0 && (
            <div>
              <h4 style={{ fontSize: 15, marginBottom: 8 }}>Deals</h4>
              <table className="t">
                <tbody>
                  {p.deals.map((d: any) => (
                    <tr key={d.id}>
                      <td>Deal {d.type}</td><td><Badge map={DEAL_STATUS} value={d.status} /></td>
                      <td>par {d.created_by_name}{d.assigned_name ? ` → ${d.assigned_name}` : ''}</td><td>{fmtDate(d.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div>
            <h4 style={{ fontSize: 15, marginBottom: 10 }}>Historique</h4>
            <div className="timeline">
              {p.history.length === 0 && <p style={{ color: 'var(--muted)' }}>Aucun contact enregistré.</p>}
              {p.history.map((h: any) => (
                <div key={h.id}>

                  <div>
                    <b>{REASON_LABEL[h.reason]}{h.outcome ? ` · ${DEAL_STATUS[h.outcome]?.[0] || h.outcome}` : ''}</b> — {h.channel === 'visite' ? 'visite' : 'appel'} de {h.user_name}
                    <small>{fmtDate(h.created_at, true)} · {ROLE_LABELS[h.user_role]}{h.notes ? ` · ${h.notes}` : ''}</small>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
