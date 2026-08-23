# migrations/

Suivi de l'evolution et de la structure de la base de donnees PostgreSQL.

## Convention de fichier

- Format: `{timestamp}_{nom-kebab}.sql` avec `-- Up Migration` et `-- Down Migration`.
- Creation: `npm run db:migrate:new -- nom_explicite`.
- Runner: node-pg-migrate lance via `scripts/db/migrate-runner.js` vers `/migrations`.
- Approche: majoritairement additif, rollbacks limites ou destructifs.

## Schema (tables cles)

- `users`: comptes utilisateurs et preferences.
- `foods` et `categories`: catalogue d'aliments et taxonomie.
- `food_progress` et `food_tastings`: progression, statut, notes et textures des tests.
- `child_profiles` et `growth_events`: profil des bebes et courbe de croissance.
- `public_share_links` et `auth_password_reset_attempts`: partage public et audit securite.

## Historique / migrations sensibles

- `1700000000000_init-schema.sql`: structure initiale, enums, indexes, tables de jetons.
- `1771512617383_backfill-food-progress-columns.sql`: peuplement de exposure_count et first_tasted_on.
- `1772000000000_add-password-reset-attempts.sql`: table de limitation des essais de mot de passe.
- `1772600000000_add-food-owner-scope.sql`: ajout de foods.owner_id pour gerer les aliments prives.
- `1772700000000_add-food-normalized-name.sql`: foods.normalized_name pour eviter les doublons.
- `1772800000000_add-shared-test-link-issued-at.sql`: users.shared_test_link_issued_at pour le lien de test.
- `1772900000000_enforce-texture-level-not-null.sql`: migration de donnees, texture_level NOT NULL.
- `1773000000000_allow-null-liked.sql`: rend food_tastings.liked nullable pour le tri-state indecis.
- `1773100000000_add-public-share-links.sql`: table pour le partage public de la timeline.
- `1773200000000_drop-share-snapshots.sql`: suppression des anciens instantanes de partage.
- `1773300000000_merge-ligature-food-duplicates.sql`: DESTRUCTIF. Fusion des ligatures (oe), repointage.

## Pieges

- Ajout de contrainte (NOT NULL/DEFAULT/CHECK): ordre strict db:preflight -> db:migrate -> deploiement -> tests.
- Migration destructive: ne pas simplifier, verifier la preservation des relations.
- Nouvelle table mutable: ajouter obligatoirement a `E2E_RESETTABLE_TABLES` dans `tests/e2e/helpers/db.ts`.
- Tri-state liked: valeur boolean | null sans coercition Boolean() pour garder l'etat indecis.
