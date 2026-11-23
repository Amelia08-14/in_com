'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// « Client signé » : les mêmes champs depuis le reporting, un deal gagné ou un devis.
// La formule est un pack du catalogue ou une formule sur mesure (posts, stories, reels, services, prix).
// Formule et documents sont obligatoires ; le dossier est créé et part au recouvrement.
import { useData } from '@/components/ui';
import CustomOffer, { EMPTY_CUSTOM, customReady } from '@/components/CustomOffer';
import { fmtDA } from '@/lib/api';
import { SERVICE_TYPE } from '@/lib/labels';

export type Sign = { offer_id: string; service_type: string; documents_url: string; custom: any };
export const EMPTY_SIGN: Sign = { offer_id: '', service_type: 'abonnement', documents_url: '', custom: EMPTY_CUSTOM };
export const signReady = (s: Sign) => !!s.offer_id && !!s.documents_url.trim() && (s.offer_id !== 'custom' || customReady(s.custom));
// Corps envoyé à l'API : la formule sur mesure n'est jointe que si elle est choisie
export const signBody = (s: Sign) => ({ offer_id: s.offer_id, service_type: s.service_type, documents_url: s.documents_url, ...(s.offer_id === 'custom' ? { custom: s.custom } : {}) });

export default function SignFields({ value, onChange }: { value: Sign; onChange: (s: Sign) => void }) {
  const { data: offers } = useData<any[]>('/offers');
  const set = (k: keyof Sign) => (e: any) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="sign-box">
      <h3>Client signé</h3>
      <div className="grid-2">
        <label className="field"><span>Formule signée *</span>
          <select className={`select ${!value.offer_id ? 'required-missing' : ''}`} value={value.offer_id} onChange={set('offer_id')}>
            <option value="" disabled>Choisir un pack ou le sur mesure…</option>
            {offers?.filter((o) => o.active !== 0).map((o) => <option key={o.id} value={o.id}>Pack {o.name} · {fmtDA(o.price_month)} / mois</option>)}
            <option value="custom">Formule sur mesure (posts, stories, reels, services et prix au choix)</option>
          </select>
        </label>
        <label className="field"><span>Prestation</span>
          <select className="select" value={value.service_type} onChange={set('service_type')}>
            {Object.entries(SERVICE_TYPE).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      </div>
      {value.offer_id === 'custom' && <CustomOffer c={value.custom} setC={(c) => onChange({ ...value, custom: c })} />}
      <label className="field"><span>Lien Drive ou photos des documents (contrat, registre de commerce, agrément) *</span>
        <input className="input" value={value.documents_url} onChange={set('documents_url')} placeholder="https://drive.google.com/…" />
      </label>
      <p className="progress-line" style={{ margin: 0 }}>Le dossier est créé et le recouvrement reçoit « Encaisser ». Dès le paiement confirmé, l’équipe est attribuée et la production démarre. Vous êtes prévenu à chaque étape.</p>
    </div>
  );
}
