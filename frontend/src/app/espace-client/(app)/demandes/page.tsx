'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Espace client : toutes les demandes de devis et commandes envoyées depuis le site
import { Badge, Empty, PageHead, useData } from '@/components/ui';
import { fmtDA, fmtDate } from '@/lib/api';
import { CART_STATUS } from '@/lib/labels';

export default function MesDemandes() {
  const { data: rows } = useData<any[]>('/my/carts');
  return (
    <>
      <PageHead
        title="Mes demandes de devis"
        sub="Chaque demande envoyée depuis le site, avec son avancement. Votre conseiller met à jour le statut à chaque étape."
        actions={<a className="btn btn-primary" href="/#offres">Nouvelle demande</a>}
      />
      {rows && rows.length === 0 ? (
        <Empty>
          Vous n’avez pas encore envoyé de demande.{' '}
          <a className="link" href="/#offres">Composer mon panier sur le site</a>
        </Empty>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Code</th><th>Contenu</th><th>Mensuel</th><th>Ponctuel</th><th>Statut</th><th>Envoyée le</th><th /></tr></thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id}>
                  <td><b style={{ fontFamily: 'var(--font-mono, monospace)' }}>{r.code}</b></td>
                  <td style={{ maxWidth: 340, fontSize: 13.5, color: 'var(--muted)' }}>{r.summary}</td>
                  <td>{r.total_monthly ? fmtDA(r.total_monthly) : '—'}</td>
                  <td>{r.total_once ? fmtDA(r.total_once) : '—'}</td>
                  <td><Badge map={CART_STATUS} value={r.status} /></td>
                  <td>{fmtDate(r.created_at, true)}</td>
                  <td><a className="btn btn-ghost btn-xs" href={`/suivi/${r.code}`}>Suivre</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
