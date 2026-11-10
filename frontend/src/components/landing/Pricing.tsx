'use client';
import { useEffect, useRef, useState } from 'react';
import { AddButton, fmt } from './cart';

const PLANS = [
  {
    code: 'essentiel', name: 'Essentiel', price: 15000, pitch: 'Pour exister proprement sur les réseaux.',
    items: ['8 posts sur Facebook et Instagram', '15 stories', 'Calendrier éditorial', 'Rapport de performance'],
    gift: 'Certification de votre fiche Google offerte',
  },
  {
    code: 'pro', name: 'Pro', price: 35000, pitch: 'Pour animer, répondre et faire de la publicité.',
    items: ['12 posts sur Facebook et Instagram', '24 stories', '2 reels', 'Assistant IA 24h/24 sur 1 canal', '1 campagne publicitaire', 'Rapport mensuel détaillé'],
    gift: 'Certification de votre fiche Google offerte',
  },
  {
    code: 'premium', name: 'Premium', price: 70000, featured: true, pitch: 'Pour déléguer toute votre image.',
    items: ['16 posts sur Facebook et Instagram', 'Stories quotidiennes', '4 à 6 reels', '1 shooting photo et vidéo par mois, chez vous', 'Site vitrine de 4 à 6 pages inclus', 'IA avancée sur Instagram, Facebook et WhatsApp', 'Publicités continues'],
    gift: 'Fiche Google certifiée et 1 mois offert',
  },
];

// Nombre qui roule vers sa nouvelle valeur
function Rolling({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current, t0 = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / 600);
      const v = start + (value - start) * (1 - Math.pow(1 - k, 3));
      setShown(v);
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmt(Math.round(shown / 10) * 10)}</>;
}

export default function Pricing() {
  const [months, setMonths] = useState(6);
  return (
    <>
      <div className="seg" role="tablist" aria-label="Durée d’engagement" data-on={months}>
        <span className="seg-pill" aria-hidden="true" />
        <button type="button" role="tab" aria-selected={months === 3} onClick={() => setMonths(3)}>3 mois</button>
        <button type="button" role="tab" aria-selected={months === 6} onClick={() => setMonths(6)}>6 mois, recommandé</button>
      </div>
      <div className="plans">
        {PLANS.map((p, i) => (
          <article key={p.code} className={`plan ${p.featured ? 'featured' : ''}`} data-reveal style={{ ['--i' as string]: i }}>
            <div className="plan-glow" aria-hidden="true" />
            <div className="plan-head">
              <h3>{p.name}</h3>
              {p.featured && <span className="ribbon-tag">Meilleure valeur</span>}
            </div>
            <p className="pitch">{p.pitch}</p>
            <p className="price"><Rolling value={p.price} /><span>DA / mois HT</span></p>
            <p className="per">Soit <b><Rolling value={p.price * months} /> DA</b> sur {months} mois, environ {fmt(Math.round(p.price / 30))} DA par jour</p>
            <ul>{p.items.map((it) => <li key={it}>{it}</li>)}</ul>
            <p className="gift"><span aria-hidden="true">✦</span> {p.gift}</p>
            <AddButton
              item={{ kind: 'offer', ref: p.code, label: `Formule ${p.name}`, months, unit_price: p.price }}
              label={`Choisir ${p.name}`}
              className={`btn ${p.featured ? 'btn-accent' : 'btn-primary'} btn-block`}
            />
          </article>
        ))}
      </div>
    </>
  );
}
