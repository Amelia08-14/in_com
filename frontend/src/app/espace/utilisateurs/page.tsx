'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Modal, PageHead, useAction, useData } from '@/components/ui';
import { api } from '@/lib/api';
import { ROLE_LABELS } from '@/lib/labels';

function NewUser({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const [f, setF] = useState<any>({ role: 'commercial_sedentaire', daily_capacity: 6 });
  const { data: clients } = useData<any[]>('/clients');
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal title="Nouvel utilisateur" onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={() => run(() => api('/users', { body: f }), 'Utilisateur créé', () => { onDone(); onClose(); })}>Créer</button></>}>
      <div className="grid-2">
        <label className="field"><span>Nom</span><input className="input" onChange={set('name')} /></label>
        <label className="field"><span>E-mail</span><input className="input" type="email" onChange={set('email')} /></label>
        <label className="field"><span>Mot de passe initial</span><input className="input" type="password" autoComplete="new-password" onChange={set('password')} /></label>
        <label className="field"><span>Rôle</span>
          <select className="select" value={f.role} onChange={set('role')}>{Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="field"><span>Téléphone</span><input className="input" onChange={set('phone')} /></label>
        {f.role === 'graphiste' && <label className="field"><span>Capacité journalière (tâches)</span><input className="input" type="number" value={f.daily_capacity} onChange={set('daily_capacity')} /></label>}
        {f.role === 'client' && (
          <label className="field"><span>Fiche client liée</span>
            <select className="select" onChange={set('prospect_id')}><option value="">—</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
        )}
      </div>
    </Modal>
  );
}

export default function Utilisateurs() {
  const run = useAction();
  const { data: rows, reload } = useData<any[]>('/users');
  const [create, setCreate] = useState(false);
  return (
    <>
      <PageHead title="Utilisateurs" sub="Comptes collaborateurs et rôles. Chaque rôle voit uniquement ses modules." actions={<button className="btn btn-primary" onClick={() => setCreate(true)}>+ Nouvel utilisateur</button>} />
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Secteurs</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows?.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b></td><td>{u.email}</td><td>{ROLE_LABELS[u.role]}</td><td>{u.sectors || '—'}</td>
                <td>{u.active ? <span className="badge ok">Actif</span> : <span className="badge neutral">Désactivé</span>}</td>
                <td className="row-actions">
                  <button className="btn btn-ghost btn-xs" onClick={() => run(() => api(`/users/${u.id}`, { method: 'PATCH', body: { active: u.active ? 0 : 1 } }), 'Mis à jour', reload)}>{u.active ? 'Désactiver' : 'Réactiver'}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {create && <NewUser onClose={() => setCreate(false)} onDone={reload} />}
    </>
  );
}
