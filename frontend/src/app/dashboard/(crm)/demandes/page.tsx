'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Demandes entrantes (formulaire du site, inscriptions, paniers) : chacune a un commercial responsable,
// qui la rappelle sous 24 h. Elle est traitée dès qu'un appel ou une visite est déclaré sur la fiche.
import { useState } from 'react';
import Link from 'next/link';
import { PageHead, Tabs, useAction, useData, Empty } from '@/components/ui';
import NextStep from '@/components/NextStep';
import { api, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';

export default function Demandes() {
  const me = useMe();
  const run = useAction();
  const isManager = ['admin', 'responsable_commercial'].includes(me.role);
  const { data: rows, reload } = useData<any[]>('/contact-requests');
  const { data: team } = useData<any[]>(isManager ? '/users?role=commercial_sedentaire,commercial_terrain,responsable_commercial' : null);
  const [tab, setTab] = useState('a_rappeler');
  const open = rows?.filter((r) => !r.handled_at) || [];
  const shown = tab === 'a_rappeler' ? open : rows?.filter((r) => r.handled_at) || [];
  const late = open.filter((r) => Date.now() - new Date(String(r.created_at).replace(' ', 'T')).getTime() > 864e5).length;
  return (
    <>
      <PageHead title={isManager ? 'Demandes à rappeler' : 'Mes demandes à rappeler'}
        sub="Formulaire du site, inscriptions et paniers : chaque demande est attribuée à un commercial. Elle passe en « Traitée » dès que l’appel est déclaré dans Reporting." />
      <NextStep step={open.length
        ? { title: `${open.length} demande${open.length > 1 ? 's' : ''} à rappeler${late ? `, dont ${late} depuis plus de 24 h` : ''}`,
            you: isManager ? 'Vérifiez que chaque demande a un commercial ; réattribuez celles qui attendent.' : 'Appelez chaque contact, puis déclarez l’appel dans Reporting (même nom de fiche).',
            then: 'la demande passe en « Traitée » toute seule.' }
        : { tone: 'done', title: 'Aucune demande en attente' }}>
        {open.length > 0 && !isManager && <Link className="btn btn-primary btn-sm" href="/dashboard/reporting?new=1">Déclarer un appel</Link>}
      </NextStep>
      <Tabs value={tab} onChange={setTab} items={[['a_rappeler', 'À rappeler', open.length], ['traitees', 'Traitées']]} />
      {rows && shown.length === 0 ? <Empty>Aucune demande ici.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Reçue le</th><th>Contact</th><th>Origine</th><th>Message</th><th>Commercial</th>{tab === 'traitees' && <th>Traitée le</th>}</tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_at, true)}</td>
                  <td><b>{r.company || r.name}</b><span className="sub">{[r.company ? r.name : null, r.phone, r.email].filter(Boolean).join(' · ')}</span></td>
                  <td>{r.offer === 'inscription' ? 'Inscription' : r.offer === 'panier' || String(r.message || '').startsWith('Panier') ? 'Panier' : 'Formulaire'}{r.offer && !['inscription', 'panier'].includes(r.offer) && <span className="sub">{r.offer}</span>}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13.5, maxWidth: 340 }}>{r.message}</td>
                  <td>
                    {isManager && !r.handled_at ? (
                      <select className="select" style={{ height: 32, minWidth: 160 }} value={r.assigned_to || ''}
                        onChange={(e) => e.target.value && run(() => api(`/contact-requests/${r.id}/assign`, { body: { user_id: e.target.value } }), 'Demande attribuée', reload)}>
                        <option value="">À attribuer…</option>
                        {team?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                    ) : (r.assigned_name || '—')}
                  </td>
                  {tab === 'traitees' && <td>{fmtDate(r.handled_at, true)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
