'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Badge, Modal, useAction, useData } from '@/components/ui';
import { api, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { TASK_STATUS } from '@/lib/labels';
import NextStep, { type Step } from '@/components/NextStep';

const ACTION_LABEL: Record<string, string> = {
  generation: 'Tâche générée par le CRM', ouverture: 'Ouverte', creation: 'Conception ajoutée', modification: 'Modification terminée',
  validation_technique: 'Validée en interne', refus_technique: 'Refusée par le responsable technique', refus_cc: 'Modification demandée par le CC',
  refus_client: 'Modification demandée par le client', validation_client: 'Validée', publication: 'Publiée', reattribution: 'Réattribuée', creation_manuelle: 'Créée',
};

// Prochaine étape de la tâche, dite à la personne qui l'ouvre
function taskStep(t: any, me: any): Step {
  const mine = t.assigned_to === me.id;
  const by = t.assigned_name || 'le créateur';
  switch (t.status) {
    case 'a_faire': case 'en_cours':
      return mine ? { title: 'Réaliser et envoyer', you: 'Réalisez le contenu, puis collez le lien du fichier et cliquez « Ajouter ».', then: 'le responsable technique valide ou demande une modification.' }
        : { tone: 'wait', title: 'En réalisation', you: `${by} réalise ce contenu.` };
    case 'modification_demandee':
      return mine ? { title: 'Corriger', you: `Corrigez selon la note${t.last_note ? ` : « ${t.last_note} »` : ''}, puis déposez la nouvelle version.`, then: 'elle repart en validation technique.' }
        : { tone: 'wait', title: 'Modification en cours', you: `${by} corrige le contenu.` };
    case 'validation_technique':
      return me.role === 'responsable_technique' && !mine ? { title: 'Valider en interne', you: 'Ouvrez la version, puis validez ou demandez une modification avec une note précise.', then: 'validé, le contenu part chez le client ; refusé, il revient au créateur.' }
        : { tone: 'wait', title: 'En validation technique', you: 'Le responsable technique vérifie le contenu.' };
    case 'validation_client':
      return ['client', 'charge_clientele'].includes(me.role) ? { title: me.role === 'client' ? 'Votre avis' : 'Faire valider le client', you: me.role === 'client' ? 'Ouvrez la version, puis validez ou demandez une modification.' : 'Présentez la version au client et enregistrez sa décision. Relancez-le après 48 h.', then: 'validé, le contenu part en publication ; sinon, il revient au créateur avec la note.' }
        : { tone: 'wait', title: 'Chez le client', you: 'Le client (ou son chargé de clientèle) valide ou demande une modification.' };
    case 'validee':
      return me.role === 'community_manager' ? { title: 'Publier', you: 'Programmez ou publiez le contenu, puis cliquez « Marquer comme publiée ».', then: 'quand tout le mois est validé et publié, le dossier passe « Livré ».' }
        : { tone: 'done', title: 'Validée par le client', you: t.type === 'dev' ? 'Livraison faite.' : 'Le community manager la publie.' };
    default: return { tone: 'done', title: 'Publiée' };
  }
}

export default function TaskModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const run = useAction();
  const { data: t, reload } = useData<any>(`/tasks/${id}`);
  const [file, setFile] = useState('');
  const [note, setNote] = useState('');
  const [to, setTo] = useState('');
  const { data: gds } = useData<any[]>(me.role === 'responsable_technique' ? '/users?role=graphiste' : null);
  const done = () => { reload(); onDone(); };
  const act = (path: string, body: any, msg: string, close = true) => run(() => api(`/tasks/${id}/${path}`, { body }), msg, () => { done(); if (close) onClose(); });

  // Ouvrir la tâche → En cours
  useEffect(() => {
    if (t && t.assigned_to === me.id && t.status === 'a_faire') api(`/tasks/${id}/open`, { method: 'POST' }).then(done).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t?.status]);

  if (!t) return <Modal title="Tâche" onClose={onClose}><p>Chargement…</p></Modal>;
  const mine = t.assigned_to === me.id;
  const open = ['a_faire', 'en_cours', 'modification_demandee'].includes(t.status);
  const last = t.versions[0];

  return (
    <Modal title={t.theme || 'Tâche'} onClose={onClose} wide>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <Badge map={TASK_STATUS} value={t.status} />
        <span className="badge neutral">{t.type}</span>
        <span className="badge neutral">{t.part === 'modification' ? 'Modification' : 'Création'}</span>
        {t.modif_count > 0 && <span className="badge danger">{t.modif_count} modif.</span>}
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>Deadline {fmtDate(t.due_date)}</span>
      </div>
      <NextStep step={taskStep(t, me)} />
      <dl className="kv">
        <dt>Client</dt><dd>{t.client?.name} · formule {t.client?.offer || '—'}</dd>
        <dt>Brief</dt><dd>{t.brief || '—'}</dd>
        {t.client?.drive_url && <><dt>Dossier du client</dt><dd><a href={t.client.drive_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>Références déposées par le client (Drive)</a></dd></>}
        {t.client?.documents_url && <><dt>Charte & logos</dt><dd><a href={t.client.documents_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>Références du client</a></dd></>}
        {t.last_note && <><dt>Dernière note</dt><dd><div className="notice">{t.last_note}</div></dd></>}
        {last && <><dt>Version actuelle</dt><dd><a href={last.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)', fontWeight: 600 }}>V{last.version} — ouvrir</a> <span style={{ color: 'var(--muted)' }}>· {fmtDate(last.created_at, true)}</span></dd></>}
      </dl>

      {mine && open && (
        <div className="card">
          <h2>{t.part === 'modification' ? 'Déposer la version corrigée' : 'Ajouter la conception'}</h2>
          <label className="field"><span>Lien du fichier (Drive, Canva, Figma…)</span><input className="input" value={file} onChange={(e) => setFile(e.target.value)} placeholder="https://" /></label>
          <label className="field" style={{ marginTop: 10 }}><span>Commentaire</span><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!file} onClick={() => act('submit', { file_url: file, comment: note }, t.part === 'modification' ? 'Modification terminée — en validation technique' : 'Conception ajoutée — en validation technique')}>
            {t.part === 'modification' ? 'Modification terminée' : 'Ajouter'}
          </button>
        </div>
      )}

      {me.role === 'responsable_technique' && t.status === 'validation_technique' && (
        <div className="card">
          <h2>Validation technique</h2>
          <label className="field"><span>Note (obligatoire en cas de refus)</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="btn btn-ok" onClick={() => act('tech-review', { decision: 'valider', note }, 'Envoyée en validation client')}>Valider</button>
            <button className="btn btn-danger" disabled={!note} onClick={() => act('tech-review', { decision: 'refuser', note }, 'Renvoyée au graphiste')}>Refuser</button>
          </div>
        </div>
      )}

      {['charge_clientele', 'client'].includes(me.role) && t.status === 'validation_client' && (
        <div className="card">
          <h2>Validation {me.role === 'client' ? 'de votre contenu' : 'client'}</h2>
          <label className="field"><span>Note (obligatoire pour une modification)</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="btn btn-ok" onClick={() => act('client-review', { decision: 'valider', note }, 'Conception validée')}>Valider</button>
            <button className="btn btn-danger" disabled={!note} onClick={() => act('client-review', { decision: 'modifier', note }, 'Modification demandée')}>Demander une modification</button>
          </div>
        </div>
      )}

      {me.role === 'community_manager' && t.status === 'validee' && (
        <button className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={() => act('publish', {}, 'Publiée')}>Marquer comme publiée</button>
      )}

      {me.role === 'responsable_technique' && open && (
        <div className="card">
          <h2>Réattribuer (cas critique de retard)</h2>
          <div style={{ display: 'flex', gap: 10 }}>
            <select className="select" value={to} onChange={(e) => setTo(e.target.value)}>
              <option value="">Choisir un graphiste…</option>
              {gds?.filter((g) => g.id !== t.assigned_to).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            <button className="btn btn-dark" disabled={!to} onClick={() => act('reassign', { user_id: to }, 'Tâche réattribuée')}>Réattribuer</button>
          </div>
        </div>
      )}

      {t.versions.length > 1 && (
        <div>
          <h4 style={{ fontSize: 15, marginBottom: 8 }}>Versions</h4>
          {t.versions.map((v: any) => <div key={v.id} style={{ fontSize: 14 }}><a href={v.file_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>V{v.version}</a> · {v.author} · {fmtDate(v.created_at, true)}{v.comment ? ` · ${v.comment}` : ''}</div>)}
        </div>
      )}
      <div>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Historique</h4>
        <div className="timeline">
          {t.history.map((h: any) => (
            <div key={h.id}><div><b>{ACTION_LABEL[h.action] || h.action}</b>{h.user_name ? ` — ${h.user_name}` : ''}<small>{fmtDate(h.created_at, true)}{h.note ? ` · ${h.note}` : ''}</small></div></div>
          ))}
        </div>
      </div>
      {me.role === 'admin' && (
        <button className="btn btn-ghost btn-sm danger-text" style={{ justifySelf: 'start' }}
          onClick={() => confirm(`Supprimer la tâche « ${t.theme || t.type} » ? Son historique et ses versions seront aussi supprimés.`)
            && run(() => api(`/tasks/${id}`, { method: 'DELETE' }), 'Tâche supprimée', () => { onDone(); onClose(); })}>
          Supprimer la tâche
        </button>
      )}
    </Modal>
  );
}
