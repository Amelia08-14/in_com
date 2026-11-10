'use client';
// Moteur de mouvement de la landing (sans dépendance) :
//  [data-reveal]        apparaît à l'entrée dans l'écran (classe .in), décalage via --i
//  [data-progress]      reçoit --p de 0 à 1 selon le défilement (sticky = progression dans la section)
//  [data-count="1234"]  compteur animé à l'apparition
//  [data-words]         texte découpé en mots, allumés un à un avec --p
//  [data-magnet]        bouton qui suit légèrement le pointeur
//  html[data-nav]       « top » sur le hero sombre, « solid » ensuite
import { useEffect } from 'react';

export default function Motion() {
  useEffect(() => {
    const root = document.documentElement;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    root.classList.add('js');

    // Découpage en mots
    document.querySelectorAll<HTMLElement>('[data-words]').forEach((el) => {
      if (el.dataset.split) return;
      el.dataset.split = '1';
      const words = (el.textContent || '').trim().split(/\s+/);
      el.setAttribute('aria-label', el.textContent || '');
      el.innerHTML = words.map((w, i) => `<span class="w" aria-hidden="true" style="--w:${i / Math.max(1, words.length - 1)}">${w}</span>`).join(' ');
    });

    // Compteurs
    const count = (el: HTMLElement) => {
      const end = Number(el.dataset.count);
      const fmt = (n: number) => Math.round(n).toLocaleString('fr-FR');
      if (reduce) { el.textContent = fmt(end); return; }
      const t0 = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - t0) / 1400);
        el.textContent = fmt(end * (1 - Math.pow(1 - k, 4)));
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target as HTMLElement;
        el.classList.add('in');
        if (el.dataset.count) count(el);
        el.querySelectorAll<HTMLElement>('[data-count]').forEach(count);
        io.unobserve(el);
      }
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
    document.querySelectorAll('[data-reveal], [data-count]').forEach((el) => io.observe(el));

    // Progression au défilement
    const prog = [...document.querySelectorAll<HTMLElement>('[data-progress]')];
    const hero = document.querySelector<HTMLElement>('.hero');
    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      for (const el of prog) {
        const r = el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;
        const p = el.dataset.progress === 'sticky'
          ? -r.top / Math.max(1, r.height - vh)
          : (vh - r.top) / (r.height + vh);
        el.style.setProperty('--p', String(Math.min(1, Math.max(0, p))));
      }
      root.style.setProperty('--page-p', String(window.scrollY / Math.max(1, document.body.scrollHeight - vh)));
      const navTop = hero ? hero.getBoundingClientRect().bottom > 72 : false;
      root.dataset.nav = navTop ? 'top' : 'solid';
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // Boutons magnétiques
    const magnets = reduce || matchMedia('(hover: none)').matches ? [] : [...document.querySelectorAll<HTMLElement>('[data-magnet]')];
    const mm = (e: PointerEvent) => {
      const el = e.currentTarget as HTMLElement;
      const r = el.getBoundingClientRect();
      const x = (e.clientX - r.left - r.width / 2) * 0.25;
      const y = (e.clientY - r.top - r.height / 2) * 0.35;
      el.style.transform = `translate(${x}px, ${y}px)`;
    };
    const ml = (e: PointerEvent) => { (e.currentTarget as HTMLElement).style.transform = ''; };
    magnets.forEach((m) => { m.addEventListener('pointermove', mm); m.addEventListener('pointerleave', ml); });

    return () => {
      io.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      magnets.forEach((m) => { m.removeEventListener('pointermove', mm); m.removeEventListener('pointerleave', ml); });
    };
  }, []);
  return null;
}
