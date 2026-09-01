# AGENTS

## Projet

- Grrrignote est une application Next.js App Router de suivi de diversification alimentaire, multi-utilisateur.
- Le périmètre courant couvre le front (`app/`, `components/`), le serveur et les données (`lib/`), la base (`migrations/`, `scripts/db/`) et les tests Playwright (`tests/e2e/`).
- Éviter les refactors d'infrastructure, les changements hors sujet et l'ajout de secrets sans demande explicite.

## Navigation

- `app/AGENTS.md` : routes, handlers et server actions.
- `components/AGENTS.md` : UI, modales et conventions de rendu.
- `lib/AGENTS.md` : authentification, accès aux données et logique métier.
- `migrations/AGENTS.md` : évolution du schéma PostgreSQL.
- `scripts/AGENTS.md` : scripts DB, utilisateurs, développement et déploiement.
- `tests/e2e/AGENTS.md` : suite Playwright, fixtures et reset de DB.

## Vérification

Exécuter les contrôles proportionnés au changement :

```sh
npm run lint -- --max-warnings=0
npm exec tsc -- --noEmit
npm run test:users
npm run build
npm run test:e2e
```

La suite E2E réinitialise une base locale dédiée : ne jamais la lancer avec une URL de production ou une base partagée.

## Garde-fous opérationnels

- Avant une migration ou un seed sur l'environnement visé : exécuter `npm run db:preflight`.
- Ne jamais faire de reset destructif sur une base non locale. `db:setup` est réservé au local ; en production, enchaîner explicitement preflight, migration, seed si nécessaire, puis vérifications.
- Déployer en production uniquement avec `npm run deploy:prod`, après contrôle de l'état Git et de la branche à publier.
- Ne jamais exposer de secrets dans le code, les commits, la documentation ou les logs partagés.
- Toute nouvelle table mutable doit être intégrée au reset E2E décrit dans `tests/e2e/AGENTS.md`.

## Entretien de ces instructions

Garder les `AGENTS.md` courts et locaux : documenter des invariants durables, des points d'entrée et des risques concrets.

Les retours d'expérience qui demandent du contexte sont centralisés dans [`docs/engineering/lessons-learned.md`](docs/engineering/lessons-learned.md). Ne pas y verser un journal de session, des compteurs de lignes ou des recettes ponctuelles ; remonter dans l'`AGENTS.md` local concerné les invariants devenus actifs.
