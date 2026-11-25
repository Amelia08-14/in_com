'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */
// Tableau de bord de la direction : indicateurs de la période avec tendance, graphique d'activité
// interactif, entonnoir de conversion, revenu par formule, classement commercial, production et fil d'activité.
// Graphiques en SVG maison (pas de bibliothèque) : palette catégorielle validée, survol avec infobulle.
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { api, fmtDate } from '@/lib/api';
import { DOSSIER_STATUS, REASON_LABEL, ROLE_LABELS } from '@/lib/labels';

const fmtN = (n: number) => Number(n || 0).toLocaleString('fr-FR');
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

// Variation par rapport à la période précédente
function Delta({ now, prev }: { now: number; prev: number }) {
  if (!prev && !now) return <span className="dlt flat">stable</span>;
  if (!prev) return <span className="dlt up">nouveau</span>;
  const pct = Math.round(((now - prev) / prev) * 100);
  if (pct === 0) return <span className="dlt flat">stable</span>;
  return <span className={`dlt ${pct > 0 ? 'up' : 'down'}`}>{pct > 0 ? '▲' : '▼'} {Math.abs(pct)} %</span>;
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const w = 120, h = 34, max = Math.max(1, ...data);
  const pts = data.map((v, i) => [(i / Math.max(1, data.length - 1)) * w, h - 3 - (v / max) * (h - 6)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={`${line}L${w},${h}L0,${h}Z`} fill={color} opacity=".12" />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(720);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

type Serie = { key: string; label: string; color: string; data: number[] };

// Courbes d'activité : réticule vertical qui suit la souris, infobulle avec toutes les séries du jour
function ActivityChart({ labels, series }: { labels: string[]; series: Serie[] }) {
  const [wrap, W] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => setHover(null), [labels.length]);
  const H = 260, pl = 34, pr = 12, pt = 14, pb = 28;
  const iw = W - pl - pr, ih = H - pt - pb;
  const max = Math.max(4, ...series.flatMap((s) => s.data));
  const step = Math.ceil(max / 4);
  const top = step * 4;
  const x = (i: number) => pl + (labels.length < 2 ? iw / 2 : (i / (labels.length - 1)) * iw);
  const y = (v: number) => pt + ih - (v / top) * ih;
  const every = Math.ceil(labels.length / Math.max(2, Math.floor(iw / 70)));
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const i = Math.round(((px - pl) / iw) * (labels.length - 1));
    setHover(Math.min(labels.length - 1, Math.max(0, i)));
  };
  return (
    <div ref={wrap} className="chart-wrap">
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img" aria-label="Activité quotidienne sur la période">
        {[0, 1, 2, 3, 4].map((k) => (
          <g key={k}>
            <line x1={pl} x2={W - pr} y1={y(k * step)} y2={y(k * step)} className={k ? 'grid' : 'axis'} />
            <text x={pl - 8} y={y(k * step) + 4} className="tick" textAnchor="end">{k * step}</text>
          </g>
        ))}
        {labels.map((d, i) => ((i % every === 0 && labels.length - 1 - i >= every * 0.7) || i === labels.length - 1) && (
          <text key={d} x={x(i)} y={H - 8} className="tick" textAnchor={i === 0 ? 'start' : i === labels.length - 1 ? 'end' : 'middle'}>{fmtDay(d)}</text>
        ))}
        {series.map((s) => {
          const d = s.data.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
          return (
            <g key={s.key}>
              <path d={`${d}L${x(s.data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`} fill={s.color} opacity=".07" />
              <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
            </g>
          );
        })}
        {hover !== null && hover < labels.length && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={pt} y2={pt + ih} className="crosshair" />
            {series.map((s) => <circle key={s.key} cx={x(hover)} cy={y(s.data[hover])} r="4.5" fill={s.color} stroke="#fff" strokeWidth="2" />)}
          </g>
        )}
      </svg>
      {hover !== null && hover < labels.length && (
        <div className="viz-tip" style={{ left: Math.min(W - 190, Math.max(0, x(hover) + 12)), top: 8 }}>
          <b>{fmtDay(labels[hover])}</b>
          {series.map((s) => (
            <div key={s.key} className="tip-row"><i style={{ background: s.color }} /><span>{s.label}</span><strong>{s.data[hover]}</strong></div>
          ))}
        </div>
      )}
    </div>
  );
}

