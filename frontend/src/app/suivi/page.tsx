import { TrackForm } from '@/components/landing/Track';

export default function Suivi() {
  return (
    <div className="track-empty">
      <h1>Suivre ma commande.</h1>
      <p className="lead">Entrez le code reçu après l’envoi de votre panier. Il commence par IC-.</p>
      <TrackForm />
    </div>
  );
}
