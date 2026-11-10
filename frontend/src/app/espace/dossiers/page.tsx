'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Badge, Modal, PageHead, Tabs, useAction, useData, Empty } from '@/components/ui';
import { api, fmtDA, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DOSSIER_FLOW, DOSSIER_STATUS, ROLE_LABELS, SERVICE_TYPE } from '@/lib/labels';

function Flow({ status, service }: { status: string; service: string }) {
  const flow = [...DOSSIER_FLOW.slice(0, 4), service === 'developpement' ? 'livre' : 'publie'];
  const idx = status === 'modification_demandee' ? 3 : flow.indexOf(status);
  return (
    <div className="pipeline">
      {flow.map((s, i) => (
        <span key={s} className={i < idx ? 'done' : i === idx ? 'cur' : ''}>
          {i === 3 && status === 'modification_demandee' ? 'Modification demandée' : DOSSIER_STATUS[s][0]}
        </span>
      ))}
    </div>
  );
}

function DossierModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const run = useAction();
  const { data: d, reload } = useData<any>(`/dossiers/${id}`);
  const isResp = ['responsable_communication', 'admin'].includes(me.role);
  const { data: staff } = useData<any[]>(isResp ? '/users?role=charge_clientele,graphiste,community_manager,photographe,developpeur,media_buyer' : null);
  const [cc, setCc] = useState('');
  const [team, setTeam] = useState<Record<string, string>>({});
  const [service, setService] = useState('');
  const [note, setNote] = useState('');
  const done = () => { reload(); onDone(); };
  const act = (path: string, body: any, msg: string) => run(() => api(`/dossiers/${id}/${path}`, { body }), msg, done);

  if (!d) return <Modal title="Dossier" onClose={onClose}><p>Chargement…</p></Modal>;
  const byRole = (r: string) => staff?.filter((s) => s.role === r) || [];
  const awaitingClient = d.status === 'en_attente_validation' && !d.validated_at;

  return (
    <Modal title={d.title} onClose={onClose} wide>
      <Flow status={d.status} service={d.service_type} />
      <dl className="kv">
        <dt>Client</dt><dd>{d.client_name}</dd>
        <dt>Prestation</dt><dd>{SERVICE_TYPE[d.service_type]}</dd>
        <dt>Montant</dt><dd>{fmtDA(d.amount)} · paiement {d.payment_mode}</dd>
        <dt>Paiement confirmé</dt><dd>{fmtDate(d.payment_confirmed_at, true)}</dd>
        <dt>Équipe</dt><dd>{d.team.length ? d.team.map((t: any) => `${t.name} (${ROLE_LABELS[t.role] || t.role})`).join(', ') : '—'}</dd>
        {d.validated_at && <><dt>Validé par le client</dt><dd>{fmtDate(d.validated_at, true)}</dd></>}
      </dl>

      {isResp && d.status === 'signe' && (
        <div className="card" style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}>
          <h2>Vérifier le paiement</h2>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>Aucune production ne démarre sans paiement confirmé.</p>
          <button className="btn btn-dark" onClick={() => act('confirm-payment', {}, 'Paiement confirmé')}>Confirmer le paiement</button>
        </div>
      )}

      {isResp && ['paiement_confirme', 'creation_en_cours'].includes(d.status) && (
        <div className="card">
          <h2>{d.status === 'paiement_confirme' ? 'Attribuer le CC et répartir les tâches' : 'Ajuster l’équipe'}</h2>
          <div className="grid-2">
            <label className="field"><span>Chargé de clientèle</span>
              <select className="select" value={cc} onChange={(e) => setCc(e.target.value)}>
                <option value="">{d.cc_id ? 'Inchangé' : 'Choisir…'}</option>{byRole('charge_clientele').map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </label>
            <label className="field"><span>Type de prestation</span>
              <select className="select" value={service || d.service_type} onChange={(e) => setService(e.target.value)}>
                {Object.entries(SERVICE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select>
            </label>
            {['graphiste', 'community_manager', 'photographe', 'developpeur', 'media_buyer'].map((r) => (
              <label className="field" key={r}><span>{ROLE_LABELS[r]}</span>
                <select className="select" value={team[r] || ''} onChange={(e) => setTeam({ ...team, [r]: e.target.value })}>
                  <option value="">—</option>{byRole(r).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </label>
            ))}
          </div>
          <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={() => act('assign', {
            cc_id: cc || undefined, service_type: service || undefined,
            team: Object.entries(team).filter(([, v]) => v).map(([role, user_id]) => ({ role, user_id })),
          }, d.status === 'paiement_confirme' ? 'Production lancée' : 'Équipe mise à jour')}>
            {d.status === 'paiement_confirme' ? 'Lancer la production' : 'Enregistrer'}
          </button>
        </div>
      )}

      {['charge_clientele', 'responsable_communication'].includes(me.role) && ['creation_en_cours', 'modification_demandee'].includes(d.status) && (
        <button className="btn btn-dark" style={{ justifySelf: 'start' }} onClick={() => act('submit', {}, 'Présenté au client')}>Présenter au client pour validation</button>
      )}

      {['charge_clientele', 'client'].includes(me.role) && awaitingClient && (
        <div className="card">
          <h2>Décision du client</h2>
          <label className="field"><span>Note (obligatoire pour une modification)</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="btn btn-ok" onClick={() => act('decision', { decision: 'valider', note }, 'Validé')}>Valider</button>
            <button className="btn btn-danger" disabled={!note} onClick={() => act('decision', { decision: 'modifier', note }, 'Modification demandée')}>Demander une modification</button>
          </div>
        </div>
      )}

      {['community_manager', 'responsable_communication'].includes(me.role) && d.validated_at && d.status !== 'publie' && d.service_type !== 'developpement' && (
        <button className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={() => act('publish', {}, 'Publié')}>Marquer comme publié</button>
      )}

      <div>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Historique</h4>
        <div className="timeline">
          {d.history.map((h: any) => (
            <div key={h.id}><div><b>{DOSSIER_STATUS[h.status]?.[0] || (h.status === 'valide' ? 'Validé par le client' : h.status)}</b> — {h.user_name || 'CRM'}<small>{fmtDate(h.created_at, true)}{h.note ? ` · ${h.note}` : ''}</small></div></div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

export default function Dossiers() {
  const me = useMe();
  const { data: rows, reload } = useData<any[]>('/dossiers');
  const [tab, setTab] = useState('tous');
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => { const s = new URLSearchParams(window.location.search).get('status'); if (s) setTab(s); }, []);
  const list = (rows || []).filter((d) => tab === 'tous' || (tab === 'a_publier' ? d.validated_at && d.status !== 'publie' : d.status === tab));
  const n = (s: string) => (rows || []).filter((d) => d.status === s).length;

  return (
    <>
      <PageHead
        title={me.role === 'client' ? 'Mes projets' : 'Dossiers clients'}
        sub={me.role === 'client' ? 'Suivez chaque prestation, de la signature à la publication.' : 'Signé → Paiement confirmé → Création en cours → En attente de validation → Livré / Publié.'}
      />
      {me.role !== 'client' && (
        <Tabs value={tab} onChange={setTab} items={[
          ['tous', 'Tous'], ['signe', 'Signés', n('signe')], ['paiement_confirme', 'Paiement confirmé', n('paiement_confirme')],
          ['creation_en_cours', 'En création'], ['en_attente_validation', 'En validation', n('en_attente_validation')],
          ['modification_demandee', 'Modifications', n('modification_demandee')], ['a_publier', 'À publier'], ['publie', 'Publiés'], ['livre', 'Livrés'],
        ]} />
      )}
      {list.length === 0 ? <Empty>Aucun dossier.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Dossier</th><th>Statut</th><th>Formule</th><th>Signé par</th><th>CC</th><th>Mis à jour</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="click" onClick={() => setOpen(d.id)}>
                  <td><b>{d.client_name}</b><span className="sub">{SERVICE_TYPE[d.service_type]}</span></td>
                  <td><Badge map={DOSSIER_STATUS} value={d.status} />{d.validated_at && d.status === 'en_attente_validation' && <span className="badge ok" style={{ marginLeft: 6 }}>Validé · à publier</span>}</td>
                  <td>{d.offer || '—'}<span className="sub">{fmtDA(d.amount)}</span></td>
                  <td>{d.signed_by_name || '—'}</td>
                  <td>{d.cc_name || <span className="badge warn">À attribuer</span>}</td>
                  <td>{fmtDate(d.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {open && <DossierModal id={open} onClose={() => setOpen(null)} onDone={reload} />}
    </>
  );
}
