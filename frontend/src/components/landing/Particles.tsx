'use client';
// Hero : le logo officiel recomposé en particules 3D (couleurs lues dans le PNG de la charte).
// Les particules se rassemblent au chargement, tournent doucement, fuient la souris et
// se dispersent quand on fait défiler la page.
import { useEffect, useRef } from 'react';

type P = { x: number; y: number; z: number; tx: number; ty: number; tz: number; vx: number; vy: number; ex: number; ey: number; ez: number; r: number; g: number; b: number; s: number; d: number };

export default function Particles({ src = '/brand/logo-light.png' }: { src?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d')!;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W = 0, H = 0, dpr = 1, raf = 0, visible = true, t0 = performance.now();
    let parts: P[] = [];
    let stars: { x: number; y: number; z: number; p: number }[] = [];
    const mouse = { x: -9999, y: -9999, nx: 0, ny: 0, sx: 0, sy: 0 };
    let layout = { cx: 0, cy: 0, scale: 1 };

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const mobile = W < 760;
      const h = mobile ? Math.min(W * 0.7, H * 0.36) : Math.min(H * 0.74, W * 0.42);
      layout = { cx: mobile ? W * 0.5 : W * 0.7, cy: mobile ? H * 0.26 : H * 0.5, scale: h / 1092 };
      stars = Array.from({ length: mobile ? 90 : 200 }, () => ({ x: Math.random() * W, y: Math.random() * H, z: Math.random(), p: Math.random() * Math.PI * 2 }));
    };

    const build = (img: HTMLImageElement) => {
      const mobile = W < 760;
      const SW = mobile ? 120 : 170; // grille d'échantillonnage
      const SH = Math.round((SW * img.height) / img.width);
      const off = document.createElement('canvas');
      off.width = SW; off.height = SH;
      const o = off.getContext('2d')!;
      o.drawImage(img, 0, 0, SW, SH);
      const data = o.getImageData(0, 0, SW, SH).data;
      const k = img.width / SW;
      const next: P[] = [];
      for (let y = 0; y < SH; y++) {
        for (let x = 0; x < SW; x++) {
          const i = (y * SW + x) * 4;
          if (data[i + 3] < 140) continue;
          const tx = (x - SW / 2) * k, ty = (y - SH / 2) * k;
          // Direction de dispersion : vers l'extérieur, avec du hasard
          const a = Math.random() * Math.PI * 2, e = Math.random() * 2 - 1;
          next.push({
            tx, ty, tz: (Math.random() - 0.5) * 70,
            x: Math.cos(a) * (900 + Math.random() * 900), y: e * 900, z: Math.sin(a) * 1200,
            vx: 0, vy: 0,
            ex: Math.cos(a) * Math.sqrt(1 - e * e), ey: e, ez: Math.sin(a) * Math.sqrt(1 - e * e),
            r: data[i], g: data[i + 1], b: data[i + 2],
            s: 0.8 + Math.random() * 1.5, d: Math.random() * 0.6,
          });
        }
      }
      parts = next;
      if (reduce) parts.forEach((p) => { p.x = p.tx; p.y = p.ty; p.z = p.tz; });
    };

    const frame = (now: number) => {
      raf = 0;
      const t = now - t0;
      const hero = canvas.parentElement!;
      const scroll = Math.min(1, Math.max(0, -hero.getBoundingClientRect().top / (hero.offsetHeight * 0.8)));
      mouse.sx += (mouse.nx - mouse.sx) * 0.05;
      mouse.sy += (mouse.ny - mouse.sy) * 0.05;

      ctx.clearRect(0, 0, W, H);
      // Étoiles
      for (const s of stars) {
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.0006 + s.p));
        ctx.fillStyle = `rgba(255,255,255,${(0.12 + s.z * 0.5) * tw * (1 - scroll * 0.6)})`;
        const sz = 0.6 + s.z * 1.3;
        ctx.fillRect(s.x - mouse.sx * 18 * s.z, s.y - mouse.sy * 12 * s.z - scroll * 120 * s.z, sz, sz);
      }

      const intro = reduce ? 1 : Math.min(1, t / 2600);
      const ay = (reduce ? 0 : Math.sin(t * 0.00035) * 0.38) + mouse.sx * 0.45;
      const ax = (reduce ? 0 : Math.cos(t * 0.00027) * 0.1) + mouse.sy * 0.25;
      const cy = Math.cos(ay), sy = Math.sin(ay), cx = Math.cos(ax), sx = Math.sin(ax);
      const F = 1100;
      const { cx: ox, cy: oy, scale } = layout;
      const burst = scroll * scroll * 1400;

      ctx.globalCompositeOperation = 'lighter';
      for (const p of parts) {
        // Rassemblement progressif (chaque particule a son propre retard)
        const local = Math.min(1, Math.max(0, (intro - p.d * 0.5) / 0.5));
        const ease = 1 - Math.pow(1 - local, 3);
        const gx = p.tx + p.ex * burst, gy = p.ty + p.ey * burst, gz = p.tz + p.ez * burst;
        const k = reduce ? 1 : 0.03 + ease * 0.06;
        p.x += (gx - p.x) * k + p.vx;
        p.y += (gy - p.y) * k + p.vy;
        p.z += (gz - p.z) * k;
        p.vx *= 0.88; p.vy *= 0.88;
        // Respiration légère
        const bz = p.z + Math.sin(t * 0.0015 + p.tx * 0.01) * 8;
        // Rotation 3D
        const x1 = p.x * cy - bz * sy, z1 = p.x * sy + bz * cy;
        const y1 = p.y * cx - z1 * sx, z2 = p.y * sx + z1 * cx;
        const per = F / (F + z2 * scale);
        const X = ox + x1 * scale * per, Y = oy + y1 * scale * per;
        // La souris repousse les particules
        const dx = X - mouse.x, dy = Y - mouse.y, dd = dx * dx + dy * dy;
        if (dd < 12000 && !reduce) {
          const f = (1 - dd / 12000) * 9;
          const d = Math.sqrt(dd) || 1;
          p.vx += (dx / d) * f; p.vy += (dy / d) * f;
        }
        const alpha = Math.max(0, Math.min(1, per * 0.95)) * (1 - scroll * 0.85) * (0.25 + 0.75 * ease);
        if (alpha <= 0.01) continue;
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        const sz = p.s * per * (W < 760 ? 1.1 : 1.45);
        ctx.fillRect(X, Y, sz, sz);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (visible && (!reduce || t < 100)) raf = requestAnimationFrame(frame);
    };

    const start = () => { if (!raf) raf = requestAnimationFrame(frame); };
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      mouse.nx = (mouse.x / W) * 2 - 1; mouse.ny = (mouse.y / H) * 2 - 1;
    };
    const onLeave = () => { mouse.x = mouse.y = -9999; mouse.nx = mouse.ny = 0; };

    resize();
    const img = new Image();
    img.onload = () => { build(img); t0 = performance.now(); start(); };
    img.src = src;

    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); });
    io.observe(canvas);
    let rt = 0;
    const onResize = () => { clearTimeout(rt); rt = window.setTimeout(() => { resize(); if (img.complete) build(img); parts.forEach((p) => { p.x = p.tx; p.y = p.ty; p.z = p.tz; }); start(); }, 150); };
    window.addEventListener('resize', onResize);
    window.addEventListener('pointermove', onMove, { passive: true });
    document.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', start, { passive: true });
    return () => {
      cancelAnimationFrame(raf); io.disconnect();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', start);
    };
  }, [src]);

  return <canvas ref={ref} className="particles" aria-hidden="true" />;
}
