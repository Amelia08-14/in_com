'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react';
import { Badge, Modal, PageHead, useData, useToast, Empty } from '@/components/ui';
import { api, qs, fmtDate } from '@/lib/api';
import { useMe } from '@/lib/me';
import { DEAL_STATUS, PROSPECT_LABEL, REASON_LABEL } from '@/lib/labels';

const REASONS: Record<string, string[]> = {
  commercial_sedentaire: ['prospect', 'relance_sedentaire', 'relance_terrain', 'relance_visite', 'deal_terrain', 'deal_bureau', 'signe'],
  commercial_terrain: ['prospect', 'promesse', 'a_eviter', 'signe'],
  responsable_commercial: ['prospect', 'relance_sedentaire', 'relance_terrain', 'relance_visite', 'deal_terrain', 'deal_bureau', 'promesse', 'a_eviter', 'signe'],
  admin: ['prospect', 'relance_sedentaire', 'deal_terrain', 'deal_bureau', 'signe'],
};

const RULES: Record<string, string> = {
  prospect: 'Si déjà prospecté par un autre commercial, la fiche passe automatiquement en Qualifié.',
  relance_sedentaire: 'Enregistrée dans l’historique de la fiche.',
  relance_terrain: 'Enregistrée dans l’historique de la fiche.',
  relance_visite: 'Enregistrée dans le reporting et dans l’historique de la fiche.',
  deal_terrain: 'Ajouté à Deals puis transmis au responsable, qui l’attribue au commercial terrain.',
  deal_bureau: 'Ajouté à Deals et attribué automatiquement à vous : à programmer.',
  promesse: 'La fiche passe en Promesse de signature.',
  a_eviter: 'La fiche passe en À éviter.',
  signe: 'Documents obligatoires (contrat, registre de commerce, agrément). Le dossier part chez le responsable communication.',
};

