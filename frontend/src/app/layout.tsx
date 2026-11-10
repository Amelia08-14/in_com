import type { Metadata } from 'next';
import { Roboto_Slab, Inter, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

const slab = Roboto_Slab({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700'], variable: '--ff-slab' });
const sans = Inter({ subsets: ['latin'], variable: '--ff-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--ff-mono' });

export const metadata: Metadata = {
  title: 'IN COMMUNICATION — Agence de communication à Alger',
  description:
    'Stratégie, création, production et événementiel. Un seul interlocuteur, un espace client pour suivre vos projets et des résultats mesurés chaque mois.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${slab.variable} ${sans.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
