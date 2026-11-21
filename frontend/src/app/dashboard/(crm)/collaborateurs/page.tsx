'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Annuaire de l'équipe : tous les collaborateurs actifs, avec e-mail et téléphone
import { useState } from 'react';
import { Empty, PageHead, useData } from '@/components/ui';
import { ROLE_LABELS } from '@/lib/labels';

export default function Collaborateurs() {
  const { data: rows } = useData<any[]>('/team');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const list = (rows || []).filter((u) =>
    (!role || u.role === role) && (!search || norm(`${u.name} ${u.email} ${ROLE_LABELS[u.role] || ''}`).includes(norm(search))));
  const roles = [...new Set((rows || []).map((u) => u.role))];

  return (
    <>
      <PageHead title="Collaborateurs" sub="Toute l’équipe IN COM : rôle, e-mail et téléphone pour se joindre directement." />
      <div className="filters">
        <input className="input" placeholder="Rechercher un nom, un e-mail, un rôle…" value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 280 }} />
        <select className="select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">Tous les rôles</option>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>)}
        </select>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{list.length} collaborateur{list.length > 1 ? 's' : ''}</span>
      </div>
      {rows && list.length === 0 ? <Empty>Aucun collaborateur ne correspond.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Nom</th><th>Rôle</th><th>E-mail</th><th>Téléphone</th></tr></thead>
            <tbody>
              {list.map((u) => (
                <tr key={u.id}>
                  <td><b>{u.name}</b></td>
                  <td>{ROLE_LABELS[u.role] || u.role}</td>
                  <td><a className="link" href={`mailto:${u.email}`}>{u.email}</a></td>
                  <td>{u.phone ? <a className="link" href={`tel:${u.phone.replace(/\s/g, '')}`}>{u.phone}</a> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
