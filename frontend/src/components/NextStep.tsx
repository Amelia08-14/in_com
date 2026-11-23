// Encadré « Prochaine étape », le même sur chaque dossier, deal, devis et tâche :
// ce que vous devez faire maintenant (ou qui doit agir), et ce qui se passera ensuite.
export type Step = { title: string; you?: string; then?: string; tone?: 'act' | 'wait' | 'done' };

export default function NextStep({ step, children }: { step: Step | null; children?: React.ReactNode }) {
  if (!step) return null;
  const tone = step.tone || 'act';
  return (
    <div className={`next-step ${tone === 'act' ? '' : tone}`} role="status">
      <span className="ns-label">{tone === 'done' ? 'Terminé' : tone === 'wait' ? 'En attente' : 'Prochaine étape'}</span>
      <h3>{step.title}</h3>
      {step.you && <p>{step.you}</p>}
      {step.then && <p className="ns-then">Ensuite : {step.then}</p>}
      {children && <div className="ns-actions">{children}</div>}
    </div>
  );
}
