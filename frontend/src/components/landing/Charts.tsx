// Graphiques construits sur les données réelles des formules (voir l'artifact « Plateforme IN COM »)
const PLANS = [
  { name: 'Essentiel', posts: 8, stories: 15, storiesLabel: '15', reels: 0, reelsLabel: '0' },
  { name: 'Pro', posts: 12, stories: 24, storiesLabel: '24', reels: 2, reelsLabel: '2' },
  { name: 'Premium', posts: 16, stories: 30, storiesLabel: 'chaque jour', reels: 6, reelsLabel: '4 à 6' },
];

export function QuotaChart() {
  const W = 620, H = 300, top = 24, base = 250, max = 30;
  const y = (v: number) => base - ((base - top) * v) / max;
  const groupW = W / 3;
  const bw = 40;
  return (
    <figure className="chart" aria-labelledby="quota-title" data-reveal>
      <h3 id="quota-title">Ce que chaque formule produit par mois</h3>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Diagramme en barres : posts, stories et reels inclus chaque mois pour Essentiel, Pro et Premium" className="diagram">
        <line className="axis" x1="0" x2={W} y1={base} y2={base} />
        {PLANS.map((p, i) => {
          const x0 = i * groupW + groupW / 2 - (bw * 3 + 16) / 2;
          const bars = [
            { v: p.posts, l: String(p.posts), c: 's1' },
            { v: p.stories, l: p.storiesLabel, c: 's2' },
            { v: p.reels, l: p.reelsLabel, c: 's3' },
          ];
          return (
            <g key={p.name}>
              {bars.map((b, j) => {
                const x = x0 + j * (bw + 8);
                return (
                  <g key={j}>
                    <rect className={b.c} x={x} y={y(b.v)} width={bw} height={Math.max(base - y(b.v), 2)} rx="4" style={{ ['--j' as string]: i * 3 + j }} />
                    <text className="val" style={{ ['--j' as string]: i * 3 + j }} x={x + bw / 2} y={y(b.v) - 8} textAnchor="middle">{b.l}</text>
                  </g>
                );
              })}
              <text className="lbl" x={i * groupW + groupW / 2} y={base + 28} textAnchor="middle">{p.name}</text>
            </g>
          );
        })}
      </svg>
      <ul className="legend">
        <li><i className="k1" />Posts Facebook et Instagram</li>
        <li><i className="k2" />Stories</li>
        <li><i className="k3" />Reels</li>
      </ul>
    </figure>
  );
}

export function DailyPriceChart() {
  const rows = [['Essentiel', 500], ['Pro', 1170], ['Premium', 2330]] as const;
  return (
    <figure className="chart narrow" aria-labelledby="day-title" data-reveal>
      <h3 id="day-title">Le prix ramené à la journée</h3>
      <div className="bars-h" role="img" aria-label="Environ 500 DA par jour pour Essentiel, 1 170 DA pour Pro et 2 330 DA pour Premium">
        {rows.map(([n, v], j) => (
          <div key={n} style={{ ['--j' as string]: j }}>
            <span>{n}</span>
            <span className="track"><span className="fill" style={{ width: `${(v / 2330) * 100}%` }} /></span>
            <b>{v.toLocaleString('fr-FR')} DA</b>
          </div>
        ))}
      </div>
      <figcaption>Montants HT, arrondis, sur la base d’un mois de 30 jours. Budget publicitaire en plus, à la charge du client.</figcaption>
    </figure>
  );
}
