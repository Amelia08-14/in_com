'use client';
import AuthShell from '@/components/AuthShell';
import LoginForm from '@/components/LoginForm';
import '../espace.css';

// Comptes de démonstration (base locale uniquement — voir backend/src/seed.js)
const DEMO = [
  ['ceo', 'admin'], ['resp.commercial', 'responsable_commercial'], ['sedentaire', 'commercial_sedentaire'], ['terrain', 'commercial_terrain'],
  ['resp.com', 'responsable_communication'], ['resp.tech', 'responsable_technique'], ['cc', 'charge_clientele'], ['gd', 'graphiste'],
  ['cm', 'community_manager'], ['photo', 'photographe'], ['dev', 'developpeur'], ['recouvrement', 'recouvrement'],
];

// /dashboard/connexion : connexion de l'équipe. Un client qui s'y connecte est envoyé vers /espace-client.
export default function TeamLogin() {
  return (
    <AuthShell
      title={<>Un seul espace,<br />du premier appel<br />à la publication</>}
      text="CRM commercial, suivi de production, validations clients et reporting : chaque rôle retrouve ce dont il a besoin."
    >
      <LoginForm space="team" demo={DEMO} />
    </AuthShell>
  );
}
