# migrations/

Migrations PostgreSQL appliquées par `scripts/db/migrate-runner.js`.

## Règles

- Créer une migration avec `npm run db:migrate:new -- nom_explicite`. Conserver le format `{timestamp}_{nom-kebab}.sql` et les sections `-- Up Migration` / `-- Down Migration`.
- Une migration déjà appliquée est immuable : créer une nouvelle migration corrective.
- Privilégier les changements additifs et déployer les ruptures en plusieurs étapes compatibles (schéma, application, nettoyage). Les down migrations peuvent être limitées ou destructives.
- Avant toute exécution sur un environnement cible : `npm run db:preflight`, puis `npm run db:migrate`.

## Schéma à connaître

- Comptes : `users` et tables de jetons/rate-limit `auth_*`.
- Catalogue et suivi : `categories`, `foods`, `food_progress`, `food_tastings`.
- Profil : `child_profiles`, `growth_events`.
- Partage : `public_share_links`.

## Garde-fous

- Pour une contrainte, un backfill, une fusion ou une suppression, vérifier les données existantes et les relations avant de modifier le schéma.
- `foods.owner_id` protège les aliments privés ; préserver les contraintes et index associés.
- `food_tastings.liked` est nullable (tri-état) et `texture_level` est obligatoire.
- Une nouvelle table mutable doit être ajoutée aux deux chemins de reset dans `tests/e2e/helpers/db.ts`.