function ReportForm({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const me = useMe();
  const toast = useToast();
  const [name, setName] = useState('');
  const [matches, setMatches] = useState<any[]>([]);
  const [picked, setPicked] = useState<any | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [np, setNp] = useState<any>({ sector_id: '', source: 'sedentaire' });
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [docs, setDocs] = useState('');
  const [effects, setEffects] = useState<string[] | null>(null);
  const { data: sectors } = useData<any[]>('/sectors');

  useEffect(() => {
    if (picked || name.length < 2) { setMatches([]); return; }
    const t = setTimeout(() => api(`/prospects/lookup?name=${encodeURIComponent(name)}`).then(setMatches).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [name, picked]);

  async function submit() {
    try {
      const body: any = { reason, notes, documents_url: docs || undefined };
      if (picked) body.prospect_id = picked.id;
      else body.prospect = { ...np, name };
      const r = await api('/reports', { body });
      setEffects(r.effects.length ? r.effects : ['Enregistré dans votre reporting du jour.']);
      onDone();
    } catch (e: any) { toast(e.message, true); }
  }

  const canSubmit = reason && (picked || (isNew && name));

  return (
    <Modal
      title={me.role === 'commercial_terrain' ? 'Déclarer une visite' : 'Déclarer un appel'}
      onClose={onClose}
      footer={effects ? <button className="btn btn-dark" onClick={onClose}>Fermer</button> : <>
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!canSubmit} onClick={submit}>Enregistrer</button>
      </>}
    >
      {effects ? (
        <div className="effects">{effects.map((e) => <div key={e}>✓ {e}</div>)}</div>
      ) : (
        <>
          <label className="field">
            <span>Nom du {me.role === 'commercial_terrain' ? 'prospect' : 'client'}</span>
            <input className="input" value={name} autoFocus onChange={(e) => { setName(e.target.value); setPicked(null); setIsNew(false); }} placeholder="Commencez à taper…" />
          </label>
          {!picked && matches.length > 0 && (
            <div className="table-wrap">
              <table className="t"><tbody>
                {matches.map((m) => (
                  <tr key={m.id} className="click" onClick={() => { setPicked(m); setName(m.name); }}>
                    <td><b>{m.name}</b><span className="sub">{m.sector} · {m.phone}</span></td>
                    <td><Badge map={PROSPECT_LABEL} value={m.label} /></td>
                    <td style={{ fontSize: 12.5, color: 'var(--muted)' }}>{m.visits} visites · {m.relances} relances · {m.deals_count} deals</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          )}
          {picked && (
            <div className="notice" style={{ background: 'var(--info-soft)', color: 'var(--navy)' }}>
              Fiche existante : <b>{picked.name}</b> — <Badge map={PROSPECT_LABEL} value={picked.label} /> · {picked.visits} visites · {picked.relances} relances · {picked.deals_count} deals
            </div>
          )}
          {!picked && name.length >= 2 && !isNew && (
            <button className="btn btn-ghost btn-sm" style={{ justifySelf: 'start' }} onClick={() => setIsNew(true)}>+ Nouveau prospect « {name} »</button>
          )}
          {isNew && (
            <>
              <div className="grid-2">
                <label className="field"><span>Spécialité</span><input className="input" onChange={(e) => setNp({ ...np, specialty: e.target.value })} /></label>
                <label className="field"><span>Téléphone</span><input className="input" onChange={(e) => setNp({ ...np, phone: e.target.value })} /></label>
                <label className="field"><span>Nom du contact</span><input className="input" onChange={(e) => setNp({ ...np, contact_name: e.target.value })} /></label>
                <label className="field"><span>Secteur</span>
                  <select className="select" value={np.sector_id} onChange={(e) => setNp({ ...np, sector_id: e.target.value })}>
                    <option value="">—</option>{sectors?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid-2">
                <label className="field"><span>Lien Google Maps</span><input className="input" onChange={(e) => setNp({ ...np, maps_url: e.target.value })} /></label>
                {me.role !== 'commercial_terrain' ? (
                  <label className="field"><span>Pipeline d’origine</span>
                    <select className="select" value={np.source} onChange={(e) => setNp({ ...np, source: e.target.value })}>
                      <option value="cold_mailing">Cold mailing</option><option value="ads">Sponsoring / Ads</option><option value="sedentaire">Prospection sédentaire</option>
                    </select>
                  </label>
                ) : <label className="field"><span>Adresse</span><input className="input" onChange={(e) => setNp({ ...np, address: e.target.value })} /></label>}
              </div>
            </>
          )}
          <label className="field">
            <span>{me.role === 'commercial_terrain' ? 'Statut' : 'Raison de l’appel'}</span>
            <select className="select" value={reason} onChange={(e) => setReason(e.target.value)}>
              <option value="">Choisir…</option>
              {(REASONS[me.role] || REASONS.admin).map((r) => <option key={r} value={r}>{REASON_LABEL[r]}</option>)}
            </select>
          </label>
          {reason && <div className="notice">{RULES[reason]}</div>}
          {reason === 'signe' && (
            <label className="field"><span>Lien Drive ou photos des documents *</span><input className="input" value={docs} onChange={(e) => setDocs(e.target.value)} placeholder="https://drive.google.com/…" /></label>
          )}
          <label className="field"><span>Notes</span><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        </>
      )}
    </Modal>
  );
}

export default function Reporting() {
  const me = useMe();
  const today = new Date().toISOString().slice(0, 10);
  const [f, setF] = useState({ from: '', to: '', reason: '', entry_type: '', name: '', user_id: '' });
  const [period, setPeriod] = useState('');
  const { data: rows, reload } = useData<any[]>(`/reports${qs(f)}`, [f]);
  const isManager = ['admin', 'responsable_commercial'].includes(me.role);
  const { data: team } = useData<any[]>(isManager ? '/users?role=commercial_sedentaire,commercial_terrain' : null);
  const [form, setForm] = useState(false);
  useEffect(() => { if (window.location.search.includes('new=1')) setForm(true); }, []);

  const setPeriodF = (p: string) => {
    setPeriod(p);
    const d = new Date();
    if (p === 'jour') setF({ ...f, from: today, to: today });
    else if (p === 'semaine') { d.setDate(d.getDate() - 6); setF({ ...f, from: d.toISOString().slice(0, 10), to: today }); }
    else if (p === 'mois') { d.setDate(1); setF({ ...f, from: d.toISOString().slice(0, 10), to: today }); }
    else setF({ ...f, from: '', to: '' });
  };
  const todayCount = rows?.filter((r) => r.created_at.startsWith(today)).length ?? 0;

  return (
    <>
      <PageHead
        title={isManager ? 'Reporting de l’équipe' : 'Mon reporting'}
        sub={isManager ? 'Tout ce que les commerciaux déclarent, jour après jour.' : `Tout ce que vous avez déclaré depuis votre intégration · ${todayCount} aujourd’hui.`}
        actions={me.role !== 'admin' && <button className="btn btn-primary" onClick={() => setForm(true)}>{me.role === 'commercial_terrain' ? '+ Déclarer une visite' : '+ Déclarer un appel'}</button>}
      />
      <div className="filters">
        <select className="select" value={period} onChange={(e) => setPeriodF(e.target.value)}>
          <option value="">Toute la période</option><option value="jour">Aujourd’hui</option><option value="semaine">7 derniers jours</option><option value="mois">Ce mois</option>
        </select>
        <select className="select" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
          <option value="">Toutes les raisons</option>
          {Object.entries(REASON_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <select className="select" value={f.entry_type} onChange={(e) => setF({ ...f, entry_type: e.target.value })}>
          <option value="">Prospects et deals</option><option value="prospect">Prospects</option><option value="deal">Deals</option>
        </select>
        {isManager && (
          <select className="select" value={f.user_id} onChange={(e) => setF({ ...f, user_id: e.target.value })}>
            <option value="">Tous les commerciaux</option>{team?.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        )}
        <input className="input" placeholder="Nom du client" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </div>
      {rows?.length === 0 ? <Empty>Aucune déclaration sur cette période.</Empty> : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Date</th><th>Client / prospect</th><th>Type</th><th>Raison</th>{isManager && <th>Commercial</th>}<th>Notes</th></tr></thead>
            <tbody>
              {rows?.map((r) => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(r.created_at, true)}</td>
                  <td><b>{r.prospect_name}</b><span className="sub"><Badge map={PROSPECT_LABEL} value={r.label} /></span></td>
                  <td>{r.channel === 'visite' ? 'Visite' : 'Appel'}{r.entry_type === 'deal' && <span className="badge navy" style={{ marginLeft: 6 }}>deal</span>}</td>
                  <td>{REASON_LABEL[r.reason]}{r.outcome && <> · <Badge map={DEAL_STATUS} value={r.outcome === 'reprogrammer' ? 'programme' : r.outcome} /></>}</td>
                  {isManager && <td>{r.user_name}</td>}
                  <td style={{ color: 'var(--muted)', fontSize: 13, maxWidth: 300 }}>{r.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {form && <ReportForm onClose={() => setForm(false)} onDone={reload} />}
    </>
  );
}
