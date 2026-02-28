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
5. (Optionnel) Créer un compte local supplémentaire:
   ```bash
   printf "change-me-now" | npm run users:create -- --email "dev@example.com" --password-stdin --status active --verify-email
   ```
6. Démarrer l'app:
   ```bash
   npm run dev
   ```

`npm run db:seed` (et donc `npm run db:setup`) garantit l'upsert du compte d'accès perso:
- email normalisé en lowercase,
- `status='active'`,
- `email_verified_at` renseigné.

Variables canoniques:
- `PERSONAL_ACCESS_EMAIL`
- `PERSONAL_ACCESS_PASSWORD`

En `NODE_ENV=production` ou `CI=true`, credentials invalides/absents pour ce compte provoquent un échec explicite du seed.
Le compte perso est traité premium par défaut, même sans allowlist explicite.

Le seed charge les catégories/aliments depuis `aliments_categories.json`.
Le runner de migration ne charge pas `.env.local` automatiquement: il lit
`POSTGRES_URL`, sinon `DATABASE_URL`.
En `NODE_ENV=production` ou `CI=true`, `POSTGRES_URL`/`DATABASE_URL` est obligatoire (échec immédiat sinon).
En local (hors CI/prod), fallback vers `postgres://postgres:postgres@localhost:5432/babymiam`.
Cette règle s'applique aussi au runtime serveur (`lib/db.ts`) et à `npm run users:create`.

Authentification session:
- `AUTH_SECRET` (ou `AUTH_SECRETS`) est requis par défaut.
- Le fallback dev est autorisé uniquement en local explicite avec `ALLOW_INSECURE_DEV_AUTH=1`.
- En `NODE_ENV=production` ou `CI=true`, aucun fallback secret n'est autorisé.

## Magic link test partagé
- Le lien cible le compte `PERSONAL_ACCESS_EMAIL` (compte normal, état partagé entre testeurs).
- Générer un lien one-click:
  ```bash
  npm run users:test-link:generate
  ```
- Révoquer le lien:
  ```bash
  npm run users:test-link:revoke
  ```
- `users:test-link:generate` affiche toujours le lien courant.
- Le token est dérivé de `shared_test_link_issued_at` (et non de `session_version`).
- Si le lien courant a moins de 31 jours, le même token est réutilisé.
- Si le lien courant est expiré (>31 jours), `shared_test_link_issued_at` est remis à `NOW()` et un nouveau token est généré.
- `users:test-link:revoke` invalide les liens existants et déconnecte les sessions actives.
- Le lien est valide 31 jours à partir de sa génération.
- Traiter ce lien comme un secret (ne pas le publier dans des canaux ouverts).

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
- `ALLOW_INSECURE_DEV_AUTH` (`0` par défaut, fallback local explicite uniquement)
- `POSTGRES_URL`
- `PERSONAL_ACCESS_EMAIL` (email du compte perso garanti; défaut local `ljcls@gmail.com`)
- `PERSONAL_ACCESS_PASSWORD` (mot de passe du compte perso garanti; requis)
- `APP_BASE_URL`
- `RESEND_API_KEY`
- `MAIL_FROM`
- `PASSWORD_RESET_TTL_MINUTES` (défaut `60`)
- `PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES` (défaut `30`)
- `PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS` (défaut `5`)
- `SHARE_SNAPSHOT_TTL_DAYS` (défaut `30`, durée de validité des nouveaux liens publics)
- `MAINTENANCE_MODE` (`true|false`)
- `TRUST_PROXY_IP_HEADERS` (`0` par défaut, `1` uniquement derrière un proxy de confiance)
- `TRUST_PROXY_IP_HEADER_HOPS` (défaut `1`, nombre de proxys de confiance à ignorer en partant de la droite)
- `AUTH_ATTEMPTS_RETENTION_DAYS` (défaut `90`, purge des tables `auth_*_attempts`)
- `AUTH_ATTEMPTS_PRUNE_INTERVAL_MINUTES` (défaut `60`, fréquence minimale de purge opportuniste)
- `PREMIUM_GATE_MODE` (`auto|on|off`)
- `PREMIUM_FEATURE_USER_IDS`
- `PREMIUM_FEATURE_USER_EMAILS`
- `PEDIATRIC_REPORT_PREMIUM_USER_IDS`
- `PEDIATRIC_REPORT_PREMIUM_USER_EMAILS`
- `ANTI_FORGET_RADAR_PREMIUM_USER_IDS`
- `ANTI_FORGET_RADAR_PREMIUM_USER_EMAILS`
- `ALLOW_MIGRATE_SKIP` (`1` pour autoriser explicitement un skip manuel de migration en local)
- `E2E_ALLOW_REMOTE_DB_RESET` (`1` pour autoriser un reset destructif E2E sur host non local)

