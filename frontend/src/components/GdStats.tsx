'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Progress } from '@/components/ui';

export const ALERT_LABEL: Record<string, string> = { vert: 'Normal', orange: 'Surcharge de modifications', rouge: 'Sous-charge de tâches' };

export function StatCards({ s }: { s: any }) {
  return (
    <div className="kpis">
      <div className="kpi accent"><span>Progression du jour</span><b>{Math.round(s.today.progress * 100)} %</b><small>{s.today.done} / {s.today.planned} tâches</small></div>
      <div className="kpi"><span>Créations (30 j)</span><b>{s.creations}</b></div>
      <div className="kpi"><span>Modifications (30 j)</span><b>{s.modifications}</b></div>
      <div className={`kpi ${s.ratio >= 0.3 ? 'warn' : ''}`}><span>Ratio de modifications</span><b>{Math.round(s.ratio * 100)} %</b><small>alerte à 30 %</small></div>
      <div className="kpi"><span>Taux d’occupation</span><b>{Math.round(s.occupation * 100)} %</b><small>tâches reçues / capacité</small></div>
      <div className="kpi"><span>Non faites réattribuées</span><b>{s.reassigned_out}</b></div>
    </div>
  );
}

export function DailyBars({ daily }: { daily: any[] }) {
  const max = Math.max(1, ...daily.map((d) => Number(d.creations) + Number(d.modifications)));
  return (
    <>
      <div className="bars">
        {daily.map((d) => (
          <div key={d.day} title={`${d.day} · ${d.creations} créations, ${d.modifications} modifications`}>
            <span className="c" style={{ height: `${(Number(d.creations) / max) * 130}px` }} />
            <span className="m" style={{ height: `${(Number(d.modifications) / max) * 130}px` }} />
          </div>
        ))}
      </div>
      <div className="legend"><span><i style={{ background: 'var(--navy)' }} />Créations</span><span><i style={{ background: 'var(--orange)' }} />Modifications</span></div>
    </>
  );
}

export function TeamRow({ s }: { s: any }) {
  return (
    <tr>
      <td><span className={`alert-dot ${s.alert}`} /> <b style={{ marginLeft: 6 }}>{s.user.name}</b><span className="sub">{ALERT_LABEL[s.alert]}</span></td>
      <td style={{ minWidth: 160 }}><Progress value={s.today.progress} /><span className="sub">{s.today.done} / {s.today.planned} aujourd’hui</span></td>
      <td>{s.creations}</td>
      <td>{s.modifications}</td>
      <td>{Math.round(s.ratio * 100)} %</td>
      <td>{Math.round(s.occupation * 100)} %</td>
      <td>{s.today.late ? <span className="badge danger">{s.today.late}</span> : 0}</td>
      <td style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 260 }}>{s.diagnostic}</td>
    </tr>
  );
}
