'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PageHead, useData, Empty } from '@/components/ui';
import { fmtDate } from '@/lib/api';

export default function Demandes() {
  const { data: rows } = useData<any[]>('/contact-requests');
  return (
    <>
      <PageHead title="Demandes du site" sub="Chaque formulaire de la landing page crée automatiquement une fiche dans l’Univers (source : Site web)." />
      {rows?.length === 0 ? <Empty>Aucune demande pour l’instant.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Date</th><th>Contact</th><th>Entreprise</th><th>Formule</th><th>Message</th></tr></thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.created_at, true)}</td>
                  <td><b>{r.name}</b><span className="sub">{r.phone} · {r.email}</span></td>
                  <td>{r.company || '—'}</td>
                  <td>{r.offer || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13.5, maxWidth: 360 }}>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