## Tests E2E (Playwright)
Variables de test supportées:
- `E2E_POSTGRES_URL` (défaut: `postgres://postgres:postgres@localhost:5432/babymiam_e2e`)

Exécuter la suite:
```bash
npm run test:e2e
```

Le setup global E2E upsert ce compte en base avec `status='active'` et `email_verified_at` renseigné.

Par défaut, le reset destructif E2E est autorisé uniquement pour une base suffixée `_e2e`/`_test` sur host local (`localhost`, `127.0.0.1`, `::1`).
Pour forcer un host distant: `E2E_ALLOW_REMOTE_DB_RESET=1`.

## Garde-fous obligatoires
- `SKIP_DB_SETUP=1` bloque `npm run db:migrate` par défaut.
- Pour skip explicite en local: `ALLOW_MIGRATE_SKIP=1 SKIP_DB_SETUP=1 npm run db:migrate`.
- En prod/CI, demander un skip (`SKIP_DB_SETUP=1`) provoque un échec explicite pour migration, seed et sync allergènes.
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
   npm run db:seed
   ```
5. Vérifier le compte perso garanti:
   ```bash
   npm run db:assert-personal-access
   ```
6. Déployer le code applicatif.
- Le déploiement prod standard se lance avec `npm run deploy:prod` (`vercel deploy . --prod -y`).
- En build Vercel `preview` et `production`, le hook `postbuild` exécute automatiquement `users:test-link:generate`.
- En local, `npm run dev` tente aussi `users:test-link:generate` au démarrage (best-effort) avant `next dev`.
- Variables requises pour cette génération auto: `PERSONAL_ACCESS_EMAIL`, `AUTH_SECRET` (ou `AUTH_SECRETS`), `POSTGRES_URL` (ou `DATABASE_URL`).
- `APP_BASE_URL` reste recommandé; en Vercel il est inféré depuis `VERCEL_URL` s'il est absent.
- Le magic link courant (réutilisé ou régénéré si expiré) est affiché dans les logs de build Vercel à chaque déploiement.
- Un `.vercelignore` exclut les artefacts locaux (`.next*`, `playwright-report`, `test-results`, `coverage`, `tmp`, `.vercel`, `node_modules`).
- Gain mesuré sur le dernier déploiement: upload Vercel réduit de `120MB` à `328KB`.

## Migration avec changement de contrainte DB
Quand une migration ajoute/renforce une contrainte (ex: `NOT NULL`, `DEFAULT`, `CHECK`), appliquer cet ordre sans le simplifier:
1. Vérifier l'environnement DB ciblé:
   ```bash
   npm run db:preflight
   ```
2. Appliquer la migration:
   ```bash
   npm run db:migrate
   ```
3. Déployer l'application (`npm run deploy:prod` ou déploiement preview).
4. Lancer des smoke checks métier (ajout rapide, édition résumé, timeline).

Contrôles SQL post-migration recommandés:
```sql
SELECT COUNT(*) AS null_textures
FROM food_tastings
WHERE texture_level IS NULL;
```
Résultat attendu: `0`.

```sql
SELECT
  column_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'food_tastings'
  AND column_name = 'texture_level';
```
Résultat attendu: `is_nullable = 'NO'` et `column_default` contenant `1`.
