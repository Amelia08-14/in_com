'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Badge, Modal, PageHead, Tabs, useAction, useData, useToast, Empty } from '@/components/ui';
import { api, fmtDA, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DOSSIER_FLOW, DOSSIER_STATUS, PAYMENT_STATUS, ROLE_LABELS, SERVICE_TYPE, TASK_STATUS } from '@/lib/labels';
import NextStep, { type Step } from '@/components/NextStep';
import CustomOffer, { ServiceLines } from '@/components/CustomOffer';

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
        {!current && <p style={{ fontSize: 13, color: 'var(--muted)' }}>{canEdit
          ? 'Créez un dossier Drive partagé (accès en modification), collez son lien ici : il apparaît aussitôt dans l’espace du client, qui est prévenu par notification et e-mail.'
          : 'Pas encore de dossier partagé : la direction ou le responsable technique le renseigne.'}</p>}
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

// Correction du dossier (direction, responsable communication) : formule, montant, statut
function EditDossier({ d, onDone }: { d: any; onDone: () => void }) {
  const toast = useToast();
  const { data: offers } = useData<any[]>('/offers');
  const isCustom = !!d.offer?.custom_dossier_id;
  const [f, setF] = useState<any>({ offer_id: isCustom ? 'custom' : (d.offer_id || ''), amount: d.amount || 0, engagement_months: d.engagement_months || '', payment_status: d.payment_status || 'en_attente', payment_mode: d.payment_mode || 'bureau', service_type: d.service_type, status: d.status, note: '' });
  // Pack : services en plus du pack (les services du dossier quand ce n'est pas une formule sur mesure)
  const [extras, setExtras] = useState<any[]>(isCustom ? [] : (d.items || []).map((i: any) => ({ service_id: i.service_id ? String(i.service_id) : '', label: i.label, quantity: i.quantity, unit_price: i.unit_price })));
  const [custom, setCustom] = useState<any>({
    posts_month: isCustom ? d.offer.posts_month : 0, stories_month: isCustom ? d.offer.stories_month : 0, reels_month: isCustom ? d.offer.reels_month : 0,
    price_month: isCustom ? d.offer.price_month : 0,
    items: (d.items || []).map((i: any) => ({ service_id: i.service_id ? String(i.service_id) : '', label: i.label, quantity: i.quantity, unit_price: i.unit_price })),
  });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  const flow = DOSSIER_FLOW.includes(d.status) ? DOSSIER_FLOW : [...DOSSIER_FLOW, d.status];
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
            {offers?.map((o) => <option key={o.id} value={o.id}>Pack {o.name} · {fmtDA(o.price_month)} / mois</option>)}
            <option value="custom">Formule sur mesure (posts, stories, reels, services et prix au choix)</option>
          </select>
        </label>
        <label className="field"><span>Montant mensuel (DA)</span><input className="input" type="number" value={f.amount} onChange={set('amount')} /></label>
        <label className="field"><span>Statut du paiement (correction)</span>
          <select className="select" value={f.payment_status} onChange={set('payment_status')}>
            <option value="paye">Payé</option><option value="en_attente">Pas encore payé (annule un paiement saisi par erreur)</option><option value="non_paye">Non payé (impayé)</option>
          </select>
        </label>
        <label className="field"><span>Période d’engagement</span>
          <select className="select" value={f.engagement_months} onChange={set('engagement_months')}>
            <option value="">Non précisée</option>{[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} mois</option>)}
          </select>
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
      {f.offer_id && f.offer_id !== 'custom' && <div style={{ marginTop: 14 }}><ServiceLines title="Services en plus du pack" lines={extras} setLines={setExtras} /></div>}
      {f.status !== d.status && (
        <label className="field" style={{ marginTop: 12 }}><span>Raison du changement d’étape (visible dans l’historique)</span><input className="input" value={f.note} onChange={set('note')} placeholder="Ex. : retour en création, le client a envoyé un nouveau logo" /></label>
      )}
      <button className="btn btn-primary" style={{ marginTop: 14 }} onClick={async () => {
        try {
          if (!f.offer_id) { toast('Choisissez la formule : un pack ou une formule sur mesure', true); return; }
          if (d.payment_status === 'paye' && f.payment_status !== 'paye'
            && !confirm('Annuler le paiement ? Les encaissements sont supprimés, le dossier revient « à encaisser » et les tâches pas encore commencées sont retirées.')) return;
          const body = { ...f, ...(f.offer_id === 'custom' ? { custom, amount: Number(f.amount) || Number(custom.price_month) || 0 } : { items: extras }) };
          const r = await api(`/dossiers/${d.id}`, { method: 'PATCH', body });
          toast(r.launch ? launchText(r.launch) : 'Dossier mis à jour');
          onDone();
        } catch (e: any) { toast(e.message, true); }
      }}>Enregistrer les modifications</button>
    </div>
  );
}

