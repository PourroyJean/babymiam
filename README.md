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
4. Initialiser la base (migrations + seed):
   ```bash
   npm run db:setup
   ```
5. Démarrer:
   ```bash
   npm run dev
   ```

Le seed charge les catégories/aliments depuis `aliments_categories.json`.
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
2. Ajouter/lier une base Neon (Vercel SQL) au projet.
3. Vérifier les variables d'environnement DB (`DATABASE_URL`, `POSTGRES_URL`) et `AUTH_*`.
4. Déployer (le build exécute `db:migrate` puis `db:seed` avant `next build`).
