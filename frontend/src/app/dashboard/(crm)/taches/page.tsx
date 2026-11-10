'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Badge, Modal, PageHead, Progress, Tabs, useAction, useData, Empty } from '@/components/ui';
import TaskModal from '@/components/TaskModal';
import { api, qs, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { TASK_STATUS } from '@/lib/labels';

const PROD = ['graphiste', 'photographe', 'developpeur', 'community_manager', 'media_buyer'];

function NewTask({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const { data: clients } = useData<any[]>('/clients');
  const { data: staff } = useData<any[]>('/users?role=graphiste,photographe,developpeur,media_buyer,community_manager');
  const [f, setF] = useState<any>({ type: 'conception', priority: 2, due_date: new Date().toISOString().slice(0, 10) });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Nouvelle tâche" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!f.prospect_id || !f.assigned_to} onClick={() => run(() => api('/tasks', { body: f }), 'Tâche créée', () => { onDone(); onClose(); })}>Créer</button></>}>
      <div className="grid-2">
        <label className="field"><span>Client</span><select className="select" onChange={set('prospect_id')}><option value="">—</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label className="field"><span>Intervenant</span><select className="select" onChange={set('assigned_to')}><option value="">—</option>{staff?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
        <label className="field"><span>Type</span>
          <select className="select" value={f.type} onChange={set('type')}>{['conception', 'story', 'reel', 'photo', 'video', 'dev'].map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="field"><span>Deadline</span><input type="date" className="input" value={f.due_date} onChange={set('due_date')} /></label>
      </div>
      <label className="field"><span>Thématique</span><input className="input" onChange={set('theme')} /></label>
      <label className="field"><span>Brief</span><textarea className="textarea" onChange={set('brief')} /></label>
    </Modal>
  );
}

function MyTasks() {
  const [part, setPart] = useState('creation');
  const { data: rows, reload } = useData<any[]>('/tasks');
  const { data: stats, reload: reloadStats } = useData<any>('/tasks/stats/me');
  const [open, setOpen] = useState<number | null>(null);
  const list = (rows || []).filter((t) => t.part === part);
  const byClient = list.reduce((acc: Record<string, number>, t) => { acc[t.client_name] = (acc[t.client_name] || 0) + 1; return acc; }, {});

  return (
    <>
      <PageHead title="Mes tâches du jour" sub="Vous choisissez l’ordre : l’essentiel est de tout terminer. Classement par défaut : modifications en retard, clients en retard, priorité, deadline." />
      {stats && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 10 }}>
            <b>Progression du jour : {Math.round(stats.today.progress * 100)} %</b>
            <span style={{ color: 'var(--muted)', fontSize: 14 }}>{stats.today.done} / {stats.today.planned} tâches · {stats.today.late} en retard</span>
          </div>
          <Progress value={stats.today.progress} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
            {Object.entries(byClient).map(([c, n]) => <span key={c} className="badge neutral">{c} : {n} {part === 'creation' ? 'conception(s)' : 'modif.'}</span>)}
          </div>
        </div>
      )}
      <Tabs value={part} onChange={setPart} items={[
        ['creation', 'Création / conception', (rows || []).filter((t) => t.part === 'creation').length],
        ['modification', 'Modification', (rows || []).filter((t) => t.part === 'modification').length],
      ]} />
      {list.length === 0 ? <Empty>Rien à faire ici. Bravo !</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Tâche</th><th>Client</th><th>Type</th><th>Priorité</th><th>Deadline</th><th>Statut</th></tr></thead>
            <tbody>
              {list.map((t) => (
                <tr key={t.id} className="click" onClick={() => setOpen(t.id)}>
                  <td><b>{t.theme}</b>{t.last_note && part === 'modification' && <span className="sub">« {t.last_note} »</span>}</td>
                  <td>{t.client_name}</td>
                  <td>{t.type}</td>
                  <td>{t.priority === 1 ? <span className="badge accent">Haute</span> : 'Normale'}</td>
                  <td>{fmtDate(t.due_date)} {t.late ? <span className="badge danger">En retard</span> : null}</td>
                  <td><Badge map={TASK_STATUS} value={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <TaskModal id={open} onClose={() => setOpen(null)} onDone={() => { reload(); reloadStats(); }} />}
    </>
  );
}

function AllTasks() {
  const run = useAction();
  const me = useMe();
  const [f, setF] = useState({ status: '', assigned_to: '', client_id: '', part: '' });
  const { data: rows, reload } = useData<any[]>(`/tasks${qs(f)}`, [f]);
  const { data: staff } = useData<any[]>('/users?role=graphiste,photographe,developpeur,media_buyer');
  const { data: clients } = useData<any[]>('/clients');
  const [open, setOpen] = useState<number | null>(null);
  const [create, setCreate] = useState(false);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });

  return (
    <>
      <PageHead title="Tâches de production" sub="Le CRM découpe le quota mensuel de chaque client en tâches quotidiennes (jours ouvrés dimanche → jeudi)."
        actions={<>
          {me.role !== 'responsable_communication' && <button className="btn btn-ghost" onClick={() => run(() => api('/tasks/generate', { method: 'POST' }), 'Tâches du jour générées', reload)}>Générer les tâches du jour</button>}
          <button className="btn btn-primary" onClick={() => setCreate(true)}>+ Nouvelle tâche</button>
        </>} />
      <div className="filters">
        <select className="select" value={f.status} onChange={set('status')}><option value="">Tous les statuts</option>{Object.entries(TASK_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        <select className="select" value={f.assigned_to} onChange={set('assigned_to')}><option value="">Tous les intervenants</option>{staff?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select>
        <select className="select" value={f.client_id} onChange={set('client_id')}><option value="">Tous les clients</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="select" value={f.part} onChange={set('part')}><option value="">Création et modification</option><option value="creation">Création</option><option value="modification">Modification</option></select>
      </div>
      {rows?.length === 0 ? <Empty>Aucune tâche.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Tâche</th><th>Client</th><th>Intervenant</th><th>Deadline</th><th>Modif.</th><th>Statut</th></tr></thead>
            <tbody>
              {rows?.map((t) => (
                <tr key={t.id} className="click" onClick={() => setOpen(t.id)}>
                  <td><b>{t.theme}</b><span className="sub">{t.type} · {t.part}</span></td>
                  <td>{t.client_name}</td>
                  <td>{t.assigned_name}</td>
                  <td>{fmtDate(t.due_date)} {t.late ? <span className="badge danger">Retard</span> : null}</td>
                  <td>{t.modif_count}</td>
                  <td><Badge map={TASK_STATUS} value={t.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <TaskModal id={open} onClose={() => setOpen(null)} onDone={reload} />}
      {create && <NewTask onClose={() => setCreate(false)} onDone={reload} />}
    </>
  );
}

export default function Taches() {
  const me = useMe();
  return PROD.includes(me.role) ? <MyTasks /> : <AllTasks />;
}
