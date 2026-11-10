'use client';
// /espace-client : espace réservé aux clients (séparé du CRM de l'équipe sur /dashboard)
import AppShell from '@/components/AppShell';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <AppShell space="client">{children}</AppShell>;
}
