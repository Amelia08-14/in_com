/* eslint-disable @next/next/no-img-element */
import '@/styles/site/site.css';

export const metadata = { title: 'Suivi de commande — IN COMMUNICATION' };

export default function SuiviLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="site suivi">
      <header className="nav solid">
        <div className="container">
          <a href="/" className="brand" aria-label="IN COMMUNICATION, accueil"><img src="/brand/logo.png" alt="IN COMMUNICATION" width={994} height={1092} /></a>
          <a href="/" className="link">← Retour au site</a>
        </div>
      </header>
      <main className="container suivi-main">{children}</main>
    </div>
  );
}