// Barre horizontale avec infobulle au survol (la barre est la zone de survol)
function HBar({ label, value, max, display, color, sub }: { label: string; value: number; max: number; display: string; color: string; sub?: string }) {
  const pct = max ? Math.max(value ? 3 : 0, (value / max) * 100) : 0;
  return (
    <div className="hbar" title={`${label} : ${display}${sub ? ` · ${sub}` : ''}`}>
      <div className="hbar-head"><span>{label}</span><b>{display}</b></div>
      <div className="hbar-track"><div className="hbar-fill" style={{ width: `${pct}%`, background: color }} /></div>
      {sub && <small>{sub}</small>}
    </div>
  );
}

const KIND: Record<string, [string, string]> = {
  dossier: ['Dossier', 'D'], panier: ['Site', 'S'], reporting: ['Commercial', 'C'], compte: ['Compte', 'A'], ticket: ['SAV', '!'],
};
function activityText(a: any) {
  switch (a.kind) {
    case 'dossier': return a.detail === 'valide' ? `${a.subject} : validé par le client` : `${a.subject} : ${(DOSSIER_STATUS[a.detail]?.[0] || a.detail).toLowerCase()}`;
    case 'panier': return a.who ? `Demande de devis ${a.detail} pour ${a.subject}` : `Panier ${a.detail} reçu du site : ${a.subject}`;
    case 'reporting': return `${REASON_LABEL[a.detail] || a.detail} : ${a.subject}`;
    case 'compte': return `Nouveau compte ${a.detail || 'client'} : ${a.subject}`;
    case 'ticket': return `Ticket SAV (${a.detail}) : ${a.subject}`;
    default: return a.subject;
  }
}

// Palette catégorielle de référence (validée daltonisme, 3 premières teintes) et teinte d'accent de la marque
const C = { blue: '#2a78d6', orange: '#eb6834', aqua: '#1baf7a', navy: '#001042' };
const SPARK: Record<string, string> = { signed: C.navy, reports: C.blue, prospects: C.orange, carts: C.aqua };

// Blocs que la direction peut afficher ou masquer (choix enregistré sur son compte)
const BLOCKS: [string, string, string][] = [
  ['todo', 'À traiter', 'Vue d’ensemble'],
  ['kpi_signed', 'Dossiers signés', 'Indicateurs'],
  ['kpi_reports', 'Appels et visites', 'Indicateurs'],
  ['kpi_prospects', 'Nouveaux prospects', 'Indicateurs'],
  ['kpi_carts', 'Paniers et devis reçus', 'Indicateurs'],
  ['activity', 'Activité quotidienne', 'Graphiques et listes'],
  ['revenue', 'Revenu récurrent', 'Graphiques et listes'],
  ['funnel', 'Entonnoir commercial', 'Graphiques et listes'],
  ['dossiers', 'Dossiers clients', 'Graphiques et listes'],
  ['team', 'Équipe commerciale', 'Graphiques et listes'],
  ['feed', 'Activité récente', 'Graphiques et listes'],
  ['production', 'Production', 'Graphiques et listes'],
];

function Customize({ hidden, onChange, onClose }: { hidden: string[]; onChange: (h: string[]) => void; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const out = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    setTimeout(() => document.addEventListener('mousedown', out), 0);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', out); document.removeEventListener('keydown', esc); };
  }, [onClose]);
  const groups = [...new Set(BLOCKS.map((b) => b[2]))];
  return (
    <div ref={ref} className="customize" role="dialog" aria-label="Personnaliser le tableau de bord">
      <div className="customize-head"><b>Blocs affichés</b><button onClick={() => onChange([])}>Tout afficher</button></div>
      {groups.map((g) => (
        <div key={g} className="customize-group">
          <small>{g}</small>
          {BLOCKS.filter((b) => b[2] === g).map(([key, label]) => (
            <label key={key} className="switch-row">
              <span>{label}</span>
              <input type="checkbox" role="switch" checked={!hidden.includes(key)}
                onChange={(e) => onChange(e.target.checked ? hidden.filter((k) => k !== key) : [...hidden, key])} />
              <i aria-hidden="true" />
            </label>
          ))}
        </div>
      ))}
      <p>Votre choix est enregistré sur votre compte et vous suit sur tous vos appareils.</p>
    </div>
  );
}

