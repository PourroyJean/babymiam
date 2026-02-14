# Grrrignote

MVP Next.js pour suivre la diversification alimentaire de bébé (mode multi-user).

## Stack
- Next.js (App Router)
- PostgreSQL (`pg` / node-postgres)
- Auth email + mot de passe hashé (Argon2id)
- Email transactionnel via Resend (reset password)

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
4. Appliquer le schéma et charger les aliments:
   ```bash
   npm run db:setup
   ```
5. Créer le premier compte admin:
   ```bash
   npm run users:create -- --email parent@example.com --password "ChangeMe123!"
   ```
6. Démarrer l'app:
   ```bash
   npm run dev
   ```

Le seed charge les catégories/aliments depuis `aliments_categories.json`.
Si `POSTGRES_URL` n'est pas défini, l'app utilise `postgres://postgres:postgres@localhost:5432/babymiam`.

## Scripts DB
- `npm run db:migrate`
- `npm run db:sync-allergens` (prune + resync transactionnel de `Allergènes majeurs` depuis `aliments_categories.json`)
- `npm run db:seed`
- `npm run db:setup`

## Variables d'environnement
- `AUTH_SECRET` (ou `AUTH_SECRETS` pour rotation)
- `POSTGRES_URL`
- `APP_BASE_URL`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `PASSWORD_RESET_TTL_MINUTES` (défaut `60`)
- `MAINTENANCE_MODE` (`true|false`)

## Scripts users
- `npm run users:create -- --email <email> --password <password>`
- `LEGACY_ADMIN_EMAIL=<email> LEGACY_ADMIN_PASSWORD=<password> npm run users:migrate-legacy` (migration des données legacy `owner_key` -> `owner_id`)

## Ajout manuel d'un user (a la mano)
Si la base locale vient d'un ancien schema, lance d'abord `npm run db:migrate` puis `LEGACY_ADMIN_EMAIL=<email> LEGACY_ADMIN_PASSWORD=<password> npm run users:migrate-legacy`.
Cree ensuite le compte avec `npm run users:create -- --email <email> --password <password>`.
Connecte-toi avec l'email du compte cree (pas `AUTH_USER`).
Redemarre enfin `npm run dev` avec la meme base locale (`POSTGRES_URL=postgres://postgres:postgres@localhost:5432/babymiam`).

## Tests E2E (Playwright)
Variables de test supportées:
- `E2E_POSTGRES_URL` (défaut: `postgres://postgres:postgres@localhost:5432/babymiam_e2e`)
- `E2E_BASE_URL` (défaut: `http://127.0.0.1:3005`)
- `E2E_AUTH_EMAIL` (défaut: `parent@example.com`)
- `E2E_AUTH_PASSWORD` (défaut: `LOULOU38`)
- `E2E_AUTH_SECRET` (défaut: `e2e-secret-change-me`)

Exécuter la suite:
```bash
npm run test:e2e
```

## Runbook synchro allergènes (14 officiels)
1. Backup:
   ```bash
   pg_dump "$POSTGRES_URL" -Fc -f backups/local-before-allergens-sync.dump
   ```
2. Exécution:
   ```bash
   npm run db:migrate
   npm run db:sync-allergens
   npm run db:seed
   ```
3. Contrôles SQL:
   ```sql
   SELECT COUNT(*)
   FROM foods f
   JOIN categories c ON c.id = f.category_id
   WHERE c.name = 'Allergènes majeurs';
   ```
   ```sql
   SELECT f.sort_order, f.name
   FROM foods f
   JOIN categories c ON c.id = f.category_id
   WHERE c.name = 'Allergènes majeurs'
   ORDER BY f.sort_order;
   ```
4. Idempotence: rejouer `npm run db:sync-allergens` puis `npm run db:seed`, et revérifier les 2 requêtes ci-dessus.

## Runbook déploiement prod (downtime accepté)
1. Activer `MAINTENANCE_MODE=true` sur Vercel.
2. Exécuter `npm run db:migrate` sur la base Neon cible.
3. Exécuter `npm run db:sync-allergens` sur la base Neon cible.
4. Exécuter `npm run db:seed` sur la base Neon cible.
5. Exécuter `LEGACY_ADMIN_EMAIL=<email> LEGACY_ADMIN_PASSWORD=<password> npm run users:migrate-legacy` si nécessaire.
6. Déployer le code applicatif.
7. Désactiver `MAINTENANCE_MODE`.

Le build n'exécute plus les migrations automatiquement.
