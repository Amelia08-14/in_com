// Navigation de l'espace par rôle
export type NavItem = { href: string; label: string; icon: string };

const I = {
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  globe: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18',
  report: 'M5 3h10l4 4v14H5zM9 12h6M9 16h6M9 8h3',
  deal: 'M3 12l4-4 5 5 4-4 5 5M3 20h18',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  sav: 'M4 5h16v11H8l-4 4z',
  cart: 'M3 4h3l2 11h11l2-8H7M9 20a1 1 0 1 0 0-.01M18 20a1 1 0 1 0 0-.01',
  folder: 'M3 6h6l2 2h10v11H3z',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21c0-4 3-6 7-6s7 2 7 6M17 11a3 3 0 1 0 0-6M22 20c0-3-2-5-5-5',
  tasks: 'M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2',
  check: 'M4 12l5 5L20 6',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  team: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  inbox: 'M3 13l3-8h12l3 8v6H3zM3 13h5l1 3h6l1-3h5',
};

const dash: NavItem = { href: '/espace', label: 'Tableau de bord', icon: I.home };
const univers: NavItem = { href: '/espace/univers', label: 'Univers', icon: I.globe };
const reporting: NavItem = { href: '/espace/reporting', label: 'Reporting', icon: I.report };
const deals: NavItem = { href: '/espace/deals', label: 'Deals', icon: I.deal };
const cal: NavItem = { href: '/espace/calendrier', label: 'Calendrier', icon: I.cal };
const sav: NavItem = { href: '/espace/sav', label: 'SAV', icon: I.sav };
const orders: NavItem = { href: '/espace/commandes', label: 'Commandes client', icon: I.cart };
const dossiers: NavItem = { href: '/espace/dossiers', label: 'Dossiers clients', icon: I.folder };
const clients: NavItem = { href: '/espace/clients', label: 'Clients & quotas', icon: I.users };
const tasks: NavItem = { href: '/espace/taches', label: 'Tâches', icon: I.tasks };
const validation: NavItem = { href: '/espace/validation', label: 'Validation', icon: I.check };
const gdTeam: NavItem = { href: '/espace/equipe-gd', label: 'Équipe graphistes', icon: I.chart };
const myStats: NavItem = { href: '/espace/mon-reporting', label: 'Mon reporting', icon: I.chart };
const usersNav: NavItem = { href: '/espace/utilisateurs', label: 'Utilisateurs', icon: I.team };
const leads: NavItem = { href: '/espace/demandes', label: 'Demandes du site', icon: I.inbox };
const carts: NavItem = { href: '/espace/paniers', label: 'Paniers du site', icon: I.cart };

export const NAV: Record<string, NavItem[]> = {
  admin: [dash, univers, reporting, deals, cal, dossiers, clients, tasks, validation, gdTeam, sav, orders, carts, leads, usersNav],
  responsable_commercial: [dash, univers, reporting, deals, cal, carts, leads, sav, orders],
  commercial_sedentaire: [dash, univers, reporting, deals, cal, carts, sav, orders],
  commercial_terrain: [dash, univers, reporting, deals, cal],
  responsable_communication: [dash, dossiers, clients, tasks, validation, gdTeam, sav],
  responsable_technique: [dash, validation, tasks, clients, gdTeam, sav],
  charge_clientele: [dash, dossiers, validation, clients, sav],
  graphiste: [dash, { ...tasks, label: 'Mes tâches' }, { ...clients, label: 'Mes clients' }, { ...validation, label: 'Suivi validation' }, myStats],
  photographe: [dash, { ...tasks, label: 'Mes tâches' }, { ...clients, label: 'Mes clients' }, myStats],
  developpeur: [dash, { ...tasks, label: 'Mes tâches' }, { ...clients, label: 'Mes clients' }, sav],
  media_buyer: [dash, { ...tasks, label: 'Mes tâches' }, { ...clients, label: 'Mes clients' }],
  community_manager: [dash, { ...validation, label: 'À publier' }, dossiers, { ...clients, label: 'Mes clients' }],
  recouvrement: [dash, orders, sav],
  client: [dash, { ...dossiers, label: 'Mes projets' }, { ...validation, label: 'À valider' }, { ...orders, label: 'Commander un extra' }, { ...sav, label: 'Support' }],
};
