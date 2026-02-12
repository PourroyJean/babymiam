# Babymiam

MVP Next.js pour suivre la diversification alimentaire de bébé.

## Stack
- Next.js (App Router)
- PostgreSQL (`pg` / node-postgres)
- Auth simple (identifiant + mot de passe uniques via variables d'environnement)

## Setup local
1. Copier les variables:
   ```bash
   cp .env.example .env.local
   ```
2. Lancer Postgres local:
   ```bash
   docker compose up -d
   ```
3. Installer les dépendances:
   ```bash
   npm install
   ```
4. Démarrer:
   ```bash
   npm run dev
   ```

L'application crée les tables automatiquement et seed les catégories/aliments depuis `aliments_categories.json`.
Si `POSTGRES_URL` n'est pas défini, l'app utilise par défaut `postgres://postgres:postgres@localhost:5432/babymiam`.

## Auth par défaut
- ID: `LJCLS`
- Mot de passe: `LOULOU38`

Tu peux changer via:
- `AUTH_USER`
- `AUTH_PASSWORD`
- `AUTH_SECRET`

## Déploiement Vercel
1. Importer le repo sur Vercel.
2. Ajouter une base Vercel Postgres.
3. Vérifier les variables d'environnement (`POSTGRES_URL`, `AUTH_*`).
4. Déployer.
