'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Badge, Modal, PageHead, Tabs, useAction, useData, useToast, Empty } from '@/components/ui';
import { api, fmtDA, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DOSSIER_FLOW, DOSSIER_STATUS, PAYMENT_STATUS, ROLE_LABELS, SERVICE_TYPE, TASK_STATUS } from '@/lib/labels';

const PROD_ROLES = ['graphiste', 'community_manager', 'photographe', 'developpeur', 'media_buyer'];

// Coordonnées du client : chaque collaborateur attribué peut le joindre directement
function ClientCard({ c }: { c: any }) {
  const phone = c.phone || c.account_phone;
  const email = c.email || c.account_email;
  return (
    <div className="client-card">
      <h3>Coordonnées du client</h3>
      <dl className="kv">
        <dt>Entreprise</dt><dd>{c.company || c.name}{c.activity && c.activity !== 'Particulier' ? ` · ${c.activity}` : c.specialty ? ` · ${c.specialty}` : ''}</dd>
        <dt>Contact</dt><dd>{c.contact_name || '—'}</dd>
        <dt>Téléphone</dt><dd>{phone ? <a className="link" href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a> : '—'}</dd>
        <dt>E-mail</dt><dd>{email ? <a className="link" href={`mailto:${email}`}>{email}</a> : '—'}</dd>
        <dt>Adresse</dt><dd>{[c.address, c.city].filter(Boolean).join(', ') || '—'}{c.maps_url && <> · <a className="link" href={c.maps_url} target="_blank" rel="noreferrer">Maps</a></>}</dd>
        {(c.website || c.social_url) && <><dt>En ligne</dt><dd>{[c.website, c.social_url].filter(Boolean).map((l: string) => <a key={l} className="link" href={l} target="_blank" rel="noreferrer" style={{ marginRight: 10 }}>{l.replace(/^https?:\/\//, '')}</a>)}</dd></>}
        {c.drive_url && <><dt>Références</dt><dd><a className="link" href={c.drive_url} target="_blank" rel="noreferrer">Dossier Drive du client</a></dd></>}
        {c.documents_url && <><dt>Documents</dt><dd><a className="link" href={c.documents_url} target="_blank" rel="noreferrer">Contrat et documents</a></dd></>}
      </dl>
    </div>
  );
}

// Résumé lisible du lancement automatique de la production après le paiement
function launchText(l: any) {
  if (!l) return '';
  const team = (l.added || []).map((a: any) => `${a.name} (${ROLE_LABELS[a.role] || a.role})`).join(', ');
  return [
    'Production lancée',
    team && `équipe attribuée : ${team}`,
    l.created ? `${l.created} tâche${l.created > 1 ? 's' : ''} créée${l.created > 1 ? 's' : ''} aujourd’hui` : 'les tâches arrivent le prochain jour ouvré',
    l.missing?.length && `à attribuer à la main : ${l.missing.join(', ')}`,
  ].filter(Boolean).join(' · ');
}

// Dossier Drive partagé avec le client : l'équipe le renseigne, le client le voit dans son espace et y dépose ses références
function DriveCard({ d, canEdit, onDone }: { d: any; canEdit: boolean; onDone: () => void }) {
  const run = useAction();
  const [url, setUrl] = useState(d.client?.drive_url || '');
  const current = d.client?.drive_url;
  return (
    <div className="drive-card">
      <div style={{ display: 'grid', gap: 4, flex: '1 1 280px' }}>
        <p><b>Dossier Drive de références</b>{current ? ' · partagé avec le client' : ''}</p>
        {current && <a className="link" href={current} target="_blank" rel="noreferrer" style={{ fontSize: 13, wordBreak: 'break-all' }}>{current}</a>}
        {!current && <p style={{ fontSize: 13, color: 'var(--muted)' }}>Créez un dossier Drive partagé (accès en modification), collez son lien ici : il apparaît aussitôt dans l’espace du client, qui est prévenu par notification et e-mail.</p>}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, flex: '1 1 320px' }}>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://drive.google.com/drive/folders/…" />
          <button className="btn btn-dark" onClick={() => run(() => api(`/dossiers/${d.id}/drive`, { method: 'PUT', body: { drive_url: url } }), url ? 'Lien partagé avec le client' : 'Lien retiré', onDone)}>{current ? 'Mettre à jour' : 'Partager'}</button>
        </div>
      )}
    </div>
  );
}

// Correction du dossier (direction, responsable communication) : formule, montant, paiement, statut
// Offre personnalisée : quotas mensuels et services du catalogue (ou libres) avec leur nombre
type CustomLine = { service_id: string; label: string; quantity: number; unit_price: number };
function CustomOffer({ c, setC }: { c: any; setC: (c: any) => void }) {
  const { data: services } = useData<any[]>('/services');
  const lines: CustomLine[] = c.items;
  const setLine = (i: number, patch: Partial<CustomLine>) => setC({ ...c, items: lines.map((l, k) => (k === i ? { ...l, ...patch } : l)) });
  const once = lines.reduce((sum, l) => sum + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0);
  const num = (k: string) => (e: any) => setC({ ...c, [k]: e.target.value });
  return (
    <div className="custom-offer">
      <h3>Offre personnalisée</h3>
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <label className="field"><span>Posts par mois</span><input className="input" type="number" min={0} value={c.posts_month} onChange={num('posts_month')} /></label>
        <label className="field"><span>Stories par mois</span><input className="input" type="number" min={0} value={c.stories_month} onChange={num('stories_month')} /></label>
        <label className="field"><span>Reels par mois</span><input className="input" type="number" min={0} value={c.reels_month} onChange={num('reels_month')} /></label>
        <label className="field"><span>Prix mensuel (DA HT)</span><input className="input" type="number" min={0} value={c.price_month} onChange={num('price_month')} /></label>
      </div>
      <p className="hint">Les quotas mensuels sont découpés en tâches quotidiennes pour le graphiste, comme pour une formule du site.</p>
      <div className="field">
        <span>Services inclus et leur nombre</span>
        {lines.length > 0 && (
          <div className="table-wrap"><table className="t">
            <thead><tr><th>Service</th><th style={{ width: 90 }}>Nombre</th><th style={{ width: 130 }}>Prix unitaire</th><th style={{ width: 110 }}>Total</th><th style={{ width: 80 }} /></tr></thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i}>
                  <td>{l.service_id ? <b>{l.label}</b> : <input className="input" style={{ height: 34 }} value={l.label} placeholder="Nom du service" onChange={(e) => setLine(i, { label: e.target.value })} />}</td>
                  <td><input className="input" style={{ height: 34 }} type="number" min={1} value={l.quantity} onChange={(e) => setLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} /></td>
                  <td><input className="input" style={{ height: 34 }} type="number" min={0} value={l.unit_price} onChange={(e) => setLine(i, { unit_price: Number(e.target.value) || 0 })} /></td>
                  <td>{fmtDA((Number(l.unit_price) || 0) * (Number(l.quantity) || 0))}</td>
                  <td><button className="btn btn-ghost btn-xs" onClick={() => setC({ ...c, items: lines.filter((_, k) => k !== i) })}>Retirer</button></td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select className="select" style={{ maxWidth: 360 }} value="" onChange={(e) => {
            const sv = services?.find((x) => String(x.id) === e.target.value);
            if (sv) setC({ ...c, items: [...lines, { service_id: String(sv.id), label: sv.name, quantity: 1, unit_price: sv.price }] });
          }}>
            <option value="">+ Ajouter un service du catalogue…</option>
            {services?.map((x) => <option key={x.id} value={x.id}>{x.name} · {fmtDA(x.price)}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => setC({ ...c, items: [...lines, { service_id: '', label: '', quantity: 1, unit_price: 0 }] })}>+ Autre service</button>
        </div>
      </div>
      <p className="custom-total">Mensuel : <b>{fmtDA(Number(c.price_month) || 0)}</b>{once > 0 && <> · Services ponctuels : <b>{fmtDA(once)}</b></>}</p>
    </div>
  );
}

function EditDossier({ d, onDone }: { d: any; onDone: () => void }) {
  const toast = useToast();
  const { data: offers } = useData<any[]>('/offers');
  const isCustom = !!d.offer?.custom_dossier_id;
  const [f, setF] = useState<any>({ offer_id: isCustom ? 'custom' : (d.offer_id || ''), amount: d.amount || 0, payment_status: d.payment_status, payment_mode: d.payment_mode || 'bureau', service_type: d.service_type, status: d.status, note: '' });
  const [custom, setCustom] = useState<any>({
    posts_month: isCustom ? d.offer.posts_month : 0, stories_month: isCustom ? d.offer.stories_month : 0, reels_month: isCustom ? d.offer.reels_month : 0,
    price_month: isCustom ? d.offer.price_month : 0,
    items: (d.items || []).map((i: any) => ({ service_id: i.service_id ? String(i.service_id) : '', label: i.label, quantity: i.quantity, unit_price: i.unit_price })),
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const flow = ['signe', 'paiement_confirme', 'creation_en_cours', 'en_attente_validation', 'modification_demandee', 'livre', 'publie'];
  return (
    <div className="card">
      <h2>Modifier le dossier</h2>
      <div className="grid-3">
        <label className="field"><span>Formule choisie *</span>
          <select className={`select ${!f.offer_id ? 'required-missing' : ''}`} value={f.offer_id} onChange={(e) => {
            const o = offers?.find((x) => String(x.id) === e.target.value);
            setF({ ...f, offer_id: e.target.value, amount: o && !Number(f.amount) ? o.price_month : f.amount });
          }}>
            <option value="" disabled>Choisir la formule…</option>
            {offers?.map((o) => <option key={o.id} value={o.id}>{o.name} · {fmtDA(o.price_month)} / mois</option>)}
            <option value="custom">Offre personnalisée (services et quantités sur mesure)</option>
          </select>
        </label>
        <label className="field"><span>Montant (DA)</span><input className="input" type="number" value={f.amount} onChange={set('amount')} /></label>
        <label className="field"><span>Paiement</span>
          <select className="select" value={f.payment_status} onChange={set('payment_status')}>{Object.entries(PAYMENT_STATUS).map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="field"><span>Mode de paiement</span>
          <select className="select" value={f.payment_mode} onChange={set('payment_mode')}><option value="bureau">Au bureau</option><option value="terrain">Sur le terrain</option><option value="virement">Virement</option></select>
        </label>
        <label className="field"><span>Type de prestation</span>
          <select className="select" value={f.service_type} onChange={set('service_type')}>{Object.entries(SERVICE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
        <label className="field"><span>Étape du dossier</span>
          <select className="select" value={f.status} onChange={set('status')}>{flow.map((k) => <option key={k} value={k}>{DOSSIER_STATUS[k]?.[0] || k}</option>)}</select>
        </label>
      </div>
      {f.offer_id === 'custom' && <CustomOffer c={custom} setC={setCustom} />}
      {f.status !== d.status && (
        <label className="field" style={{ marginTop: 12 }}><span>Raison du changement d’étape (visible dans l’historique)</span><input className="input" value={f.note} onChange={set('note')} placeholder="Ex. : retour en création, le client a envoyé un nouveau logo" /></label>
      )}
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={async () => {
        try {
          if (!f.offer_id) { toast('Choisissez la formule : une formule du site ou une offre personnalisée', true); return; }
          const body = { ...f, ...(f.offer_id === 'custom' ? { custom, amount: Number(f.amount) || Number(custom.price_month) || 0 } : {}) };
          const r = await api(`/dossiers/${d.id}`, { method: 'PATCH', body });
          toast(r.launch ? launchText(r.launch) : 'Dossier mis à jour');
          onDone();
        } catch (e: any) { toast(e.message, true); }
      }}>Enregistrer les modifications</button>
    </div>
  );
}

// Tâches précises du dossier : intitulé, consigne et échéance pour un collaborateur
function DossierTasks({ d, canCreate, onDone }: { d: any; canCreate: boolean; onDone: () => void }) {
  const run = useAction();
  const [open, setOpen] = useState(false);
  const { data: staff } = useData<any[]>(canCreate ? `/users?role=${PROD_ROLES.join(',')},charge_clientele` : null);
  const empty = { assigned_to: '', type: 'conception', theme: '', brief: '', due_date: new Date().toISOString().slice(0, 10), priority: 2 };
  const [f, setF] = useState<any>(empty);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h4 style={{ fontSize: 15, margin: 0 }}>Tâches du client</h4>
        {canCreate && !open && <button className="btn btn-dark btn-sm" onClick={() => setOpen(true)}>+ Donner une tâche</button>}
      </div>
      {open && (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="grid-3">
            <label className="field"><span>Collaborateur</span>
              <select className="select" value={f.assigned_to} onChange={set('assigned_to')}>
                <option value="">Choisir…</option>
                {staff?.map((u) => <option key={u.id} value={u.id}>{u.name} · {ROLE_LABELS[u.role]}</option>)}
              </select>
            </label>
            <label className="field"><span>Type</span>
              <select className="select" value={f.type} onChange={set('type')}>
                <option value="conception">Conception</option><option value="story">Story</option><option value="reel">Reel</option>
                <option value="photo">Photo</option><option value="video">Vidéo</option><option value="dev">Développement</option>
              </select>
            </label>
            <label className="field"><span>Échéance</span><input className="input" type="date" value={f.due_date} onChange={set('due_date')} /></label>
          </div>
          <label className="field" style={{ marginTop: 10 }}><span>Intitulé</span><input className="input" value={f.theme} onChange={set('theme')} placeholder="Ex. : 3 posts promo Ramadan" /></label>
          <label className="field" style={{ marginTop: 10 }}><span>Consigne détaillée</span><textarea className="textarea" value={f.brief} onChange={set('brief')} placeholder="Formats, textes, couleurs, références, à qui envoyer…" /></label>
          <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
            <button className="btn btn-primary" disabled={!f.assigned_to || !f.theme} onClick={() => run(() => api('/tasks', { body: { ...f, dossier_id: d.id } }), 'Tâche envoyée au collaborateur', () => { setF(empty); setOpen(false); onDone(); })}>Envoyer la tâche</button>
          </div>
        </div>
      )}
      {d.tasks?.length ? (
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Tâche</th><th>Collaborateur</th><th>Échéance</th><th>Statut</th></tr></thead>
          <tbody>
            {d.tasks.map((t: any) => (
              <tr key={t.id}>
                <td><b>{t.theme || t.type}</b>{t.brief && <span className="sub">{t.brief}</span>}</td>
                <td>{t.assigned_name}</td><td>{fmtDate(t.due_date)}</td>
                <td><Badge map={TASK_STATUS} value={t.status} /></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>Aucune tâche pour l’instant.{canCreate ? ' Donnez une tâche précise à chaque collaborateur.' : ''}</p>}
    </div>
  );
}

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

// Équipe du client : le formulaire part de l'équipe actuelle ; chaque choix remplace la personne
// précédente pour ce rôle (ses tâches en cours lui sont transférées), « — » retire le rôle.
const TEAM_FIELDS = ['charge_clientele', 'graphiste', 'community_manager', 'photographe', 'developpeur', 'media_buyer'];
function TeamForm({ d, staff, onDone }: { d: any; staff: any[]; onDone: () => void }) {
  const run = useAction();
  const initial = Object.fromEntries(TEAM_FIELDS.map((r) => [r, String(
    (r === 'charge_clientele' && d.cc_id) || d.team.find((t: any) => t.role === r)?.id || '')]));
  const [members, setMembers] = useState<Record<string, string>>(initial);
  const [service, setService] = useState(d.service_type);
  // Les listes contiennent aussi les personnes qui ont ce rôle en rôle supplémentaire
  const byRole = (r: string) => staff.filter((u) => u.role === r || String(u.extra_roles || '').split(',').includes(r));
  const changed = TEAM_FIELDS.some((r) => members[r] !== initial[r]) || service !== d.service_type;
  return (
    <div className="card">
      <h2>{d.status === 'paiement_confirme' ? 'Attribuer l’équipe et lancer la production' : 'Équipe du client'}</h2>
      <div className="grid-2">
        <label className="field"><span>Type de prestation</span>
          <select className="select" value={service} onChange={(e) => setService(e.target.value)}>
            {Object.entries(SERVICE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        {TEAM_FIELDS.map((r) => (
          <label className="field" key={r}><span>{ROLE_LABELS[r]}</span>
            <select className="select" value={members[r]} onChange={(e) => setMembers({ ...members, [r]: e.target.value })}>
              <option value="">— Personne</option>
              {byRole(r).map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </label>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 14, flexWrap: 'wrap' }}>
        <button className="btn btn-primary" disabled={!changed && d.status !== 'paiement_confirme'} onClick={() => run(
          () => api(`/dossiers/${d.id}/assign`, { body: { members, service_type: service } }),
          d.status === 'paiement_confirme' ? 'Production lancée' : 'Équipe enregistrée', onDone)}>
          {d.status === 'paiement_confirme' ? 'Lancer la production' : 'Enregistrer l’équipe'}
        </button>
        {changed && <span style={{ fontSize: 13, color: 'var(--muted)' }}>Modifications non enregistrées</span>}
      </div>
    </div>
  );
}

function DossierModal({ id, onClose, onDone }: { id: number; onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const run = useAction();
  const toast = useToast();
  const { data: d, reload } = useData<any>(`/dossiers/${id}`);
  const isResp = ['responsable_communication', 'admin'].includes(me.role);
  const { data: staff } = useData<any[]>(isResp ? '/users?role=charge_clientele,graphiste,community_manager,photographe,developpeur,media_buyer' : null);
  const [note, setNote] = useState('');
  const done = () => { reload(); onDone(); };
  const act = (path: string, body: any, msg: string) => run(() => api(`/dossiers/${id}/${path}`, { body }), msg, done);

  if (!d) return <Modal title="Dossier" onClose={onClose}><p>Chargement…</p></Modal>;
  const awaitingClient = d.status === 'en_attente_validation' && !d.validated_at;
  const canTask = ['admin', 'responsable_communication', 'responsable_technique'].includes(me.role);
  const canDrive = ['admin', 'responsable_communication', 'charge_clientele', 'responsable_technique', 'community_manager'].includes(me.role);
  const removeDossier = () => {
    if (!confirm(`Supprimer le dossier ${d.title} ? Son historique sera perdu.`)) return;
    run(() => api(`/dossiers/${d.id}`, { method: 'DELETE' }), 'Dossier supprimé', () => { onDone(); onClose(); });
  };

  return (
    <Modal title={d.title} onClose={onClose} wide>
      <Flow status={d.status} service={d.service_type} />
      <dl className="kv">
        <dt>Client</dt><dd>{d.client_name}</dd>
        <dt>Prestation</dt><dd>{SERVICE_TYPE[d.service_type]}</dd>
        <dt>Formule</dt><dd>{d.offer ? <>
          {d.offer.name} · {fmtDA(d.offer.price_month)} / mois
          {d.offer.custom_dossier_id && <span className="sub">{[d.offer.posts_month && `${d.offer.posts_month} posts`, d.offer.stories_month && `${d.offer.stories_month} stories`, d.offer.reels_month && `${d.offer.reels_month} reels`].filter(Boolean).join(', ') || 'Sans quota mensuel'}</span>}
          {d.items?.length > 0 && <span className="sub">{d.items.map((i: any) => `${i.quantity} × ${i.label}`).join(' · ')} · {fmtDA(d.items.reduce((sum: number, i: any) => sum + i.total, 0))} ponctuel</span>}
        </> : <span className="badge danger">Formule à choisir</span>}</dd>
        <dt>Montant</dt><dd>{fmtDA(d.amount)} · paiement {d.payment_mode} · <Badge map={PAYMENT_STATUS} value={d.payment_status || 'en_attente'} /></dd>
        <dt>Paiement confirmé</dt><dd>{fmtDate(d.payment_confirmed_at, true)}</dd>
        <dt>Équipe</dt><dd>{d.team.length ? d.team.map((t: any) => `${t.name} (${ROLE_LABELS[t.role] || t.role})`).join(', ') : '—'}</dd>
        {d.validated_at && <><dt>Validé par le client</dt><dd>{fmtDate(d.validated_at, true)}</dd></>}
      </dl>
      {d.client && <ClientCard c={d.client} />}
      {d.client && <DriveCard d={d} canEdit={canDrive} onDone={done} key={d.client.drive_url || 'none'} />}
      {isResp && <EditDossier d={d} onDone={done} key={`${d.status}-${d.payment_status}-${d.offer_id}`} />}

      {isResp && d.status === 'signe' && (
        <div className="card" style={{ background: 'var(--warn-soft)', borderColor: 'transparent' }}>
          <h2>Vérifier le paiement</h2>
          <p style={{ margin: '0 0 12px', fontSize: 14 }}>Dès que le paiement est confirmé, le CRM attribue l’équipe (chargé de clientèle, graphiste, community manager… selon la prestation, au moins chargé d’abord) et répartit les tâches selon la formule.</p>
          {!d.offer_id && <p style={{ margin: '0 0 12px', fontSize: 14, color: 'var(--danger)' }}>Choisissez d’abord la formule (du site ou personnalisée) dans « Modifier le dossier » ci-dessus.</p>}
          <button className="btn btn-dark" disabled={!d.offer_id} onClick={async () => {
            try { const r = await api(`/dossiers/${id}/confirm-payment`, { body: {} }); toast(`Paiement confirmé · ${launchText(r.launch)}`); done(); } catch (e: any) { toast(e.message, true); }
          }}>Confirmer le paiement et lancer la production</button>
        </div>
      )}

      {isResp && d.status !== 'signe' && (
        <TeamForm d={d} staff={staff || []} onDone={done} key={`${d.cc_id}-${d.team.map((t: any) => `${t.role}:${t.id}`).join(',')}`} />
      )}

      {['charge_clientele', 'responsable_communication', 'admin'].includes(me.role) && ['creation_en_cours', 'modification_demandee'].includes(d.status) && (
        <button className="btn btn-dark" style={{ justifySelf: 'start' }} onClick={() => act('submit', {}, 'Présenté au client')}>Présenter au client pour validation</button>
      )}

      {['charge_clientele', 'client', 'admin'].includes(me.role) && awaitingClient && (
        <div className="card">
          <h2>Décision du client</h2>
          <label className="field"><span>Note (obligatoire pour une modification)</span><textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} /></label>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button className="btn btn-ok" onClick={() => act('decision', { decision: 'valider', note }, 'Validé')}>Valider</button>
            <button className="btn btn-danger" disabled={!note} onClick={() => act('decision', { decision: 'modifier', note }, 'Modification demandée')}>Demander une modification</button>
          </div>
        </div>
      )}

      {['community_manager', 'responsable_communication', 'admin'].includes(me.role) && d.validated_at && d.status !== 'publie' && d.service_type !== 'developpement' && (
        <button className="btn btn-primary" style={{ justifySelf: 'start' }} onClick={() => act('publish', {}, 'Publié')}>Marquer comme publié</button>
      )}

      {me.role !== 'client' && <DossierTasks d={d} canCreate={canTask} onDone={done} />}

      <div>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Historique</h4>
        <div className="timeline">
          {d.history.map((h: any) => (
            <div key={h.id}><div><b>{DOSSIER_STATUS[h.status]?.[0] || (h.status === 'valide' ? 'Validé par le client' : h.status)}</b> — {h.user_name || 'CRM'}<small>{fmtDate(h.created_at, true)}{h.note ? ` · ${h.note}` : ''}</small></div></div>
          ))}
        </div>
      </div>
      {me.role === 'admin' && <button className="btn btn-ghost btn-sm danger-text" style={{ justifySelf: 'start' }} onClick={removeDossier}>Supprimer le dossier</button>}
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
        sub={me.role === 'client' ? 'Suivez chaque prestation, de la signature à la publication.' : 'Signé → Payé (équipe et tâches attribuées automatiquement selon la formule) → Création → Présenté au client → Validé → Publié ou livré. La direction et le responsable communication peuvent corriger une étape à tout moment.'}
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
            <thead><tr><th>Dossier</th><th>Statut</th><th>Formule</th><th>Paiement</th><th>Signé par</th><th>CC</th><th>Mis à jour</th></tr></thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} className="click" onClick={() => setOpen(d.id)}>
                  <td><b>{d.client_name}</b><span className="sub">{SERVICE_TYPE[d.service_type]}</span></td>
                  <td><Badge map={DOSSIER_STATUS} value={d.status} />{d.validated_at && d.status === 'en_attente_validation' && <span className="badge ok" style={{ marginLeft: 6 }}>Validé · à publier</span>}</td>
                  <td>{d.offer || '—'}<span className="sub">{fmtDA(d.amount)}</span></td>
                  <td><Badge map={PAYMENT_STATUS} value={d.payment_status || 'en_attente'} /></td>
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
