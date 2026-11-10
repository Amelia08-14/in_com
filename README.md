# IN COM — Landing page + CRM

Plateforme IN COMMUNICATION (La Maison IN Groupe) : site vitrine et espace CRM par rôle.

| Dossier | Contenu |
|---|---|
| `frontend/` | Next.js 15 (App Router, TypeScript) : landing page `/`, administration `/dashboard` (connexion `/dashboard/connexion`, CRM `/dashboard/*`) |
| `backend/` | API Node.js / Express + MySQL (mysql2), auth JWT, règles métier des workflows |
| `database/schema.sql` | Schéma MySQL 8 |
| `scripts/` | Démarrage local (MySQL, API, front, Adminer) |
| `tools/adminer.php` | Interface d'admin MySQL en PHP (équivalent phpMyAdmin) |

## Environnement local (Mac, sans WAMP)

WAMP n'existe que sous Windows. Sur ce Mac, l'équivalent est installé en version portable dans `~/.local/opt` (sans sudo ni Homebrew) :
Node.js 26, MySQL 8.4 LTS et PHP 8.4 (pour Adminer). Sous Windows, WAMP fournit MySQL + PHP : il suffit d'importer `database/schema.sql` et d'installer Node.js.

```bash
./scripts/start-mysql.sh      # MySQL sur 127.0.0.1:3306
./scripts/setup-db.sh         # crée la base incom_crm + données de démo (une seule fois, ou pour réinitialiser)
./scripts/dev-api.sh          # API sur http://localhost:4000
./scripts/dev-web.sh          # Site + CRM sur http://localhost:3000
./scripts/adminer.sh          # Adminer sur http://localhost:8080/adminer.php (serveur 127.0.0.1, user incom / incom_local)
./scripts/stop-mysql.sh
```

Comptes de démo : `<role>@incom.dz` / `incom2026` (boutons sur la page de connexion), par ex. `ceo@`, `sedentaire@`, `terrain@`, `resp.com@`, `resp.tech@`, `cc@`, `gd@`, `cm@`, `client@`.

## Rôles et modules

| Rôle | Modules |
|---|---|
| Commercial sédentaire | Univers (tous secteurs), Reporting (appels), Deals, Calendrier, SAV, Commandes client |
| Commercial terrain | Univers (ses secteurs), Reporting (visites), Deals attribués, Calendrier |
| Responsable commercial | Tout le commercial + attribution des deals terrain, demandes du site |
| Responsable communication | Dossiers (paiement → CC → répartition), quotas, tâches, validation, équipe GD |
| Responsable technique | Validation technique, réattribution, attribution clients ↔ GD, statistiques équipe |
| Chargé de clientèle | Ses dossiers, présentation au client, validation / modification |
| Graphiste (et production) | Tâches du jour (création / modification), clients, suivi validation, reporting auto |
| Community manager | Contenus validés à publier |
| Recouvrement | Commandes validées à encaisser |
| Client | Projets, validation des contenus, commandes extra, support |

## Panier et suivi de commande (site)

Sur la landing, le visiteur compose un panier : une formule (3 ou 6 mois), des services à prix fixe et des métiers sur devis. À l’envoi, l’API recalcule les prix depuis la base, crée la fiche dans l’Univers (source « site ») et renvoie un code de suivi `IC-XXXXXX`. Le client suit l’avancement sur `/suivi/<code>` (reçue, conseiller en contact, devis envoyé, confirmée, en production, livrée). Les commerciaux font avancer chaque panier depuis **Paniers du site** dans le CRM ; la note saisie est visible par le client. Tables : `carts`, `cart_items`, `cart_events` (migration `database/migrations/002_paniers.sql`, déjà incluse dans `schema.sql`).

Règles automatiques implémentées (d'après les workflows) : passage en Qualifié (déjà prospecté par un autre commercial / plus de 2 visites), deal terrain → responsable → commercial terrain, deal bureau auto-attribué, documents obligatoires pour un Signé, issue de deal copiée dans le reporting, retour des deals « à relancer » au créateur, aucune production sans paiement confirmé, quotas mensuels découpés en tâches quotidiennes (dimanche → jeudi), report des tâches en retard, alerte à 3 jours de retard cumulé, ratio de modifications (alerte à 30 %), réattribution forcée, notifications CRM.

## Points à valider

- Prix des services extra (`backend/src/seed.js`, table `services`) : valeurs indicatives.
- Logo : extrait de la Brand Guideline 2026 (page de couverture) en PNG transparent 994 × 1092 px, dans `frontend/public/brand/` (`logo.png`, et `logo-light.png` pour les fonds marine). Un SVG vectoriel officiel, s'il existe chez le graphiste, peut le remplacer (`logo.svg` est pris en priorité par la landing).
- Bleu de la charte : le PDF indique HEX `005395` mais RGB `0/61/166` (= `#003DA6`). `#005395` est utilisé.
- Questions ouvertes des workflows : validation finale client ou CC, canal des notifications (e-mail, WhatsApp), droits de modification des fiches Univers par le terrain.
- Notifications e-mail : brancher un SMTP dans `backend/src/util.js` (`notify`).

## Déploiement VPS

Guide complet pas à pas : [deploy/DEPLOY.md](deploy/DEPLOY.md) (GitHub, base de production sans données d’exemple, PM2, Nginx, DNS, HTTPS, mises à jour).
