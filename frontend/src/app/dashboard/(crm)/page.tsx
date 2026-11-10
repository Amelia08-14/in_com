'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from 'next/link';
import { Kpi, useData, Empty } from '@/components/ui';
import { useMe } from '@/lib/me';
import { fmtDate } from '@/lib/api';
import { DOSSIER_STATUS, ROLE_LABELS } from '@/lib/labels';

const QUICK: Record<string, [string, string][]> = {
  commercial_sedentaire: [['/dashboard/reporting?new=1', 'Déclarer un appel'], ['/dashboard/deals', 'Mes deals'], ['/dashboard/commandes', 'Commandes à valider']],
  commercial_terrain: [['/dashboard/reporting?new=1', 'Déclarer une visite'], ['/dashboard/calendrier', 'Mes RDV'], ['/dashboard/univers', 'Mon secteur']],
  responsable_commercial: [['/dashboard/deals?status=a_attribuer', 'Attribuer les deals'], ['/dashboard/reporting', 'Reporting équipe'], ['/dashboard/demandes', 'Demandes du site']],
  responsable_communication: [['/dashboard/dossiers?status=signe', 'Vérifier les paiements'], ['/dashboard/dossiers', 'Tous les dossiers'], ['/dashboard/equipe-gd', 'Charge de l’équipe']],
  responsable_technique: [['/dashboard/validation', 'Valider les conceptions'], ['/dashboard/equipe-gd', 'Statistiques équipe'], ['/dashboard/clients', 'Attribuer les clients']],
  charge_clientele: [['/dashboard/validation', 'Présenter aux clients'], ['/dashboard/dossiers', 'Mes dossiers'], ['/dashboard/sav', 'SAV']],
  graphiste: [['/dashboard/taches', 'Mes tâches du jour'], ['/dashboard/mon-reporting', 'Ma progression']],
  community_manager: [['/dashboard/validation', 'Contenus à publier']],
  client: [['/dashboard/validation', 'Valider mes contenus'], ['/dashboard/commandes', 'Commander un extra'], ['/dashboard/sav', 'Contacter le support']],
  recouvrement: [['/dashboard/commandes', 'Commandes à encaisser']],
};

export default function Dashboard() {
  const me = useMe();
  const { data } = useData<any>('/dashboard');
  const quick = QUICK[me.role] || QUICK.graphiste;
  const hour = new Date().getHours();

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{ROLE_LABELS[me.role]}</div>
          <h1 style={{ marginTop: 6 }}>{hour < 18 ? 'Bonjour' : 'Bonsoir'}, {me.name.split(' ')[0]}.</h1>
        </div>
        <div className="page-actions">
          {quick.map(([href, label], i) => (
            <Link key={href} href={href} className={`btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}`}>{label}</Link>
          ))}
        </div>
      </div>

      <div className="kpis">
        {(data?.kpis || []).map((k: any) => <Kpi key={k.label} {...k} />)}
      </div>

      {data?.today && (
        <div className="card">
          <h2>Programme du jour</h2>
          {data.today.length === 0 ? <Empty>Aucun rendez-vous programmé aujourd’hui.</Empty> : (
            <table className="t">
              <tbody>
                {data.today.map((d: any) => (
                  <tr key={d.id}>
                    <td style={{ width: 90 }}><b>{d.scheduled_at.slice(11, 16)}</b></td>
                    <td><b>{d.prospect_name}</b><span className="sub">{d.address}</span></td>
                    <td>{d.kind === 'passage_bureau' ? 'Passage bureau' : d.kind === 'appel' ? 'Appel' : 'RDV terrain'}</td>
                    <td><a href={`tel:${d.phone}`} className="btn btn-ghost btn-xs">{d.phone}</a></td>
                    <td className="row-actions"><Link href="/dashboard/calendrier" className="btn btn-dark btn-xs">Donner l’issue</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {data?.pipeline && (
        <div className="card">
          <h2>Pipeline des dossiers</h2>
          <div className="pipeline">
            {Object.entries(DOSSIER_STATUS).map(([k, [label]]) => {
              const n = data.pipeline.find((p: any) => p.status === k)?.n || 0;
              return (
                <Link href={`/dashboard/dossiers?status=${k}`} key={k} style={{ flex: 1, minWidth: 120 }}>
                  <span style={{ display: 'block' }} className={n ? 'done' : ''}>
                    <b style={{ display: 'block', fontFamily: 'var(--font-slab)', fontSize: 24, color: 'var(--navy)' }}>{n}</b>{label}
                  </span>
                </Link>
              );
            })}
          </div>
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '14px 0 0' }}>
            Règle : aucune production ne démarre sans paiement confirmé, et aucun dossier ne reste en attente de validation sans date de relance.
          </p>
        </div>
      )}

      {data?.team && (
        <div className="card">
          <h2>Activité de l’équipe commerciale</h2>
          <table className="t">
            <thead><tr><th>Commercial</th><th>Rôle</th><th>Aujourd’hui</th><th>Ce mois</th></tr></thead>
            <tbody>
              {data.team.map((t: any) => (
                <tr key={t.name}><td><b>{t.name}</b></td><td>{ROLE_LABELS[t.role]}</td><td>{t.today || 0}</td><td>{t.month}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data?.client && (
        <div className="card">
          <h2>{data.client.name}</h2>
          <dl className="kv">
            <dt>Formule</dt><dd>{data.client.offer}</dd>
            <dt>Client depuis</dt><dd>{fmtDate(data.client.created_at)}</dd>
          </dl>
        </div>
      )}
    </>
  );
}
