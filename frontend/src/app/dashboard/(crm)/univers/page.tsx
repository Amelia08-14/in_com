'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Badge, PageHead, useData, Empty } from '@/components/ui';
import ProspectDrawer from '@/components/ProspectDrawer';
import { qs, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { PROSPECT_LABEL, SOURCE_LABEL } from '@/lib/labels';

export default function Univers() {
  const me = useMe();
  const [f, setF] = useState({ search: '', label: '', sector_id: '', source: '' });
  const { data: rows, loading } = useData<any[]>(`/prospects${qs(f)}`, [f]);
  const { data: sectors } = useData<any[]>('/sectors');
  const [open, setOpen] = useState<number | null>(null);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHead
        title="Univers"
        sub={me.role === 'commercial_terrain' ? 'Les prospects de vos secteurs, avec tout leur historique.' : 'Tous les prospects et clients, tous secteurs confondus.'}
      />
      <div className="filters">
        <input className="input" placeholder="Rechercher un nom, téléphone, spécialité…" value={f.search} onChange={set('search')} style={{ minWidth: 280 }} />
        <select className="select" value={f.label} onChange={set('label')}>
          <option value="">Tous les labels</option>
          {Object.entries(PROSPECT_LABEL).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="select" value={f.sector_id} onChange={set('sector_id')}>
          <option value="">Tous les secteurs</option>
          {sectors?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select className="select" value={f.source} onChange={set('source')}>
          <option value="">Toutes les sources</option>
          {Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{rows?.length ?? 0} fiches</span>
      </div>
      {!loading && rows?.length === 0 ? <Empty>Aucune fiche ne correspond.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Prospect</th><th>Label</th><th>Secteur</th><th>Source</th><th>Visites</th><th>Relances</th><th>Deals</th><th>Dernier contact</th></tr></thead>
            <tbody>
              {rows?.map((p) => (
                <tr key={p.id} className="click" onClick={() => setOpen(p.id)}>
                  <td><b>{p.name}</b><span className="sub">{p.specialty} · {p.phone}</span></td>
                  <td><Badge map={PROSPECT_LABEL} value={p.label} /></td>
                  <td>{p.sector || '—'}</td>
                  <td>{SOURCE_LABEL[p.source]}</td>
                  <td>{p.visits}</td><td>{p.relances}</td><td>{p.deals_count}</td>
                  <td>{fmtDate(p.last_contact)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <ProspectDrawer id={open} onClose={() => setOpen(null)} />}
    </>
  );
}
