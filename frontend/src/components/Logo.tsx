// Logo officiel IN COM-UNI-ACTION (Brand Guideline 2026), extrait en PNG transparent dans public/brand/
// light = version au texte clair, pour les fonds marine (barre latérale du CRM, page de connexion)
/* eslint-disable @next/next/no-img-element */
export default function Logo({ light = true, compact = false }: { light?: boolean; compact?: boolean }) {
  const h = compact ? 36 : 48;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
      <img src={light ? '/brand/logo-light.png' : '/brand/logo.png'} alt="IN COMMUNICATION" width={Math.round((h * 994) / 1092)} height={h} />
      {!compact && (
        <span style={{ display: 'grid', lineHeight: 1.15 }}>
          <span style={{ fontFamily: 'var(--font-slab)', fontWeight: 700, fontSize: 14, color: light ? 'var(--on-navy, #fff)' : 'var(--navy)' }}>
            IN COMMUNICATION
          </span>
          <span style={{ fontSize: 11, color: light ? 'rgba(255,255,255,.6)' : 'var(--muted)' }}>La Maison IN Groupe</span>
        </span>
      )}
    </span>
  );
}
