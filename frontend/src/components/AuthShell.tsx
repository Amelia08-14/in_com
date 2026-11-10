import Link from 'next/link';
import Logo from '@/components/Logo';

// Mise en page commune à la connexion et à l'inscription : panneau marine à gauche, formulaire à droite
export default function AuthShell({ title, text, children }: { title: React.ReactNode; text: string; children: React.ReactNode }) {
  return (
    <div className="auth">
      <div className="auth-side">
        <Link href="/"><Logo /></Link>
        <div>
          <div className="eyebrow">Plateforme IN COM</div>
          <h1>{title}<span style={{ color: 'var(--orange)' }}>.</span></h1>
          <p>{text}</p>
        </div>
        <small>© IN COMMUNICATION · La Maison IN Groupe</small>
      </div>
      <div className="auth-main">{children}</div>
    </div>
  );
}
