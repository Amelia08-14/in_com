'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Formule sur mesure : posts, stories et reels par mois, prix mensuel, et services du catalogue (ou libres) avec leur nombre.
// La même saisie sert à la signature (« Client signé ») et à la correction du dossier.
import { useData } from '@/components/ui';
import { fmtDA } from '@/lib/api';

export const EMPTY_CUSTOM = { posts_month: 0, stories_month: 0, reels_month: 0, price_month: 0, items: [] as any[] };
// Prête : au moins un quota ou un service, et un prix (mensuel ou des services)
export function customReady(c: any) {
  if (!c) return false;
  const quotas = (Number(c.posts_month) || 0) + (Number(c.stories_month) || 0) + (Number(c.reels_month) || 0);
  const lines = (c.items || []).filter((l: any) => l.service_id || String(l.label || '').trim());
  const once = lines.reduce((sum: number, l: any) => sum + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0);
  return (quotas > 0 || lines.length > 0) && (Number(c.price_month) > 0 || once > 0);
}

export type ServiceLine = { service_id: string; label: string; quantity: number; unit_price: number };
export const lineTotal = (lines: ServiceLine[]) => lines.reduce((sum, l) => sum + (Number(l.unit_price) || 0) * (Number(l.quantity) || 0), 0);

// Services choisis et leur nombre : du catalogue, ou libres (nom et prix saisis)
export function ServiceLines({ title, lines, setLines }: { title: string; lines: ServiceLine[]; setLines: (l: ServiceLine[]) => void }) {
  const { data: services } = useData<any[]>('/services');
  const setLine = (i: number, patch: Partial<ServiceLine>) => setLines(lines.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  return (
    <div className="field">
      <span>{title}</span>
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
                <td><button type="button" className="btn btn-ghost btn-xs" onClick={() => setLines(lines.filter((_, k) => k !== i))}>Retirer</button></td>
              </tr>
            ))}
          </tbody>
        </table></div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select className="select" style={{ maxWidth: 360 }} value="" onChange={(e) => {
          const sv = services?.find((x) => String(x.id) === e.target.value);
          if (sv) setLines([...lines, { service_id: String(sv.id), label: sv.name, quantity: 1, unit_price: sv.price }]);
        }}>
          <option value="">+ Ajouter un service du catalogue…</option>
          {services?.filter((x) => x.active !== 0).map((x) => <option key={x.id} value={x.id}>{x.name} · {fmtDA(x.price)}</option>)}
        </select>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLines([...lines, { service_id: '', label: '', quantity: 1, unit_price: 0 }])}>+ Autre service</button>
      </div>
      {lines.length > 0 && <p className="custom-total">Services ponctuels : <b>{fmtDA(lineTotal(lines))}</b> · une tâche de production par service au paiement</p>}
    </div>
  );
}

export default function CustomOffer({ c, setC }: { c: any; setC: (c: any) => void }) {
  const num = (k: string) => (e: any) => setC({ ...c, [k]: e.target.value });
  return (
    <div className="custom-offer">
      <h3>Formule sur mesure</h3>
      <div className="grid-3" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <label className="field"><span>Posts par mois</span><input className="input" type="number" min={0} value={c.posts_month} onChange={num('posts_month')} /></label>
        <label className="field"><span>Stories par mois</span><input className="input" type="number" min={0} value={c.stories_month} onChange={num('stories_month')} /></label>
        <label className="field"><span>Reels par mois</span><input className="input" type="number" min={0} value={c.reels_month} onChange={num('reels_month')} /></label>
        <label className="field"><span>Prix mensuel (DA HT)</span><input className="input" type="number" min={0} value={c.price_month} onChange={num('price_month')} /></label>
      </div>
      <p className="hint">Les quotas mensuels sont découpés en tâches quotidiennes pour le graphiste, comme pour un pack.</p>
      <ServiceLines title="Services inclus et leur nombre" lines={c.items} setLines={(items) => setC({ ...c, items })} />
      <p className="custom-total">Mensuel : <b>{fmtDA(Number(c.price_month) || 0)}</b></p>
    </div>
  );
}
