'use client';
// /dashboard : CRM réservé à l'équipe IN COM. Les clients sont renvoyés vers /espace-client.
import AppShell from '@/components/AppShell';

export default function TeamLayout({ children }: { children: React.ReactNode }) {
  return <AppShell space="team">{children}</AppShell>;
}
