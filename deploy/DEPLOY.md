# Mise en ligne d'IN COM sur le VPS

Le site tourne à côté des autres sites du serveur. Nginx reçoit le domaine et transmet :
- `/` au site et au CRM Next.js, sur le port interne **3100** ;
- `/api` à l'API Node, sur le port interne **4100**.

PM2 garde les deux en vie. Remplacer `VOTRE-DOMAINE.dz` partout.

## 1. Sur le Mac : envoyer le code sur GitHub

1. Sur github.com, créer un dépôt **privé** `in-com`, sans README ni .gitignore.
2. Dans le dossier du projet :

```bash
git init -b main
git config user.name "Votre Nom"
git config user.email "votre@email"
git add .
git commit -m "IN COM : site, panier, suivi et CRM"
git remote add origin git@github.com:VOTRE-COMPTE/in-com.git
git push -u origin main
```

Les fichiers `.env` (mots de passe) ne partent jamais sur GitHub, car ils sont dans `.gitignore`.

## 2. Sur le VPS : vérifier l'existant

```bash
node -v        # il faut 20 ou plus (sinon installer Node 22 LTS avec nvm)
nginx -v       # Nginx déjà utilisé par les autres sites ?
mysql --version
pm2 -v         # sinon : npm install -g pm2
sudo ss -ltnp | grep -E ':3100|:4100'   # doit être vide, sinon changer les ports
```

## 3. Sur le VPS : récupérer le code

Créer une clé de déploiement en lecture seule, propre à ce dépôt :

```bash
ssh-keygen -t ed25519 -f ~/.ssh/incom_deploy -N ""
cat ~/.ssh/incom_deploy.pub
```

Coller la clé dans GitHub, puis déclarer l'alias SSH et cloner le dépôt :
1. Sur GitHub, ouvrir le dépôt, aller dans Settings, puis Deploy keys, puis Add key. Ne pas cocher l'écriture.
2. Ajouter dans `~/.ssh/config` :

   ```
   Host github-incom
     HostName github.com
     IdentityFile ~/.ssh/incom_deploy
   ```

3. Cloner :

   ```bash
   cd /var/www && git clone git@github-incom:VOTRE-COMPTE/in-com.git incom && cd incom
   ```

## 4. Créer la vraie base de données

```bash
sudo mysql
```

```sql
CREATE DATABASE incom_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'incom'@'localhost' IDENTIFIED BY 'UN-MOT-DE-PASSE-LONG';
GRANT ALL PRIVILEGES ON incom_crm.* TO 'incom'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
mysql -u incom -p incom_crm < database/schema.sql
```

## 5. Configurer et initialiser

```bash
cp backend/.env.production.example backend/.env
openssl rand -hex 48          # à coller dans JWT_SECRET
nano backend/.env             # mot de passe MySQL, JWT_SECRET, domaine
cp frontend/.env.production.example frontend/.env.production.local
nano frontend/.env.production.local   # https://VOTRE-DOMAINE.dz/api

cd backend && npm ci --omit=dev
ADMIN_NAME="Prénom Nom" ADMIN_EMAIL="direction@VOTRE-DOMAINE.dz" ADMIN_PASSWORD="mot-de-passe-fort-12-caracteres" node src/seed-prod.js
cd ../frontend && npm ci && npm run build && cd ..
```

`seed-prod.js` crée seulement les formules, les services, les secteurs et votre compte Direction. Il refuse de tourner si la base contient déjà des comptes. Le script de démo `seed.js` est bloqué en production. Les autres comptes (commerciaux, graphistes, clients…) se créent depuis le CRM, menu **Utilisateurs**.

## 6. Démarrer avec PM2

```bash
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup          # exécuter la commande qu'il affiche, pour relancer au reboot
curl http://127.0.0.1:4100/api/health   # {"ok":true,...}
```

## 7. Nginx

```bash
sudo cp deploy/nginx-incom.conf /etc/nginx/sites-available/incom
sudo nano /etc/nginx/sites-available/incom      # mettre le vrai domaine
sudo ln -s /etc/nginx/sites-available/incom /etc/nginx/sites-enabled/incom
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t` vérifie la configuration avant le rechargement. En cas d'erreur, rien n'est rechargé et les autres sites ne sont pas touchés.

## 8. DNS, puis HTTPS

1. Chez le registrar, créer deux enregistrements **A** : `@` et `www` vers l'IP du VPS. Supprimer les anciens A ou AAAA s'il y en a.
2. Attendre que `dig +short VOTRE-DOMAINE.dz` renvoie l'IP du VPS. Selon l'ancien TTL, cela prend de quelques minutes à quelques heures.
3. Activer le HTTPS :

```bash
sudo certbot --nginx -d VOTRE-DOMAINE.dz -d www.VOTRE-DOMAINE.dz
```

## 9. Contrôles

- `https://VOTRE-DOMAINE.dz` : la landing ; ajouter au panier, envoyer, ouvrir le suivi.
- `https://VOTRE-DOMAINE.dz/connexion` : se connecter avec le compte Direction et créer les comptes de l'équipe.
- Les logs : `pm2 logs incom-api` et `pm2 logs incom-web`.

## Mises à jour ensuite

1. Sur le Mac : `git add . && git commit -m "…" && git push`.
2. Sur le VPS : `cd /var/www/incom && ./deploy/update.sh`.

Si `schema.sql` change, appliquer seulement le nouveau fichier de `database/migrations/` sur la base de production. Ne jamais réimporter `schema.sql`, qui efface les tables.

## Sauvegarde de la base (recommandé)

Ajouter dans `crontab -e`, pour une sauvegarde chaque nuit à 3 h :

```
0 3 * * * mysqldump -u incom -p'MOT-DE-PASSE' incom_crm | gzip > /var/backups/incom-$(date +\%F).sql.gz
```
