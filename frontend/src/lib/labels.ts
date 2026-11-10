type L = Record<string, [string, string]>; // valeur → [libellé, ton]

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Direction (CEO)',
  responsable_commercial: 'Responsable commercial',
  commercial_sedentaire: 'Commercial sédentaire',
  commercial_terrain: 'Commercial terrain',
  responsable_communication: 'Responsable communication',
  responsable_technique: 'Responsable technique',
  charge_clientele: 'Chargé de clientèle',
  graphiste: 'Graphiste',
  community_manager: 'Community manager',
  photographe: 'Photographe / vidéaste',
  media_buyer: 'Media buyer',
  developpeur: 'Développeur (IN DEV)',
  recouvrement: 'Recouvrement',
  client: 'Client',
};

export const PROSPECT_LABEL: L = {
  prospect: ['Prospect', 'neutral'],
  qualifie: ['Qualifié', 'info'],
  promesse: ['Promesse de signature', 'accent'],
  a_eviter: ['À éviter', 'danger'],
  client: ['Client', 'ok'],
};

export const SOURCE_LABEL: Record<string, string> = {
  cold_mailing: 'Cold mailing', ads: 'Sponsoring / Ads', sedentaire: 'Prospection sédentaire', terrain: 'Prospection terrain', site: 'Site web',
};

export const REASON_LABEL: Record<string, string> = {
  prospect: 'Prospect',
  relance_sedentaire: 'Relance prospect sédentaire',
  relance_terrain: 'Relance prospect terrain',
  relance_visite: 'Relance visite commerciale',
  deal_terrain: 'Deal terrain',
  deal_bureau: 'Deal bureau',
  promesse: 'Promesse de signature',
  a_eviter: 'À éviter',
  signe: 'Signé',
  issue_deal: 'Issue de deal',
};

export const DEAL_STATUS: L = {
  a_attribuer: ['À attribuer', 'warn'],
  attribue: ['À programmer', 'info'],
  programme: ['Programmé', 'accent'],
  gagne: ['Gagné', 'ok'],
  perdu: ['Perdu', 'danger'],
  a_relancer: ['À relancer', 'warn'],
};

export const DOSSIER_STATUS: L = {
  signe: ['Signé', 'neutral'],
  paiement_confirme: ['Paiement confirmé', 'info'],
  creation_en_cours: ['Création en cours', 'accent'],
  en_attente_validation: ['En attente de validation', 'warn'],
  modification_demandee: ['Modification demandée', 'danger'],
  livre: ['Livré', 'ok'],
  publie: ['Publié', 'ok'],
};

export const DOSSIER_FLOW = ['signe', 'paiement_confirme', 'creation_en_cours', 'en_attente_validation', 'livre'];

export const TASK_STATUS: L = {
  a_faire: ['À faire', 'neutral'],
  en_cours: ['En cours', 'info'],
  validation_technique: ['En validation technique', 'accent'],
  validation_client: ['En validation client', 'warn'],
  modification_demandee: ['Modification demandée', 'danger'],
  validee: ['Validée', 'ok'],
  publiee: ['Publiée', 'ok'],
};

export const TICKET_STATUS: L = { ouvert: ['Ouvert', 'warn'], en_cours: ['En cours', 'info'], resolu: ['Résolu', 'ok'] };

export const ORDER_STATUS: L = {
  en_attente: ['À valider', 'warn'],
  validee: ['Validée', 'info'],
  recouvrement: ['Au recouvrement', 'accent'],
  payee: ['Payée', 'ok'],
  annulee: ['Annulée', 'neutral'],
};

export const SERVICE_TYPE: Record<string, string> = {
  abonnement: 'Abonnement marketing digital', graphisme: 'Design graphique', photo_video: 'Photo / vidéo',
  developpement: 'Développement', media_buying: 'Media buying', evenementiel: 'Événementiel',
};

export const DEPARTMENTS: Record<string, string> = {
  commercial: 'Commercial', communication: 'Communication', technique: 'Technique', facturation: 'Facturation',
};

// Paniers du site (suivi public sur /suivi/<code>)
export const CART_STATUS: L = {
  recue: ['Reçue', 'warn'],
  contactee: ['Client contacté', 'info'],
  devis_envoye: ['Devis envoyé', 'info'],
  confirmee: ['Confirmée', 'accent'],
  en_production: ['En production', 'accent'],
  livree: ['Livrée', 'ok'],
  annulee: ['Annulée', 'neutral'],
};