// Tâches précises du dossier : intitulé, consigne et échéance pour un collaborateur
// Les tâches de la formule sont automatiques : on le dit clairement, avec les quantités
function autoText(d: any) {
  const o = d.offer;
  const q = o ? [o.posts_month && `${o.posts_month} posts`, o.stories_month && `${o.stories_month} stories`, o.reels_month && `${o.reels_month} reels`].filter(Boolean).join(', ') : '';
  if (!o) return 'Tâches automatiques : choisissez d’abord la formule (pack ou sur mesure), le CRM répartira ensuite les tâches tout seul.';
  if (!q) return 'Cette formule n’a pas de quota mensuel : seuls ses services ponctuels deviennent des tâches, au paiement.';
  if (d.status === 'signe') return `Tâches automatiques : dès le paiement confirmé, ${q} par mois sont répartis chaque jour ouvré entre les tâches du graphiste. Rien à créer à la main.`;
  return `Tâches automatiques : ${q} par mois, réparties chaque jour ouvré pour le graphiste du client. Le formulaire ci-dessus ne sert qu’aux demandes en plus de la formule.`;
}

function DossierTasks({ d, canCreate, onDone }: { d: any; canCreate: boolean; onDone: () => void }) {
  const run = useAction();
  const isAdmin = useMe().role === 'admin';
  const [open, setOpen] = useState(false);
  const { data: staff } = useData<any[]>(canCreate ? `/users?role=${PROD_ROLES.join(',')},charge_clientele` : null);
  const empty = { assigned_to: '', type: 'conception', theme: '', brief: '', due_date: new Date().toISOString().slice(0, 10), priority: 2 };
  const [f, setF] = useState<any>(empty);
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.value });
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <h4 style={{ fontSize: 15, margin: 0 }}>Tâches du client</h4>
        {canCreate && !open && <button className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>+ Tâche ponctuelle (hors formule)</button>}
      </div>
      <p className="progress-line" style={{ margin: '0 0 10px' }}>{autoText(d)}</p>
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
          <thead><tr><th>Tâche</th><th>Collaborateur</th><th>Échéance</th><th>Statut</th>{isAdmin && <th />}</tr></thead>
          <tbody>
            {d.tasks.map((t: any) => (
              <tr key={t.id}>
                <td><b>{t.theme || t.type}</b>{t.brief && <span className="sub">{t.brief}</span>}</td>
                <td>{t.assigned_name}</td><td>{fmtDate(t.due_date)}</td>
                <td><Badge map={TASK_STATUS} value={t.status} /></td>
                {isAdmin && <td><button className="btn btn-ghost btn-xs danger-text" onClick={() => confirm(`Supprimer la tâche « ${t.theme || t.type} » ?`) && run(() => api(`/tasks/${t.id}`, { method: 'DELETE' }), 'Tâche supprimée', onDone)}>Supprimer</button></td>}
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : <p style={{ color: 'var(--muted)', margin: 0, fontSize: 14 }}>Aucune tâche pour l’instant.{canCreate ? ' Donnez une tâche précise à chaque collaborateur.' : ''}</p>}
    </div>
  );
}

function Flow({ status }: { status: string }) {
  const idx = Math.max(0, DOSSIER_FLOW.indexOf(status));
  const labels: Record<string, string> = { signe: 'Signé · paiement', creation_en_cours: 'En production', livre: 'Livré' };
  return (
    <div className="pipeline">
      {DOSSIER_FLOW.map((s, i) => (
        <span key={s} className={i < idx || status === 'livre' ? 'done' : i === idx ? 'cur' : ''}>{labels[s]}</span>
      ))}
    </div>
  );
}

// Fin de l'engagement : date du paiement + nombre de mois
function engagementEnd(d: any) {
  const t = new Date(String(d.payment_confirmed_at).replace(' ', 'T'));
  t.setMonth(t.getMonth() + Number(d.engagement_months));
  return t.toISOString().slice(0, 10);
}

