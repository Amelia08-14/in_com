'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Site web (direction) : formules et services affichés sur in-com-dz.com, modifiables sans développeur.
import { useState } from 'react';
import { Modal, PageHead, Tabs, useAction, useData } from '@/components/ui';
import { api, fmtDA } from '@/lib/api';

function OfferModal({ offer, onClose, onDone }: { offer?: any; onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const [f, setF] = useState<any>(offer ? { ...offer, featured: !!offer.featured, active: !!offer.active }
    : { name: '', price_month: '', posts_month: 0, stories_month: 0, reels_month: 0, pitch: '', items: '', gift: '', featured: false, active: true, sort_order: 10 });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = () => run(() => api(offer ? `/site/offers/${offer.id}` : '/site/offers', { method: offer ? 'PUT' : 'POST', body: f }),
    offer ? 'Formule mise à jour sur le site' : 'Formule ajoutée', () => { onDone(); onClose(); });
  return (
    <Modal wide title={offer ? `Formule ${offer.name}` : 'Nouvelle formule'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={save}>Enregistrer</button></>}>
      <div className="grid-3">
        <label className="field"><span>Nom</span><input className="input" value={f.name} onChange={set('name')} /></label>
        <label className="field"><span>Prix par mois (DA HT)</span><input className="input" type="number" value={f.price_month} onChange={set('price_month')} /></label>
        <label className="field"><span>Ordre d’affichage</span><input className="input" type="number" value={f.sort_order} onChange={set('sort_order')} /></label>
      </div>
      <label className="field"><span>Accroche</span><input className="input" value={f.pitch || ''} onChange={set('pitch')} placeholder="Pour exister proprement sur les réseaux." /></label>
      <label className="field"><span>Ce qui est inclus (une ligne par élément)</span><textarea className="textarea" rows={6} value={f.items || ''} onChange={set('items')} /></label>
      <label className="field"><span>Cadeau affiché (laisser vide s’il n’y en a pas)</span><input className="input" value={f.gift || ''} onChange={set('gift')} placeholder="Certification de votre fiche Google offerte" /></label>
      <div className="grid-3">
        <label className="field"><span>Posts par mois (quota production)</span><input className="input" type="number" value={f.posts_month} onChange={set('posts_month')} /></label>
        <label className="field"><span>Stories par mois</span><input className="input" type="number" value={f.stories_month} onChange={set('stories_month')} /></label>
        <label className="field"><span>Reels par mois</span><input className="input" type="number" value={f.reels_month} onChange={set('reels_month')} /></label>
      </div>
      <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap' }}>
        <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Affichée sur le site</label>
        <label className="check"><input type="checkbox" checked={f.featured} onChange={set('featured')} /> Mise en avant (« Meilleure valeur »)</label>
      </div>
    </Modal>
  );
}

function ServiceModal({ service, onClose, onDone }: { service?: any; onClose: () => void; onDone: () => void }) {
  const run = useAction();
  const [f, setF] = useState<any>(service ? { ...service, active: !!service.active } : { name: '', price: '', unit: 'unité', active: true, sort_order: 10 });
  const set = (k: string) => (e: any) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const save = () => run(() => api(service ? `/site/services/${service.id}` : '/site/services', { method: service ? 'PUT' : 'POST', body: f }),
    service ? 'Service mis à jour' : 'Service ajouté', () => { onDone(); onClose(); });
  return (
    <Modal title={service ? service.name : 'Nouveau service'} onClose={onClose}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Annuler</button><button className="btn btn-primary" onClick={save}>Enregistrer</button></>}>
      <label className="field"><span>Nom du service</span><input className="input" value={f.name} onChange={set('name')} /></label>
      <div className="grid-3">
        <label className="field"><span>Prix (DA HT)</span><input className="input" type="number" value={f.price} onChange={set('price')} /></label>
        <label className="field"><span>Unité</span><input className="input" value={f.unit} onChange={set('unit')} /></label>
        <label className="field"><span>Ordre</span><input className="input" type="number" value={f.sort_order} onChange={set('sort_order')} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={f.active} onChange={set('active')} /> Affiché sur le site</label>
    </Modal>
  );
}

