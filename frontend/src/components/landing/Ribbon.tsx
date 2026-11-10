'use client';
// Les sept métiers en ruban de cartes 3D : le défilement vertical fait tourner le ruban.
import { useEffect, useRef, useState } from 'react';
import { AddButton } from './cart';

type Card = { n: string; title: string; text: string; tags: string[]; tone: 'orange' | 'ink' | 'paper'; big: string; cta: { kind: 'devis'; ref: string } | { href: string; label: string } };

const CARDS: Card[] = [
  { n: '01', title: 'Stratégie marketing', big: 'Cap', tone: 'orange', text: 'Analyse, positionnement et plans d’action, du diagnostic à la feuille de route.', tags: ['Audit', 'Positionnement', 'Plan d’action'], cta: { kind: 'devis', ref: 'strategie' } },
  { n: '02', title: 'Communication digitale', big: 'Feed', tone: 'ink', text: 'Présence de marque et contenus adaptés à chaque réseau, chaque mois, validés par vous.', tags: ['Posts', 'Stories', 'Reels'], cta: { href: '#offres', label: 'Voir les formules' } },
  { n: '03', title: 'Media buying digital', big: 'Ads', tone: 'paper', text: 'Campagnes Meta Ads : ciblage, diffusion, optimisation et suivi de chaque lead.', tags: ['Meta Ads', 'Leads', 'Reporting'], cta: { kind: 'devis', ref: 'meta_ads' } },
  { n: '04', title: 'Media buying physique', big: 'Rue', tone: 'orange', text: 'Supports, emplacements et planification de votre affichage dans la ville.', tags: ['Affichage', 'Planification'], cta: { kind: 'devis', ref: 'media_physique' } },
  { n: '05', title: 'Design et identité', big: 'Logo', tone: 'ink', text: 'Logo, charte, brand book, print, packaging, 3D et habillage motion.', tags: ['Charte', 'Print', 'Motion'], cta: { kind: 'devis', ref: 'identite' } },
  { n: '06', title: 'Production audiovisuelle', big: 'Rec', tone: 'paper', text: 'Reels et coulisses captés sur place ; films institutionnels, publicitaires et promotionnels.', tags: ['Shooting', 'Film', 'Reels'], cta: { kind: 'devis', ref: 'audiovisuel' } },
  { n: '07', title: 'Événementiel et grands spectacles', big: 'Live', tone: 'orange', text: 'Lancements, événements de marque, spectacles de drones, pyrotechnie et coordination technique.', tags: ['Lancement', 'Drones', 'Scène'], cta: { kind: 'devis', ref: 'evenementiel' } },
];

export default function Ribbon() {
  const wrap = useRef<HTMLElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);
  const [idx, setIdx] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setStill(true); return; }
    let raf = 0;
    const N = CARDS.length;
    const draw = () => {
      raf = 0;
      const el = wrap.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight, vw = window.innerWidth;
      if (r.bottom < 0 || r.top > vh) return;
      const p = Math.min(1, Math.max(0, -r.top / (r.height - vh)));
      const pos = p * (N - 1);
      const mobile = vw < 760;
      setIdx(Math.round(pos));
      cards.current.forEach((c, i) => {
        if (!c) return;
        const d = i - pos;
        const ad = Math.abs(d);
        const x = d * vw * (mobile ? 0.86 : 0.36);
        const y = ad * ad * (mobile ? 10 : 26);
        const z = -ad * (mobile ? 260 : 360);
        c.style.transform = `translate(-50%, -50%) translate3d(${x}px, ${y}px, ${z}px) rotateY(${-d * (mobile ? 38 : 30)}deg) rotateZ(${d * 3}deg)`;
        c.style.opacity = String(Math.max(0, 1 - Math.max(0, ad - (mobile ? 0.9 : 2)) * 0.9));
        c.style.zIndex = String(100 - Math.round(ad * 10));
        c.classList.toggle('front', ad < 0.5);
      });
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(draw); };
    draw();
    window.addEventListener('scroll', on, { passive: true });
    window.addEventListener('resize', on);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('scroll', on); window.removeEventListener('resize', on); };
  }, []);

  return (
    <section ref={wrap} className={`ribbon ${still ? 'still' : ''}`} id="expertises" aria-labelledby="exp-title" style={{ ['--n' as string]: CARDS.length }}>
      <div className="ribbon-stage">
        <div className="ribbon-head container">
          <h2 id="exp-title">Sept métiers,<br /><em>une seule équipe.</em></h2>
          <p className="ribbon-count" aria-hidden="true"><b>{String(idx + 1).padStart(2, '0')}</b> / {String(CARDS.length).padStart(2, '0')}</p>
        </div>
        <div className="ribbon-track">
          {CARDS.map((c, i) => (
            <article key={c.n} ref={(el) => { cards.current[i] = el; }} className={`rcard t-${c.tone}`}>
              <header><span className="rn">{c.n}</span><span className="rbig" aria-hidden="true">{c.big}</span></header>
              <div className="rbody">
                <h3>{c.title}</h3>
                <p>{c.text}</p>
                <ul>{c.tags.map((t) => <li key={t}>{t}</li>)}</ul>
              </div>
              <footer>
                {'href' in c.cta
                  ? <a className="btn btn-light" href={c.cta.href}>{c.cta.label}</a>
                  : <AddButton item={{ kind: 'devis', ref: c.cta.ref, label: c.title, unit_price: 0 }} label="Demander un devis" className="btn btn-light" />}
              </footer>
            </article>
          ))}
        </div>
        <div className="ribbon-bar" aria-hidden="true"><span style={{ width: `${((idx + 1) / CARDS.length) * 100}%` }} /></div>
      </div>
    </section>
  );
}
