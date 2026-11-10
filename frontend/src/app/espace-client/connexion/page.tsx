'use client';
// Connexion de l'espace client (/espace-client)
import AuthShell from '@/components/AuthShell';
import LoginForm from '@/components/LoginForm';
import '@/app/dashboard/espace.css';

export default function ClientLogin() {
  return (
    <AuthShell
      title={<>Votre espace client,<br />vos devis,<br />vos projets</>}
      text="Demandez un devis, suivez vos commandes et validez vos contenus avec nos équipes."
    >
      <LoginForm space="client" demo={[['client', 'client']]} />
    </AuthShell>
  );
}