// Avancement de la production : du mois (abonnement) ou du projet
function progressText(p: any) {
  if (!p) return '';
  const total = Math.max(Number(p.quota) || 0, Number(p.total) || 0);
  if (!total) return p.monthly ? 'Les tâches du mois arrivent chaque jour ouvré.' : 'Aucune tâche pour l’instant.';
  return [`${p.monthly ? 'Ce mois' : 'Projet'} : ${p.done || 0} / ${total} validé${(p.done || 0) > 1 ? 's' : ''}`,
    Number(p.in_review) > 0 && `${p.in_review} en validation`, Number(p.todo) > 0 && `${p.todo} à produire`].filter(Boolean).join(' · ');
}

const PROD = ['graphiste', 'photographe', 'developpeur', 'media_buyer', 'community_manager'];
// Prochaine étape du dossier, dite à la personne qui le regarde
function dossierStep(d: any, me: any): Step {
  const role = me.role;
  const canPay = CASHIERS.includes(role);
  const isResp = ['responsable_communication', 'admin'].includes(role);
  const signer = d.signed_by_name || 'le commercial';
  if (d.status === 'signe') {
    if (role === 'client') return { tone: 'wait', title: 'Paiement attendu', you: 'Dès réception de votre paiement, votre équipe IN COM est attribuée et la production démarre.' };
    if (!d.offer_id) return isResp
      ? { title: 'Définir la formule du client', you: 'Choisissez la formule dans « Modifier le dossier » : pack ou formule sur mesure.', then: 'le recouvrement pourra confirmer le paiement.' }
      : { tone: 'wait', title: 'Offre à définir', you: 'Le responsable communication définit l’formule sur mesure, puis le paiement est encaissé.' };
    if (canPay) return { title: 'Confirmer le paiement', you: `Contrat de ${fmtDA(d.contract_total)}${Number(d.engagement_months) > 1 ? ` sur ${d.engagement_months} mois : choisissez paiement complet, mensuel ou acompte, ` : ' : '}vérifiez le versement et confirmez.`, then: `le chargé de clientèle et l’équipe de production sont attribués, les tâches sont créées. Le client et ${signer} sont prévenus.` };
    return { tone: 'wait', title: 'Paiement attendu', you: 'Le recouvrement encaisse et confirme le paiement.', then: 'la production démarre toute seule et vous êtes prévenu.' };
  }
  if (d.status === 'livre') {
    const monthly = d.service_type === 'abonnement';
    return { tone: 'done', title: monthly ? 'Mois livré' : 'Projet livré',
      you: d.signed_by === me.id ? 'Appelez le client pour son avis et proposez la suite (extra, renouvellement).'
        : monthly ? 'La production du mois est terminée. Le dossier repasse en production avec les tâches du mois suivant.' : 'Toutes les tâches sont validées.' };
  }
  // En production sans formule : aucune tâche ne peut être créée
  if (!d.offer_id) return ['responsable_communication', 'admin'].includes(role)
    ? { title: 'Choisir la formule du client', you: 'Ce dossier est en production sans formule : aucune tâche n’est créée. Choisissez un pack ou une formule sur mesure dans « Modifier le dossier ».', then: 'l’équipe manquante est attribuée et les tâches du jour sont créées aussitôt.' }
    : { tone: 'wait', title: 'Formule manquante', you: 'Aucune tâche n’est créée tant que le responsable communication n’a pas choisi la formule (pack ou sur mesure).' };
  const progress = progressText(d.progress);
  if (role === 'client') return { tone: 'wait', title: 'Production en cours', you: progress, then: 'validez chaque contenu dans « À valider ». Le projet passe « Livré » quand tout est produit.' };
  if (role === 'charge_clientele') return { title: 'Faire valider le client', you: `${progress}. Relancez le client si un contenu attend depuis plus de 48 h.`, then: 'chaque contenu validé part au community manager.' };
  if (PROD.includes(role)) return { title: 'Produire', you: `${progress}. Vos tâches sont dans « Mes tâches ».`, then: 'chaque envoi passe en validation technique, puis chez le client.' };
  return { tone: 'wait', title: 'En production', you: progress, then: 'le dossier passe « Livré » tout seul quand tout est validé et publié ; le client et le commercial sont prévenus.' };
}

