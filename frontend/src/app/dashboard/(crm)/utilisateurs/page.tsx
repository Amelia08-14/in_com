'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Modal, PageHead, useAction, useData } from '@/components/ui';
import { api } from '@/lib/api';
import { useMe } from '@/lib/me';
import { ROLE_LABELS } from '@/lib/labels';

// Création ou modification d'un compte. En modification, le mot de passe n'est changé que s'il est rempli.
function UserModal({ user, onClose, onDone }: { user?: any; onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const editing = !!user;
  const [f, setF] = useState<any>(user
    ? { name: user.name, email: user.email, role: user.role, phone: user.phone || '', daily_capacity: user.daily_capacity, extra_roles: String(user.extra_roles || '').split(',').filter(Boolean) }
    : { role: 'commercial_sedentaire', daily_capacity: 6, extra_roles: [] });
  const toggleExtra = (r: string) => setF({ ...f, extra_roles: f.extra_roles.includes(r) ? f.extra_roles.filter((x: string) => x !== r) : [...f.extra_roles, r] });
  const [show, setShow] = useState(false);
  const { data: clients } = useData<any[]>(!editing && f.role === 'client' ? '/clients' : null, [f.role]);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const save = () => {
    const body = { ...f };
    if (editing && !body.password) delete body.password;
    return run(() => api(editing ? `/users/${user.id}` : '/users', { method: editing ? 'PATCH' : 'POST', body }),
      editing ? 'Compte mis à jour' : 'Compte créé', () => { onDone(); onClose(); });
  };
  return (
    <Modal title={editing ? `Modifier · ${user.name}` : 'Nouvel utilisateur'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={save}>{editing ? 'Enregistrer' : 'Créer le compte'}</button></>}>
      <div className="grid-2">
        <label className="field"><span>Nom et prénom</span><input className="input" value={f.name || ''} onChange={set('name')} /></label>
        <label className="field"><span>E-mail (identifiant)</span><input className="input" type="email" value={f.email || ''} onChange={set('email')} /></label>
        <label className="field">
          <span>{editing ? 'Nouveau mot de passe (laisser vide pour ne pas changer)' : 'Mot de passe initial (8 caractères minimum)'}</span>
          <div className="pw">
            <input className="input" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.password || ''} onChange={set('password')} />
            <button type="button" onClick={() => setShow(!show)}>{show ? 'Masquer' : 'Afficher'}</button>
          </div>
        </label>
        <label className="field"><span>Rôle</span>
          <select className="select" value={f.role} onChange={set('role')}>{Object.entries(ROLE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="field"><span>Téléphone</span><input className="input" value={f.phone || ''} onChange={set('phone')} /></label>
        {f.role === 'graphiste' && <label className="field"><span>Capacité journalière (tâches)</span><input className="input" type="number" value={f.daily_capacity} onChange={set('daily_capacity')} /></label>}
        {!editing && f.role === 'client' && (
          <label className="field"><span>Fiche client liée</span>
            <select className="select" onChange={set('prospect_id')}><option value="">—</option>{clients?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
        )}
      </div>
      {f.role !== 'client' && (
        <div className="field">
          <span>Rôles supplémentaires (la personne passe de l’un à l’autre dans le menu)</span>
          <div className="role-checks">
            {Object.entries(ROLE_LABELS).filter(([k]) => !['client', 'admin', f.role].includes(k)).map(([k, l]) => (
              <label key={k} className={`role-check ${f.extra_roles.includes(k) ? 'on' : ''}`}>
                <input type="checkbox" checked={f.extra_roles.includes(k)} onChange={() => toggleExtra(k)} />{l}
              </label>
            ))}
          </div>
        </div>
      )}
      {!editing && <p style={{ margin: 0, fontSize: 13, color: 'var(--muted)' }}>Communiquez l’e-mail et le mot de passe à la personne : elle pourra le changer dans « Mon profil ».</p>}
    </Modal>
  );
}

export default function Utilisateurs() {
  const me = useMe();
  const run = useAction();
  const { data: rows, reload } = useData<any[]>('/users');
  const [edit, setEdit] = useState<any>(null);
  const [create, setCreate] = useState(false);
  const remove = (u: any) => {
    if (!confirm(`Supprimer le compte de ${u.name} ? S’il a déjà un historique, il sera seulement désactivé.`)) return;
    run(() => api(`/users/${u.id}`, { method: 'DELETE' }), 'Compte supprimé ou désactivé', reload);
  };
  return (
    <>
      <PageHead title="Utilisateurs" sub="Comptes de l’équipe et rôles. Modifiez un compte pour corriger son e-mail ou réinitialiser son mot de passe."
        actions={<button className="btn btn-primary" onClick={() => setCreate(true)}>+ Nouvel utilisateur</button>} />
      <div className="table-wrap">
        <table className="t">
          <thead><tr><th>Nom</th><th>E-mail</th><th>Rôle</th><th>Secteurs</th><th>Statut</th><th></th></tr></thead>
          <tbody>
            {rows?.map((u) => (
              <tr key={u.id}>
                <td><b>{u.name}</b>{u.phone && <span className="sub">{u.phone}</span>}</td><td>{u.email}</td><td>{ROLE_LABELS[u.role]}{u.extra_roles && <span className="sub">+ {String(u.extra_roles).split(',').map((r: string) => ROLE_LABELS[r] || r).join(', ')}</span>}</td><td>{u.sectors || '—'}</td>
                <td>{u.active ? <span className="badge ok">Actif</span> : <span className="badge neutral">Désactivé</span>}</td>
                <td className="row-actions">
                  <button className="btn btn-dark btn-xs" onClick={() => setEdit(u)}>Modifier</button>
                  {u.id !== me.id && <>
                    <button className="btn btn-ghost btn-xs" onClick={() => run(() => api(`/users/${u.id}`, { method: 'PATCH', body: { active: u.active ? 0 : 1 } }), 'Mis à jour', reload)}>{u.active ? 'Désactiver' : 'Réactiver'}</button>
                    <button className="btn btn-ghost btn-xs danger-text" onClick={() => remove(u)}>Supprimer</button>
                  </>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {create && <UserModal onClose={() => setCreate(false)} onDone={reload} />}
      {edit && <UserModal user={edit} onClose={() => setEdit(null)} onDone={reload} />}
    </>
  );
}