export default function AdminDashboard({ data, period, setPeriod, name }: { data: any; period: number; setPeriod: (p: number) => void; name: string }) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [table, setTable] = useState(false);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [custom, setCustom] = useState(false);
  const loaded = useRef(false);
  // Préférences du compte : blocs masqués et période par défaut
  useEffect(() => {
    api('/me/preferences').then((p) => {
      setBlocks(Array.isArray(p?.dashboard?.hidden) ? p.dashboard.hidden : []);
      if ([7, 30, 90].includes(p?.dashboard?.period) && p.dashboard.period !== period) setPeriod(p.dashboard.period);
      loaded.current = true;
    }).catch(() => { loaded.current = true; });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const savePrefs = (patch: any) => api('/me/preferences', { method: 'PUT', body: { dashboard: { hidden: blocks, period, ...patch } } }).catch(() => {});
  const changeBlocks = (h: string[]) => { setBlocks(h); savePrefs({ hidden: h }); };
  const changePeriod = (p: number) => { setPeriod(p); if (loaded.current) savePrefs({ period: p }); };
  const show = (k: string) => !blocks.includes(k);
  const all: Serie[] = useMemo(() => data ? [
    { key: 'reports', label: 'Appels et visites', color: C.blue, data: data.series.reports },
    { key: 'prospects', label: 'Nouveaux prospects', color: C.orange, data: data.series.prospects },
    { key: 'carts', label: 'Paniers et devis', color: C.aqua, data: data.series.carts },
  ] : [], [data]);
  const shown = all.filter((s) => !hidden.includes(s.key));
  const hour = new Date().getHours();

  if (!data) return <div className="dash-skeleton" aria-busy="true" />;

  const f = Object.fromEntries(data.funnel.map((r: any) => [r.label, Number(r.n)]));
  const stages = [
    ['Prospects', (f.prospect || 0) + (f.qualifie || 0) + (f.promesse || 0) + (f.client || 0)],
    ['Qualifiés', (f.qualifie || 0) + (f.promesse || 0) + (f.client || 0)],
    ['Promesse de signature', (f.promesse || 0) + (f.client || 0)],
    ['Clients', f.client || 0],
  ] as [string, number][];
  const offerMax = Math.max(1, ...data.byOffer.map((o: any) => Number(o.mrr)));
  const pipe = Object.fromEntries(data.pipeline.map((p: any) => [p.status, Number(p.n)]));
  const pipeTotal = Object.values(pipe).reduce((a: number, b: any) => a + Number(b), 0) as number;
  const lbMax = Math.max(1, ...data.leaderboard.map((l: any) => Number(l.activity)));
  const todo = data.todo.filter((t: any) => t.n > 0);

  return (
    <div className="dash">
      <header className="dash-head">
        <div>
          <div className="eyebrow">Direction</div>
          <h1>{hour < 18 ? 'Bonjour' : 'Bonsoir'}, {name.split(' ')[0]}.</h1>
          <p>Voici ce qui s’est passé sur les {data.days} derniers jours, comparé aux {data.days} jours précédents.</p>
        </div>
        <div className="dash-tools">
          <div className="seg-ctl" role="tablist" aria-label="Période">
            {[7, 30, 90].map((p) => (
              <button key={p} role="tab" aria-selected={period === p} className={period === p ? 'on' : ''} onClick={() => changePeriod(p)}>{p} jours</button>
            ))}
          </div>
          <div className="customize-wrap">
            <button className={`btn-custom ${custom ? 'on' : ''}`} onClick={() => setCustom(!custom)} aria-expanded={custom}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></svg>
              Personnaliser{blocks.length ? ` · ${blocks.length} masqué${blocks.length > 1 ? 's' : ''}` : ''}
            </button>
            {custom && <Customize hidden={blocks} onChange={changeBlocks} onClose={() => setCustom(false)} />}
          </div>
        </div>
      </header>

      {show('todo') && todo.length > 0 && (
        <div className="todo-strip" aria-label="À traiter">
          <span className="todo-title">À traiter</span>
          {todo.map((t: any) => (
            <Link key={t.label} href={t.link} className={`todo-chip ${t.level || 'warning'}`}>
              <span className="todo-ico" aria-hidden="true">!</span><b>{t.n}</b> {t.label}
            </Link>
          ))}
        </div>
      )}

      <div className="hl-grid">
        {data.headline.filter((h: any) => show(`kpi_${h.key}`)).map((h: any) => (
          <Link key={h.key} href={h.link} className="hl-card">
            <div className="hl-top"><span>{h.label}</span><Delta now={h.value} prev={h.prev} /></div>
            <b className="hl-val">{fmtN(h.value)}</b>
            <Sparkline data={h.spark} color={SPARK[h.key]} />
            <small>{fmtN(h.prev)} sur la période précédente</small>
          </Link>
        ))}
      </div>

      <div className="dash-grid">
        {show('activity') && <section className="panel span-2">
          <div className="panel-head">
            <div><h2>Activité quotidienne</h2><p>Survolez le graphique pour voir le détail d’un jour.</p></div>
            <div className="legend">
              {all.map((s) => (
                <button key={s.key} className={hidden.includes(s.key) ? 'off' : ''} aria-pressed={!hidden.includes(s.key)}
                  onClick={() => setHidden(hidden.includes(s.key) ? hidden.filter((k) => k !== s.key) : [...hidden, s.key])}>
                  <i style={{ background: s.color }} />{s.label}
                </button>
              ))}
              <button className="table-toggle" onClick={() => setTable(!table)}>{table ? 'Graphique' : 'Tableau'}</button>
            </div>
          </div>
          {table ? (
            <div className="table-wrap" style={{ maxHeight: 280, overflow: 'auto' }}>
              <table className="t">
                <thead><tr><th>Jour</th>{all.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
                <tbody>{[...data.series.labels].reverse().map((d: string, ri: number) => {
                  const i = data.series.labels.length - 1 - ri;
                  return <tr key={d}><td>{fmtDay(d)}</td>{all.map((s) => <td key={s.key}>{s.data[i]}</td>)}</tr>;
                })}</tbody>
              </table>
            </div>
          ) : <ActivityChart labels={data.series.labels} series={shown} />}
        </section>}

        {show('revenue') && <section className="panel">
          <div className="panel-head"><div><h2>Revenu récurrent</h2><p>HT par mois, selon la formule de chaque client.</p></div></div>
          <b className="big-num">{fmtN(data.clients.mrr)} <small>DA / mois</small></b>
          <p className="muted-line">{data.clients.active} clients actifs · {data.clients.accounts.now} nouveaux comptes clients sur la période</p>
          <div className="hbars">
            {data.byOffer.map((o: any) => (
              <HBar key={o.name} label={o.name} value={Number(o.mrr)} max={offerMax} display={`${fmtN(o.mrr)} DA`} color={C.blue} sub={o.price_month == null ? `${o.clients} client${o.clients > 1 ? 's' : ''} sur mesure` : `${o.clients} client${o.clients > 1 ? 's' : ''} × ${fmtN(o.price_month)} DA`} />
            ))}
          </div>
          {data.clients.mrr === 0 && <p className="muted-line">Le revenu se calcule quand une formule est choisie dans le dossier du client.</p>}
        </section>}

        {show('funnel') && <section className="panel">
          <div className="panel-head"><div><h2>Entonnoir commercial</h2><p>Fiches de l’Univers arrivées à chaque étape.</p></div></div>
          <div className="funnel">
            {stages.map(([label, n], i) => {
              const base = stages[0][1] || 1;
              const prev = i ? stages[i - 1][1] : 0;
              return (
                <div key={label} className="funnel-row" title={`${label} : ${n}`}>
                  <div className="funnel-bar" style={{ width: `${Math.max(n ? 8 : 2, (n / base) * 100)}%`, opacity: 1 - i * 0.18 }} />
                  <div className="funnel-text"><span>{label}</span><b>{fmtN(n)}</b>{i > 0 && <small>{prev ? Math.round((n / prev) * 100) : 0} % de l’étape précédente</small>}</div>
                </div>
              );
            })}
          </div>
          {f.a_eviter ? <p className="muted-line">{f.a_eviter} fiche{f.a_eviter > 1 ? 's' : ''} marquée{f.a_eviter > 1 ? 's' : ''} « À éviter », hors entonnoir.</p> : null}
        </section>}

        {show('dossiers') && <section className="panel">
          <div className="panel-head"><div><h2>Dossiers clients</h2><p>{pipeTotal} dossiers, par étape.</p></div><Link href="/dashboard/dossiers" className="panel-link">Tout voir</Link></div>
          <div className="hbars">
            {['signe', 'creation_en_cours', 'livre'].map((k) => (
              <Link key={k} href={`/dashboard/dossiers?status=${k}`} className="hbar-link">
                <HBar label={DOSSIER_STATUS[k]?.[0] || k} value={pipe[k] || 0} max={Math.max(1, ...Object.values(pipe) as number[])} display={fmtN(pipe[k] || 0)} color={C.navy} />
              </Link>
            ))}
          </div>
        </section>}

        {show('team') && <section className="panel span-2">
          <div className="panel-head"><div><h2>Équipe commerciale</h2><p>Appels et visites déclarés et dossiers signés sur la période choisie (avec le total depuis le début), deals en cours.</p></div><Link href="/dashboard/reporting" className="panel-link">Reporting</Link></div>
          {data.leaderboard.length === 0 ? <p className="muted-line">Aucun commercial actif.</p> : (
            <div className="lb">
              {data.leaderboard.map((l: any, i: number) => (
                <div key={l.id} className="lb-row">
                  <span className={`lb-rank r${i + 1}`}>{i + 1}</span>
                  <span className="avatar" aria-hidden="true">{l.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                  <div className="lb-who"><b>{l.name}</b><small>{ROLE_LABELS[l.role]}</small></div>
                  <div className="lb-bar" title={`${l.activity} appels et visites`}>
                    <div className="hbar-track"><div className="hbar-fill" style={{ width: `${(Number(l.activity) / lbMax) * 100}%`, background: C.blue }} /></div>
                    <small>{l.activity} appels et visites</small>
                  </div>
                  <div className="lb-stat" title="Signés sur la période choisie, et depuis le début"><b>{l.signed}</b><small>signés · {l.signed_total ?? l.signed} au total</small></div>
                  <div className="lb-stat"><b>{l.open_deals}</b><small>deals en cours</small></div>
                </div>
              ))}
            </div>
          )}
        </section>}

        {show('feed') && <section className="panel">
          <div className="panel-head"><div><h2>Activité récente</h2><p>Les derniers événements de la plateforme.</p></div></div>
          <ol className="feed">
            {data.activity.map((a: any, i: number) => (
              <li key={i}>
                <span className={`feed-ico k-${a.kind}`} aria-hidden="true">{KIND[a.kind]?.[1]}</span>
                <div><p>{activityText(a)}</p><small>{KIND[a.kind]?.[0]} · {fmtDate(a.at, true)}{a.who ? ` · ${a.who}` : ''}</small></div>
              </li>
            ))}
          </ol>
        </section>}

        {show('production') && <section className="panel span-3">
          <div className="panel-head"><div><h2>Production</h2><p>Charge de chaque collaborateur. Taux de validation du premier coup : <b>{data.firstTime}</b>.</p></div><Link href="/dashboard/taches" className="panel-link">Tâches</Link></div>
          <div className="prod-grid">
            {data.production.map((t: any) => (
              <div key={t.name} className={`prod-card ${Number(t.late) ? 'late' : ''}`}>
                <span className="avatar" aria-hidden="true">{t.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}</span>
                <div className="prod-who"><b>{t.name}</b><small>{ROLE_LABELS[t.role]}</small></div>
                <div className="prod-stats">
                  <span><b>{t.today || 0}</b> aujourd’hui</span>
                  <span className={Number(t.late) ? 'warn' : ''}><b>{t.late || 0}</b> en retard</span>
                  <span><b>{t.done || 0}</b> validées</span>
                </div>
              </div>
            ))}
          </div>
        </section>}
      </div>
      {blocks.length === BLOCKS.length && <p className="muted-line" style={{ textAlign: 'center' }}>Tous les blocs sont masqués. Utilisez « Personnaliser » pour en afficher.</p>}
    </div>
  );
}
