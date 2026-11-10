'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { Badge, PageHead, useData } from '@/components/ui';
import { OutcomeModal } from '@/components/DealModals';
import { qs } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DEAL_STATUS } from '@/lib/labels';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Calendrier() {
  const me = useMe();
  const [offset, setOffset] = useState(0);
  const days = useMemo(() => {
    const start = new Date();
    start.setDate(start.getDate() - start.getDay() + offset * 7); // semaine commençant le dimanche
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [offset]);
  const { data: events, reload } = useData<any[]>(`/calendar${qs({ from: iso(days[0]), to: iso(days[6]) })}`, [offset]);
  const [out, setOut] = useState<any>(null);
  const today = iso(new Date());

  return (
    <>
      <PageHead
        title="Calendrier"
        sub="Vos rendez-vous et appels programmés. Le jour même, donnez l’issue : nouvelle date, gagné, perdu ou à relancer."
        actions={<>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(offset - 1)}>← Semaine précédente</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(0)}>Cette semaine</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setOffset(offset + 1)}>Semaine suivante →</button>
        </>}
      />
      <div className="week">
        {days.map((d) => {
          const key = iso(d);
          const list = (events || []).filter((e) => e.scheduled_at.startsWith(key));
          return (
            <div key={key} className={`day ${key === today ? 'today' : ''} ${d.getDay() >= 5 ? 'off' : ''}`}>
              <h4><span>{d.toLocaleDateString('fr-FR', { weekday: 'short' })}</span><span>{d.getDate()}</span></h4>
              {list.map((e) => (
                <div key={e.id} className={`event ${e.type === 'bureau' ? 'bureau' : ''}`} onClick={() => e.status === 'programme' && (e.assigned_to === me.id) && setOut(e)}>
                  <b>{e.scheduled_at.slice(11, 16)} · {e.prospect_name}</b>
                  {e.kind === 'passage_bureau' ? 'Passage bureau' : e.kind === 'appel' ? 'Appel' : 'RDV terrain'}
                  {me.role === 'responsable_commercial' && <> · {e.assigned_name}</>}
                  <div style={{ marginTop: 6 }}><Badge map={DEAL_STATUS} value={e.status} /></div>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      {out && <OutcomeModal deal={out} onClose={() => setOut(null)} onDone={reload} />}
    </>
  );
}
