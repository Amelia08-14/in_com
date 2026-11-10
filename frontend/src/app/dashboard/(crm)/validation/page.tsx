'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Badge, PageHead, useData, Empty } from '@/components/ui';
import TaskModal from '@/components/TaskModal';
import { fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { TASK_STATUS } from '@/lib/labels';

const COLUMNS: Record<string, string[]> = {
  responsable_technique: ['validation_technique', 'validation_client', 'modification_demandee', 'validee'],
  responsable_communication: ['validation_technique', 'validation_client', 'modification_demandee', 'validee'],
  admin: ['validation_technique', 'validation_client', 'modification_demandee', 'validee'],
  charge_clientele: ['validation_client', 'validee'],
  client: ['validation_client', 'validee', 'publiee'],
  community_manager: ['validee', 'publiee'],
  graphiste: ['validation_technique', 'validation_client', 'modification_demandee', 'validee'],
};

const SUB: Record<string, string> = {
  responsable_technique: 'Validez en interne chaque conception. On ne valide jamais sa propre conception.',
  charge_clientele: 'Présentez les conceptions validées en interne, validez ou demandez une modification avec une note.',
  client: 'Validez vos contenus ou demandez une modification. Votre chargé de clientèle reste votre interlocuteur.',
  community_manager: 'Contenus validés par le client, prêts à être programmés et publiés.',
  graphiste: 'Le statut de chacune de vos conceptions et les notes de modification.',
};

export default function Validation() {
  const me = useMe();
  const scope = me.role === 'graphiste' ? '?scope=all' : '';
  const { data: rows, reload } = useData<any[]>(`/tasks${scope}`);
  const [open, setOpen] = useState<number | null>(null);
  const cols = COLUMNS[me.role] || COLUMNS.admin;
  const title = me.role === 'community_manager' ? 'À publier' : me.role === 'client' ? 'À valider' : me.role === 'graphiste' ? 'Suivi de validation' : 'Validation';

  return (
    <>
      <PageHead title={title} sub={SUB[me.role] || 'Circuit : responsable technique → chargé de clientèle ou client → publication.'} />
      {rows && rows.length === 0 ? <Empty>Aucun contenu en circuit de validation.</Empty> : (
        <div className="board">
          {cols.map((c) => {
            const list = (rows || []).filter((t) => t.status === c).slice(0, 40);
            return (
              <div className="col" key={c}>
                <h3><span>{TASK_STATUS[c][0]}</span><span>{(rows || []).filter((t) => t.status === c).length}</span></h3>
                {list.map((t) => (
                  <div key={t.id} className={`tcard ${t.late ? 'late' : ''}`} onClick={() => setOpen(t.id)}>
                    <b>{t.theme}</b>
                    <div className="meta"><span>{t.client_name}</span><span>{t.version ? `V${t.version}` : ''}</span></div>
                    <div className="meta"><span>{t.assigned_name}</span><span>{fmtDate(t.updated_at)}</span></div>
                    {t.modif_count > 0 && <Badge map={{ x: [`${t.modif_count} modification(s)`, 'danger'] }} value="x" />}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {open && <TaskModal id={open} onClose={() => setOpen(null)} onDone={reload} />}
    </>
  );
}
