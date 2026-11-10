'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PageHead, useData } from '@/components/ui';
import { TeamRow } from '@/components/GdStats';

export default function EquipeGd() {
  const { data: rows } = useData<any[]>('/tasks/stats/team');
  return (
    <>
      <PageHead title="Équipe graphistes" sub="Vert : normal · Orange : surcharge de modifications (ratio ≥ 30 %) · Rouge : sous-charge de tâches. Un retard cumulé de 3 jours déclenche une alerte." />
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Graphiste</th><th>Aujourd’hui</th><th>Créations</th><th>Modifs</th><th>Ratio</th><th>Occupation</th><th>Retard</th><th>Diagnostic</th></tr></thead>
          <tbody>{rows?.map((s) => <TeamRow key={s.user.id} s={s} />)}</tbody>
        </table>
      </div>
      <div className="card" style={{ marginTop: 18 }}>
        <h2>Lecture du diagnostic</h2>
        <table className="t">
          <tbody>
            <tr><td>Beaucoup de modifications, objectif non atteint</td><td>Temps perdu en corrections : qualité des conceptions ou briefs flous</td></tr>
            <tr><td>Peu de modifications, objectif non atteint</td><td>Pas assez de tâches reçues : problème d’attribution</td></tr>
            <tr><td>Peu de modifications, objectif atteint</td><td>Performance normale</td></tr>
            <tr><td>Modifications concentrées sur un seul client</td><td>Client exigeant ou brief mal défini</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
