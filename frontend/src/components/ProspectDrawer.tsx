'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Badge, Modal, useAction, useData } from '@/components/ui';
import { api, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DEAL_STATUS, PROSPECT_LABEL, REASON_LABEL, ROLE_LABELS, SOURCE_LABEL } from '@/lib/labels';

const COMMERCIAL = ['admin', 'responsable_commercial', 'commercial_sedentaire', 'commercial_terrain'];
const MANAGERS = ['admin', 'responsable_commercial'];

// Modification d'une fiche : les commerciaux corrigent les coordonnées, la direction et le responsable
// commercial changent aussi le label, la formule, la source et les documents.
function EditProspect({ p, onCancel, onSaved }: { p: any; onCancel: () => void; onSaved: () => void }) {
  const me = useMe();
  const run = useAction();
  const manager = MANAGERS.includes(me.role);
  const { data: sectors } = useData<any[]>('/sectors');
  const { data: offers } = useData<any[]>(manager ? '/offers' : null);
  const keys = ['name', 'contact_name', 'specialty', 'phone', 'email', 'address', 'maps_url', 'sector_id', 'priority', ...(manager ? ['label', 'offer_id', 'source', 'documents_url'] : [])];
  const [f, setF] = useState<any>(Object.fromEntries(keys.map((k) => [k, p[k] ?? ''])));
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const input = (k: string, label: string, type = 'text') => <label className="field"><span>{label}</span><input className="input" type={type} value={f[k] ?? ''} onChange={set(k)} /></label>;
  return (
    <div className="card" style={{ display: 'grid', gap: 12 }}>
      <h2 style={{ margin: 0 }}>Modifier la fiche</h2>
      <div className="grid-2">
        {input('name', 'Nom de l’entreprise / du prospect')}
        {input('contact_name', 'Nom du contact')}
        {input('phone', 'Téléphone', 'tel')}
        {input('email', 'E-mail', 'email')}
        {input('specialty', 'Spécialité / activité')}
        <label className="field"><span>Secteur (commune)</span>
          <select className="select" value={f.sector_id ?? ''} onChange={set('sector_id')}><option value="">—</option>{sectors?.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select>
        </label>
        {input('address', 'Adresse')}
        {input('maps_url', 'Lien Google Maps')}
        <label className="field"><span>Priorité</span>
          <select className="select" value={f.priority} onChange={set('priority')}><option value={1}>Haute</option><option value={2}>Normale</option><option value={3}>Basse</option></select>
        </label>
        {manager && <>
          <label className="field"><span>Label</span>
            <select className="select" value={f.label} onChange={set('label')}>{Object.entries(PROSPECT_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          <label className="field"><span>Formule</span>
            <select className="select" value={f.offer_id ?? ''} onChange={set('offer_id')}><option value="">—</option>{offers?.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          </label>
          <label className="field"><span>Source</span>
            <select className="select" value={f.source} onChange={set('source')}>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </label>
          {input('documents_url', 'Lien des documents')}
        </>}
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        <button className="btn btn-primary" onClick={() => run(() => api(`/prospects/${p.id}`, { method: 'PATCH', body: f }), 'Fiche mise à jour', onSaved)}>Enregistrer</button>
      </div>
    </div>
  );
}

export default function ProspectDrawer({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged?: () => void }) {
  const me = useMe();
  const run = useAction();
  const { data: p, reload } = useData<any>(`/prospects/${id}`);
  const [editing, setEditing] = useState(false);
  const canEdit = COMMERCIAL.includes(me.role);
  const remove = () => {
    if (!confirm(`Supprimer définitivement la fiche ${p.name} ? Son historique, ses deals et ses dossiers seront aussi supprimés.`)) return;
    run(() => api(`/prospects/${p.id}`, { method: 'DELETE' }), 'Fiche supprimée', () => { onChanged?.(); onClose(); });
  };
  return (
    <Modal title={p?.name || 'Fiche'} onClose={onClose} wide>
      {!p ? <p>Chargement…</p> : editing ? (
        <EditProspect p={p} onCancel={() => setEditing(false)} onSaved={() => { setEditing(false); reload(); onChanged?.(); }} />
      ) : (
        <>
          {canEdit && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-dark btn-sm" onClick={() => setEditing(true)}>Modifier la fiche</button>
              {MANAGERS.includes(me.role) && <button className="btn btn-ghost btn-sm danger-text" onClick={remove}>Supprimer</button>}
            </div>
          )}
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
            <dt>E-mail</dt><dd>{p.email ? <a href={`mailto:${p.email}`}>{p.email}</a> : '—'}</dd>
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
