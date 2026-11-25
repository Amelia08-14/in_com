'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Badge, PageHead, useData, useToast, Empty } from '@/components/ui';
import TaskModal from '@/components/TaskModal';
import { api, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { TASK_STATUS } from '@/lib/labels';

const COLUMNS: Record<string, string[]> = {
  responsable_technique: ['validation_technique', 'validation_client', 'modification_demandee', 'validee'],
  responsable_communication: ['validation_technique', 'validation_client', 'modification_demandee', 'validee'],
  admin: ['validation_technique', 'validation_client', 'modification_demandee', 'validee'],
  charge_clientele: ['validation_client', 'validee'],
  client: ['validation_client', 'validee', 'publiee'],
  community_manager: ['validation_client', 'validee', 'publiee'],
  graphiste: ['validation_technique', 'validation_client', 'modification_demandee', 'validee'],
};

const SUB: Record<string, string> = {
  responsable_technique: 'Validez en interne chaque conception. On ne valide jamais sa propre conception.',
  charge_clientele: 'Présentez les conceptions validées en interne, validez ou demandez une modification avec une note.',
  client: 'Validez vos contenus ou demandez une modification. Votre chargé de clientèle reste votre interlocuteur.',
  community_manager: 'Validez le travail des graphistes (à la place du chargé de clientèle), puis publiez les contenus validés.',
  graphiste: 'Le statut de chacune de vos conceptions et les notes de modification.',
};

// Glisser-déposer : chaque passage d'une colonne à une autre correspond à une action, selon le rôle.
// Vers « Modification demandée », une note est demandée (elle part au créateur).
type Move = { path: string; body: (note: string) => any; ok: string; note?: boolean };
const REVIEWERS = ['charge_clientele', 'community_manager', 'client', 'admin'];
function moveFor(from: string, to: string, role: string, mine: boolean): Move | null {
  if (from === 'validation_technique' && ['responsable_technique', 'admin'].includes(role) && !mine) {
    if (to === 'validation_client') return { path: 'tech-review', body: () => ({ decision: 'valider' }), ok: 'Validée en interne : envoyée en validation client' };
    if (to === 'modification_demandee') return { path: 'tech-review', body: (note) => ({ decision: 'refuser', note }), ok: 'Renvoyée au créateur', note: true };
  }
  if (from === 'validation_client' && REVIEWERS.includes(role)) {
    if (to === 'validee') return { path: 'client-review', body: () => ({ decision: 'valider' }), ok: 'Conception validée' };
    if (to === 'modification_demandee') return { path: 'client-review', body: (note) => ({ decision: 'modifier', note }), ok: 'Modification demandée', note: true };
  }
  if (from === 'validee' && to === 'publiee' && ['community_manager', 'admin'].includes(role)) return { path: 'publish', body: () => ({}), ok: 'Publiée' };
  return null;
}

export default function Validation() {
  const me = useMe();
  const scope = me.role === 'graphiste' ? '?scope=all' : '';
  const { data: rows, reload } = useData<any[]>(`/tasks${scope}`);
  const [open, setOpen] = useState<number | null>(null);
  const [drag, setDrag] = useState<any>(null);
  const [over, setOver] = useState('');
  const toast = useToast();
  const base = COLUMNS[me.role] || COLUMNS.admin;
  // Les colonnes d'arrivée possibles sont affichées même vides, pour pouvoir y déposer une carte
  const cols = [...base, ...(['community_manager', 'admin'].includes(me.role) && !base.includes('publiee') ? ['publiee'] : []),
    ...(REVIEWERS.includes(me.role) || me.role === 'responsable_technique') && !base.includes('modification_demandee') && me.role !== 'client' ? ['modification_demandee'] : []];
  const canDrop = (to: string) => !!drag && drag.status !== to && !!moveFor(drag.status, to, me.role, drag.assigned_to === me.id);
  async function drop(to: string) {
    const t = drag;
    setDrag(null); setOver('');
    const m = t && moveFor(t.status, to, me.role, t.assigned_to === me.id);
    if (!m) return;
    let note = '';
    if (m.note) {
      note = (window.prompt('Note pour le créateur : ce qu’il faut modifier') || '').trim();
      if (!note) { toast('Modification annulée : la note est obligatoire', true); return; }
    }
    try { await api(`/tasks/${t.id}/${m.path}`, { body: m.body(note) }); toast(m.ok); reload(); } catch (e: any) { toast(e.message, true); }
  }
  const title = me.role === 'community_manager' ? 'À valider et publier' : me.role === 'client' ? 'À valider' : me.role === 'graphiste' ? 'Suivi de validation' : 'Validation';

  return (
    <>
      <PageHead title={title} sub={`${SUB[me.role] || 'Circuit : responsable technique → chargé de clientèle ou client → publication.'} Glissez une carte vers la colonne suivante quand c’est bon, ou cliquez-la pour l’ouvrir.`} />
      {rows && rows.length === 0 ? <Empty>Aucun contenu en circuit de validation.</Empty> : (
        <div className="board">
          {cols.map((c) => {
            const list = (rows || []).filter((t) => t.status === c).slice(0, 40);
            return (
              <div className={`col ${drag ? (canDrop(c) ? 'drop-ok' : 'drop-no') : ''} ${over === c && canDrop(c) ? 'drop-over' : ''}`} key={c}
                onDragOver={(e) => { if (canDrop(c)) { e.preventDefault(); setOver(c); } }}
                onDragLeave={() => setOver((o) => (o === c ? '' : o))}
                onDrop={(e) => { e.preventDefault(); drop(c); }}>
                <h3><span>{TASK_STATUS[c][0]}</span><span>{(rows || []).filter((t) => t.status === c).length}</span></h3>
                {list.map((t) => (
                  <div key={t.id} className={`tcard ${t.late ? 'late' : ''} ${drag?.id === t.id ? 'dragging' : ''}`} onClick={() => setOpen(t.id)}
                    draggable={['validation_technique', 'validation_client', 'validee'].some((from) => from === t.status)}
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; setDrag(t); }}
                    onDragEnd={() => { setDrag(null); setOver(''); }}>
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
