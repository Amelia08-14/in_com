'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { PageHead, useData } from '@/components/ui';
import { ALERT_LABEL, DailyBars, StatCards } from '@/components/GdStats';

export default function MonReporting() {
  const { data: s } = useData<any>('/tasks/stats/me');
  if (!s) return null;
  return (
    <>
      <PageHead title="Mon reporting" sub="Alimenté automatiquement à chaque « Ajouter » et « Modification terminée », sans saisie manuelle." />
      <StatCards s={s} />
      <div className="cols">
        <div className="card">
          <h2>30 derniers jours</h2>
          <DailyBars daily={s.daily} />
        </div>
        <div className="card">
          <h2>Diagnostic</h2>
          <p style={{ margin: 0 }}><span className={`alert-dot ${s.alert}`} /> <b style={{ marginLeft: 6 }}>{ALERT_LABEL[s.alert]}</b></p>
          <p style={{ color: 'var(--muted)', fontSize: 14 }}>{s.diagnostic}</p>
        </div>
      </div>
      <div className="card">
        <h2>Par client</h2>
        <table className="t">
          <thead><tr><th>Client</th><th>Créations</th><th>Modifications</th></tr></thead>
          <tbody>{s.byClient.map((c: any) => <tr key={c.name}><td>{c.name}</td><td>{c.creations}</td><td>{c.modifications}</td></tr>)}</tbody>
        </table>
      </div>
    </>
  );
}