export default function SiteWeb() {
  const run = useAction();
  const [tab, setTab] = useState('offres');
  const { data: offers, reload: reloadOffers } = useData<any[]>('/site/offers');
  const { data: services, reload: reloadServices } = useData<any[]>('/site/services');
  const [offer, setOffer] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const toggle = (kind: 'offers' | 'services', row: any, reload: () => void) =>
    run(() => api(`/site/${kind}/${row.id}`, { method: 'PUT', body: { ...row, active: !row.active, featured: !!row.featured } }), row.active ? 'Masqué du site' : 'Affiché sur le site', reload);
  const remove = (kind: 'offers' | 'services', row: any, reload: () => void) => {
    if (!confirm(`Supprimer « ${row.name} » ? S’il est déjà utilisé par des clients, il sera seulement masqué du site.`)) return;
    run(() => api(`/site/${kind}/${row.id}`, { method: 'DELETE' }), 'Supprimé ou masqué', reload);
  };

  return (
    <>
      <PageHead title="Site web" sub="Les formules et les services affichés sur in-com-dz.com. Chaque modification est en ligne immédiatement."
        actions={<>
          <a className="btn btn-ghost" href="/#offres" target="_blank" rel="noreferrer">Voir le site</a>
          <button className="btn btn-primary" onClick={() => (tab === 'offres' ? setOffer({}) : setService({}))}>{tab === 'offres' ? '+ Nouvelle formule' : '+ Nouveau service'}</button>
        </>} />
      <Tabs value={tab} onChange={setTab} items={[['offres', 'Formules', offers?.length], ['services', 'Services à la carte', services?.length]]} />

      {tab === 'offres' ? (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Formule</th><th>Prix / mois</th><th>Inclus</th><th>Cadeau</th><th>Sur le site</th><th></th></tr></thead>
            <tbody>
              {offers?.map((o) => (
                <tr key={o.id}>
                  <td><b>{o.name}</b>{o.featured ? <span className="badge accent" style={{ marginLeft: 6 }}>Mise en avant</span> : null}<span className="sub">{o.pitch}</span></td>
                  <td>{fmtDA(o.price_month)}</td>
                  <td style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 320 }}>{String(o.items || '').split('\n').filter(Boolean).join(' · ')}</td>
                  <td style={{ fontSize: 13 }}>{o.gift || '—'}</td>
                  <td>{o.active ? <span className="badge ok">Affichée</span> : <span className="badge neutral">Masquée</span>}</td>
                  <td className="row-actions">
                    <button className="btn btn-dark btn-xs" onClick={() => setOffer(o)}>Modifier</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => toggle('offers', o, reloadOffers)}>{o.active ? 'Masquer' : 'Afficher'}</button>
                    <button className="btn btn-ghost btn-xs danger-text" onClick={() => remove('offers', o, reloadOffers)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="t">
            <thead><tr><th>Service</th><th>Prix</th><th>Sur le site</th><th></th></tr></thead>
            <tbody>
              {services?.map((s) => (
                <tr key={s.id}>
                  <td><b>{s.name}</b></td>
                  <td>{fmtDA(s.price)} <span className="sub">par {s.unit}</span></td>
                  <td>{s.active ? <span className="badge ok">Affiché</span> : <span className="badge neutral">Masqué</span>}</td>
                  <td className="row-actions">
                    <button className="btn btn-dark btn-xs" onClick={() => setService(s)}>Modifier</button>
                    <button className="btn btn-ghost btn-xs" onClick={() => toggle('services', s, reloadServices)}>{s.active ? 'Masquer' : 'Afficher'}</button>
                    <button className="btn btn-ghost btn-xs danger-text" onClick={() => remove('services', s, reloadServices)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {offer && <OfferModal offer={offer.id ? offer : undefined} onClose={() => setOffer(null)} onDone={reloadOffers} />}
      {service && <ServiceModal service={service.id ? service : undefined} onClose={() => setService(null)} onDone={reloadServices} />}
    </>
  );
}