// Paiement : un seul geste, par le recouvrement ou le responsable communication
const CASHIERS = ['admin', 'recouvrement', 'responsable_communication', 'responsable_commercial'];
const EDITORS = ['admin', 'responsable_communication', 'responsable_commercial', 'responsable_technique'];
const PLANS: [string, string, string][] = [
  ['complet', 'Paiement complet', 'tout le contrat est payé maintenant'],
  ['mensuel', 'Paiement mensuel', 'une mensualité maintenant, les suivantes chaque mois'],
  ['acompte', 'Acompte', 'une partie maintenant, le reste plus tard'],
];

// Premier paiement : complet, mensuel ou acompte. Le montant proposé suit le plan choisi.
function PaymentCard({ d, onDone }: { d: any; onDone: () => void }) {
  const toast = useToast();
  const monthly = Number(d.offer?.price_month) || 0;
  const total = Number(d.contract_total) || 0;
  const months = Number(d.engagement_months) || 1;
  const [plan, setPlan] = useState('');
  const [amount, setAmount] = useState<any>('');
  const [mode, setMode] = useState(d.payment_mode || 'bureau');
  const pick = (p: string) => { setPlan(p); setAmount(p === 'complet' ? total : p === 'mensuel' ? monthly : ''); };
  const rest = Math.max(0, total - (Number(amount) || 0));
  return (
    <div className="card">
      <h2>Encaisser et lancer la production</h2>
      {!d.offer_id && <p className="form-err" style={{ margin: '0 0 10px' }}>Choisissez la formule dans « Modifier le dossier » plus bas, puis cliquez « Enregistrer les modifications » : le plan de paiement s’affiche ici.</p>}
      {!d.engagement_months && d.offer_id && <p className="progress-line" style={{ margin: '0 0 10px', color: 'var(--warn)' }}>Période d’engagement non précisée : le contrat est compté sur 1 mois. Précisez-la dans « Modifier le dossier » pour payer en plusieurs fois.</p>}
      <p className="progress-line" style={{ margin: '0 0 10px' }}>Contrat : <b>{fmtDA(total)}</b>{d.engagement_months ? ` (${d.engagement_months} mois × ${fmtDA(monthly)}${total > monthly * d.engagement_months ? ' + services' : ''})` : ''}</p>
      {d.offer_id && (
        <div className="plan-choice" role="radiogroup" aria-label="Plan de paiement">
          {PLANS.map(([k, l, sub]) => (
            <button type="button" key={k} role="radio" aria-checked={plan === k} className={plan === k ? 'on' : ''} onClick={() => pick(k)}>
              <b>{l}</b><small>{k === 'complet' ? `${fmtDA(total)} maintenant` : k === 'mensuel' ? `${fmtDA(monthly)} par mois pendant ${months} mois` : sub}</small>
            </button>
          ))}
        </div>
      )}
      <div className="grid-2">
        <label className="field"><span>Montant encaissé maintenant (DA)</span><input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label className="field"><span>Mode de paiement</span>
          <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}><option value="bureau">Au bureau</option><option value="terrain">Sur le terrain</option><option value="virement">Virement</option></select>
        </label>
      </div>
      {plan && Number(amount) > 0 && <p className="progress-line" style={{ margin: '8px 0 0' }}>{rest ? `Reste à encaisser ensuite : ${fmtDA(rest)}` : 'Le contrat sera soldé.'}</p>}
      <button className="btn btn-primary" style={{ marginTop: 12 }} disabled={!d.offer_id || !plan || !Number(amount)} onClick={async () => {
        try { const r = await api(`/dossiers/${d.id}/confirm-payment`, { body: { plan, amount, payment_mode: mode } }); toast(`Paiement confirmé · ${launchText(r.launch)}`); onDone(); } catch (e: any) { toast(e.message, true); }
      }}>Confirmer le paiement</button>
    </div>
  );
}

