'use client';
// Services à la carte : prix lus depuis l'API (table services du CRM), liste de secours si l'API dort
import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { AddButton, fmt } from './cart';

type S = { id: number; name: string; price: number };
const FALLBACK: S[] = [
  { id: 7, name: 'Certification de la fiche Google', price: 5000 },
  { id: 1, name: 'Reel supplémentaire', price: 6000 },
  { id: 3, name: 'Page de site supplémentaire', price: 8000 },
  { id: 5, name: 'Automatisation WhatsApp', price: 20000 },
  { id: 2, name: 'Shooting supplémentaire', price: 25000 },
  { id: 6, name: 'Campagne spéciale : lancement, promo', price: 30000 },
  { id: 4, name: 'Site avec réservation, blog ou boutique', price: 90000 },
];
const ICONS: [RegExp, string][] = [
  [/google/i, 'M12 3l2.6 5.6L20 9.3l-4 4.1 1 5.6L12 16.3 7 19l1-5.6-4-4.1 5.4-.7z'],
  [/reel/i, 'M4 5h16v14H4zM10 9l5 3-5 3z'],
  [/page/i, 'M6 3h9l3 3v15H6zM9 10h6M9 14h6M9 18h4'],
  [/whatsapp/i, 'M21 12a8 8 0 0 1-11.7 7.1L4 20l1-4.6A8 8 0 1 1 21 12zM9 9.5c.5 2.5 2.5 4.5 5 5'],
  [/shooting/i, 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'],
  [/campagne/i, 'M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12'],
  [/site/i, 'M3 5h18v14H3zM3 9h18M7 7h.01M10 7h.01'],
];
const icon = (n: string) => ICONS.find(([r]) => r.test(n))?.[1] || ICONS[0][1];

export default function Shop() {
  const [list, setList] = useState<S[]>(FALLBACK);
  useEffect(() => {
    fetch(`${API_URL}/public/services`).then((r) => r.json()).then((d) => Array.isArray(d) && d.length && setList(d)).catch(() => {});
  }, []);
  return (
    <ul className="shop">
      {list.map((s, i) => (
        <li key={s.id} className="svc" data-reveal style={{ ['--i' as string]: i % 4 }}>
          <span className="svc-ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d={icon(s.name)} /></svg></span>
          <h3>{s.name}</h3>
          <p className="svc-price">{fmt(s.price)} <span>DA HT</span></p>
          <AddButton item={{ kind: 'service', ref: String(s.id), label: s.name, unit_price: s.price }} label="Ajouter" className="btn btn-ghost btn-sm" />
        </li>
      ))}
    </ul>
  );
}
