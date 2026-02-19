# Grrrignote

MVP Next.js pour suivre la diversification alimentaire de bébé (mode multi-user).

## Stack
- Next.js (App Router)
- PostgreSQL (`pg` / node-postgres)
- Auth email + mot de passe hashé (Argon2id)
- Email transactionnel via Resend (reset password)
- Migrations: `node-pg-migrate` (SQL pur)

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
5. Créer le premier compte admin:
   ```bash
   npm run users:create -- --email parent@example.com --password "ChangeMe123!"
   ```
6. Démarrer l'app:
   ```bash
   npm run dev
   ```

Le seed charge les catégories/aliments depuis `aliments_categories.json`.
Le runner de migration ne charge pas `.env.local` automatiquement: il lit
`POSTGRES_URL`, sinon `DATABASE_URL`.
En `NODE_ENV=production` ou `CI=true`, `POSTGRES_URL`/`DATABASE_URL` est obligatoire (échec immédiat sinon).
En local (hors CI/prod), fallback vers `postgres://postgres:postgres@localhost:5432/babymiam`.
Cette règle s'applique aussi au runtime serveur (`lib/db.ts`) et à `npm run users:create`.

## Workflow Base de Données (Migrations)

Nous utilisons `node-pg-migrate` pour versionner le schéma.

- **Préflight prod/CI**:
  ```bash
  npm run db:preflight
  ```
- **Appliquer les migrations** (Up):
  ```bash
  npm run db:migrate
  ```
- **Créer une nouvelle migration** :
  ```bash
  npm run db:migrate:new -- nom_explicite_du_changement
  ```
- **Annuler la dernière migration** (Down):
  ```bash
  npm run db:migrate:down
  ```
- **Reset Complet** (Drop + Migrate + Seed):
  ```bash
  docker compose down -v && docker compose up -d
  npm run db:setup
  ```

## Variables d'environnement
- `AUTH_SECRET` (ou `AUTH_SECRETS` pour rotation)
- `POSTGRES_URL`
- `APP_BASE_URL`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `PASSWORD_RESET_TTL_MINUTES` (défaut `60`)
- `SHARE_SNAPSHOT_TTL_DAYS` (défaut `30`, durée de validité des nouveaux liens publics)
- `MAINTENANCE_MODE` (`true|false`)
- `TRUST_PROXY_IP_HEADERS` (`0` par défaut, `1` uniquement derrière un proxy de confiance)
- `ALLOW_MIGRATE_SKIP` (`1` pour autoriser explicitement un skip manuel de migration en local)
- `E2E_ALLOW_REMOTE_DB_RESET` (`1` pour autoriser un reset destructif E2E sur host non local)

## Tests E2E (Playwright)
Variables de test supportées:
- `E2E_POSTGRES_URL` (défaut: `postgres://postgres:postgres@localhost:5432/babymiam_e2e`)

Exécuter la suite:
```bash
npm run test:e2e
```

Par défaut, le reset destructif E2E est autorisé uniquement pour une base suffixée `_e2e`/`_test` sur host local (`localhost`, `127.0.0.1`, `::1`).
Pour forcer un host distant: `E2E_ALLOW_REMOTE_DB_RESET=1`.

## Garde-fous obligatoires
- `SKIP_DB_SETUP=1` bloque `npm run db:migrate` par défaut.
- Pour skip explicite en local: `ALLOW_MIGRATE_SKIP=1 SKIP_DB_SETUP=1 npm run db:migrate`.
- En prod/CI, demander un skip migration (`SKIP_DB_SETUP=1`) provoque un échec explicite.
- `npm run db:preflight` échoue si `SKIP_DB_SETUP=1`, si l'URL DB est absente, ou si la connexion DB est indisponible.

## Runbook déploiement (Clean Start)
1. Provisionner une base PostgreSQL vierge.
2. Configurer `POSTGRES_URL`.
3. Exécuter le préflight:
   ```bash
   npm run db:preflight
   ```
4. Exécuter les migrations et le seed:
   ```bash
   npm run db:migrate
   npm run db:sync-allergens
   npm run db:seed
   ```
5. Créer un utilisateur initial via script ou console.
6. Déployer le code applicatif.
