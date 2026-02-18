Parfait, si tu assumes une **remise à zéro totale de la DB** (y compris prod), le plan devient plus simple et plus propre.

**Plan de migration (reset total, sans legacy)**

1. **Adopter `node-pg-migrate` comme unique moteur de schéma**  
Dans `/Users/jean/Documents/CODE/babymiam/package.json`, remplacer la logique actuelle par:
- `db:migrate`: `node-pg-migrate up --migration-file-language sql --migrations-dir migrations --database-url-var POSTGRES_URL`
- `db:migrate:create`: `node-pg-migrate create --migration-file-language sql --migrations-dir migrations`
- `db:migrate:down` (optionnel en dev)

2. **Créer une migration initiale unique et propre**  
Créer `/Users/jean/Documents/CODE/babymiam/migrations/<timestamp>_init_schema.sql` avec:
- `-- Up Migration`:
  - `CREATE EXTENSION citext`
  - `CREATE TYPE event_visibility`
  - création de toutes les tables actuelles (`users`, `categories`, `foods`, `food_progress`, `food_tastings`, `child_profiles`, `growth_events`, `share_snapshots`, `password_reset_tokens`, `auth_login_attempts`, `auth_signup_attempts`, `email_verification_tokens`)
  - tous les index utiles
- `-- Down Migration`:
  - `DROP TABLE ...` en ordre inverse
  - `DROP TYPE event_visibility`
  - éventuellement `DROP EXTENSION citext`

3. **Éliminer le legacy et les hacks de compat**  
Supprimer de l’init:
- les blocs `DO $$` de compatibilité `owner_key`
- les `DROP TABLE` destructifs de l’ancien script
- le besoin de `/Users/jean/Documents/CODE/babymiam/scripts/users/migrate-legacy.js` pour le run standard

4. **Décommissionner l’ancien monolithe SQL**
- Retirer l’usage de `/Users/jean/Documents/CODE/babymiam/scripts/db/migrate.sql`
- Retirer ou simplifier `/Users/jean/Documents/CODE/babymiam/scripts/db/migrate.js` (idéalement plus utilisé)

5. **Garder seed/sync séparés (bon choix)**
- Conserver `/Users/jean/Documents/CODE/babymiam/scripts/db/seed.js`
- Conserver `/Users/jean/Documents/CODE/babymiam/scripts/db/sync-allergens.js`
- Workflow: `db:migrate` puis `db:sync-allergens` puis `db:seed`

6. **Adapter les tests E2E**
Dans `/Users/jean/Documents/CODE/babymiam/tests/e2e/helpers/db.ts`, remplacer la lecture directe de `migrate.sql` par l’exécution de `node-pg-migrate up` sur `E2E_POSTGRES_URL`.

7. **Runbook prod “clean start”**
- Créer une DB prod neuve
- Configurer `POSTGRES_URL`
- Exécuter: `npm run db:migrate`, `npm run db:sync-allergens`, `npm run db:seed`
- Créer le compte admin via `/Users/jean/Documents/CODE/babymiam/scripts/users/create-user.js`
- Déployer l’app

8. **Règle d’équipe ensuite**
- Toute évolution DB = nouvelle migration SQL dans `migrations/`
- Ne jamais modifier une migration déjà appliquée
- Une migration = un changement logique clair

Si tu veux, je peux enchaîner et te préparer directement le commit technique (scripts `package.json`, init migration SQL, adaptation E2E, README).