// Encaissements du contrat : déjà payé, reste, et ajout d'une mensualité ou du solde
function PaymentsCard({ d, canCash, onDone }: { d: any; canCash: boolean; onDone: () => void }) {
  const run = useAction();
  const total = Number(d.contract_total) || 0;
  const paid = Number(d.paid_total) || 0;
  const rest = Math.max(0, total - paid);
  const [amount, setAmount] = useState<any>(d.payment_plan === 'mensuel' ? Math.min(rest, Number(d.offer?.price_month) || rest) : rest);
  const [mode, setMode] = useState(d.payment_mode || 'bureau');
  return (
    <div className="card">
      <h2>Encaissements</h2>
      <p style={{ margin: '0 0 10px', fontSize: 14 }}>
        Contrat <b>{fmtDA(total)}</b> · encaissé <b>{fmtDA(paid)}</b> · {rest ? <>reste <b style={{ color: 'var(--danger)' }}>{fmtDA(rest)}</b></> : <span className="badge ok">Soldé</span>}
        {d.payment_plan && <span className="sub">Plan : {PLANS.find(([k]) => k === d.payment_plan)?.[1]}</span>}
      </p>
      {d.payments?.length > 0 && (
        <div className="table-wrap"><table className="t">
          <thead><tr><th>Date</th><th>Montant</th><th>Mode</th><th>Note</th>{canCash && <th />}</tr></thead>
          <tbody>{d.payments.map((p: any) => (
            <tr key={p.id}><td>{fmtDate(p.paid_at, true)}</td><td><b>{fmtDA(p.amount)}</b></td><td>{p.mode || '—'}</td><td>{p.note || '—'}{p.user_name && <span className="sub">{p.user_name}</span>}</td>
              {canCash && <td><button className="btn btn-ghost btn-xs danger-text" onClick={() => confirm(`Supprimer l’encaissement de ${fmtDA(p.amount)} (erreur de saisie) ?`) && run(() => api(`/dossiers/${d.id}/payments/${p.id}`, { method: 'DELETE' }), 'Encaissement supprimé', onDone)}>Supprimer</button></td>}
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {canCash && rest > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end', marginTop: 12 }}>
          <label className="field" style={{ flex: '1 1 160px' }}><span>Nouvel encaissement (DA)</span><input className="input" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
          <label className="field" style={{ flex: '1 1 140px' }}><span>Mode</span>
            <select className="select" value={mode} onChange={(e) => setMode(e.target.value)}><option value="bureau">Au bureau</option><option value="terrain">Sur le terrain</option><option value="virement">Virement</option></select>
          </label>
          <button className="btn btn-dark" disabled={!Number(amount)} onClick={() => run(() => api(`/dossiers/${d.id}/payments`, { body: { amount, mode } }), 'Encaissement enregistré', onDone)}>Enregistrer l’encaissement</button>
        </div>
      )}
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
  const { data: d, reload, error } = useData<any>(`/dossiers/${id}`);
  const isResp = ['responsable_communication', 'admin'].includes(me.role);
  const { data: staff } = useData<any[]>(isResp ? '/users?role=charge_clientele,graphiste,community_manager,photographe,developpeur,media_buyer' : null);
  const done = () => { reload(); onDone(); };

  // En cas d'erreur, le message de l'API s'affiche au lieu d'un chargement sans fin
  if (!d) return <Modal title="Dossier" onClose={onClose}>{error ? <p className="form-err">Impossible d’ouvrir le dossier : {error}</p> : <p>Chargement…</p>}</Modal>;
  // La carte de paiement s'affiche dès « Signé », même sans formule (elle dit alors quoi faire)
  const canPay = CASHIERS.includes(me.role) && d.status === 'signe';
  const canEdit = EDITORS.includes(me.role);
  const canTask = ['admin', 'responsable_communication', 'responsable_technique'].includes(me.role);
  // Le lien Drive est renseigné par la direction ou le responsable technique uniquement
  const canDrive = ['admin', 'responsable_technique'].includes(me.role);
  const removeDossier = () => {
    if (!confirm(`Supprimer le dossier ${d.title} ? Son historique sera perdu.`)) return;
    run(() => api(`/dossiers/${d.id}`, { method: 'DELETE' }), 'Dossier supprimé', () => { onDone(); onClose(); });
  };

  return (
    <Modal title={d.title} onClose={onClose} wide>
      <Flow status={d.status} />
      <NextStep step={dossierStep(d, me)} />
      {canPay && <PaymentCard d={d} onDone={done} key={`${d.contract_total}-${d.engagement_months}`} />}
      {d.status !== 'signe' && me.role !== 'client' && <PaymentsCard d={d} canCash={CASHIERS.includes(me.role)} onDone={done} key={`${d.paid_total}-${d.contract_total}`} />}
      <dl className="kv">
        <dt>Client</dt><dd>{d.client_name}</dd>
        <dt>Prestation</dt><dd>{SERVICE_TYPE[d.service_type]}</dd>
        <dt>Formule</dt><dd>{d.offer ? <>
          {d.offer.name} · {fmtDA(d.offer.price_month)} / mois
          {d.offer.custom_dossier_id && <span className="sub">{[d.offer.posts_month && `${d.offer.posts_month} posts`, d.offer.stories_month && `${d.offer.stories_month} stories`, d.offer.reels_month && `${d.offer.reels_month} reels`].filter(Boolean).join(', ') || 'Sans quota mensuel'}</span>}
          {d.items?.length > 0 && <span className="sub">{d.items.map((i: any) => `${i.quantity} × ${i.label}`).join(' · ')} · {fmtDA(d.items.reduce((sum: number, i: any) => sum + i.total, 0))} ponctuel</span>}
        </> : <span className="badge danger">Formule à choisir</span>}</dd>
        <dt>Paiement</dt><dd>Contrat {fmtDA(d.contract_total)} · encaissé {fmtDA(d.paid_total)}{Number(d.contract_total) > Number(d.paid_total) ? ` · reste ${fmtDA(Number(d.contract_total) - Number(d.paid_total))}` : ''} · <Badge map={PAYMENT_STATUS} value={d.payment_status || 'en_attente'} /></dd>
        <dt>Engagement</dt><dd>{d.engagement_months ? <>{d.engagement_months} mois{d.payment_confirmed_at && <> · jusqu’au {fmtDate(engagementEnd(d))}</>}</> : <span className="badge warn">À préciser</span>}</dd>
        <dt>Paiement confirmé</dt><dd>{fmtDate(d.payment_confirmed_at, true)}</dd>
        <dt>Équipe</dt><dd>{d.team.length ? d.team.map((t: any) => `${t.name} (${ROLE_LABELS[t.role] || t.role})`).join(', ') : '—'}</dd>
        {d.status !== 'signe' && <><dt>Avancement</dt><dd>{progressText(d.progress)}</dd></>}
        {d.carts?.length > 0 && <><dt>Devis</dt><dd>{d.carts.map((c: any) => c.code).join(', ')} · suit ce dossier</dd></>}
      </dl>
      {d.client && <ClientCard c={d.client} />}
      {d.client && <DriveCard d={d} canEdit={canDrive} onDone={done} key={d.client.drive_url || 'none'} />}
      {canEdit && <EditDossier d={d} onDone={done} key={`${d.status}-${d.payment_status}-${d.offer_id}`} />}

      {isResp && d.status !== 'signe' && (
        <TeamForm d={d} staff={staff || []} onDone={done} key={`${d.cc_id}-${d.team.map((t: any) => `${t.role}:${t.id}`).join(',')}`} />
      )}

      {me.role !== 'client' && <DossierTasks d={d} canCreate={canTask} onDone={done} />}

      <div>
        <h4 style={{ fontSize: 15, marginBottom: 10 }}>Historique</h4>
        <div className="timeline">
          {d.history.map((h: any) => (
            <div key={h.id}><div><b>{{ signe: 'Signé', creation_en_cours: 'En production' }[h.status as string] || DOSSIER_STATUS[h.status]?.[0] || (h.status === 'valide' ? 'Validé par le client' : h.status)}</b> — {h.user_name || 'CRM'}<small>{fmtDate(h.created_at, true)}{h.note ? ` · ${h.note}` : ''}</small></div></div>
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
  const list = (rows || []).filter((d) => tab === 'tous' || d.status === tab);
  const n = (s: string) => (rows || []).filter((d) => d.status === s).length;

  return (
    <>
      <PageHead
        title={me.role === 'client' ? 'Mes projets' : 'Dossiers clients'}
        sub={me.role === 'client' ? 'Suivez chaque prestation, de la signature à la livraison. Vous validez chaque contenu dans « À valider ».'
          : 'Signé → paiement confirmé (équipe et tâches attribuées toutes seules) → En production (validation conception par conception) → Livré dès que le mois ou le projet est produit.'}
      />
      {me.role !== 'client' && (
        <Tabs value={tab} onChange={setTab} items={[
          ['tous', 'Tous'], ['signe', 'À encaisser', n('signe')], ['creation_en_cours', 'En production', n('creation_en_cours')], ['livre', 'Livrés', n('livre')],
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
                  <td><Badge map={DOSSIER_STATUS} value={d.status} /></td>
                  <td>{d.offer || '—'}<span className="sub">{fmtDA(d.amount)}</span></td>
                  <td><Badge map={PAYMENT_STATUS} value={d.payment_status || 'en_attente'} />{d.status !== 'signe' && Number(d.contract_total) > Number(d.paid_total) && <span className="sub">reste {fmtDA(Number(d.contract_total) - Number(d.paid_total))}</span>}</td>
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
