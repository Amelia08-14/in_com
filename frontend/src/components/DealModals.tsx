'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from 'react';
import { Modal, useAction } from '@/components/ui';
import { api } from '@/lib/api';
import SignFields, { EMPTY_SIGN, signBody, signReady, type Sign } from '@/components/SignFields';

export function ScheduleModal({ deal, onClose, onDone }: { deal: any; onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const [at, setAt] = useState('');
  const [kind, setKind] = useState(deal.type === 'bureau' ? 'passage_bureau' : 'rdv');
  return (
    <Modal title={`Programmer — ${deal.prospect_name}`} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!at} onClick={() => run(() => api(`/deals/${deal.id}/schedule`, { body: { scheduled_at: at, kind } }), 'RDV programmé', () => { onDone(); onClose(); })}>Programmer le RDV</button></>}>
      <dl className="kv">
        <dt>Téléphone</dt><dd>{deal.phone || '—'}</dd>
        <dt>Adresse</dt><dd>{deal.address || '—'} {deal.maps_url && <a href={deal.maps_url} target="_blank" rel="noreferrer" style={{ color: 'var(--blue)' }}>· Maps</a>}</dd>
        <dt>Visites</dt><dd>{deal.visits ?? '—'}</dd>
        {deal.notes && <><dt>Notes</dt><dd>{deal.notes}</dd></>}
      </dl>
      <div className="grid-2">
        <label className="field"><span>Date et heure</span><input type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} /></label>
        <label className="field"><span>Type</span>
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="rdv">RDV terrain</option><option value="appel">Appel</option><option value="passage_bureau">Passage bureau</option>
          </select>
        </label>
      </div>
    </Modal>
  );
}

export function OutcomeModal({ deal, onClose, onDone }: { deal: any; onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const [outcome, setOutcome] = useState('');
  const [at, setAt] = useState('');
  const [notes, setNotes] = useState('');
  const [sign, setSign] = useState<Sign>(EMPTY_SIGN);
  const ok = outcome && (outcome !== 'reprogrammer' || at) && (outcome !== 'gagne' || signReady(sign));
  const OPTS: [string, string][] = [['reprogrammer', 'Nouvelle date'], ['gagne', 'Client signé'], ['perdu', 'Perdu'], ['a_relancer', 'À relancer']];
  return (
    <Modal title={`Issue — ${deal.prospect_name}`} onClose={onClose} wide={outcome === 'gagne'}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" disabled={!ok} onClick={() => run(() => api(`/deals/${deal.id}/outcome`, { body: { outcome, scheduled_at: at, notes, ...(outcome === 'gagne' ? signBody(sign) : {}) } }), outcome === 'gagne' ? 'Client signé : dossier créé, le recouvrement encaisse' : 'Issue enregistrée dans votre reporting', () => { onDone(); onClose(); })}>Enregistrer</button></>}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {OPTS.map(([v, l]) => (
          <button key={v} className={`btn btn-sm ${outcome === v ? 'btn-dark' : 'btn-ghost'}`} onClick={() => setOutcome(v)}>{l}</button>
        ))}
      </div>
      {outcome === 'reprogrammer' && <label className="field"><span>Nouvelle date convenue</span><input type="datetime-local" className="input" value={at} onChange={(e) => setAt(e.target.value)} /></label>}
      {outcome === 'gagne' && <SignFields value={sign} onChange={setSign} />}
      {outcome === 'a_relancer' && <div className="notice">Le deal repart dans Deals, chez le commercial qui l’a créé.</div>}
      <label className="field"><span>Notes</span><textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
    </Modal>
  );
}
