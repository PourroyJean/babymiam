# AGENTS

## 1) Objectif du repo et perimetre
- Application Next.js (App Router) pour suivi de diversification alimentaire bebe, en mode multi-user.
- Perimetre principal: front (`app/`, `components/`), logique serveur et data (`lib/`), DB et migrations (`migrations/`, `scripts/db/`), e2e (`tests/e2e/`).
- Hors perimetre par defaut: refactor infra large, changements non lies a la tache, ajout de secrets/tokens.

## 2) Conventions de travail utiles
- Commandes quotidiennes:
  - `npm run dev`
  - `npm run lint -- --max-warnings=0`
  - `npm exec tsc -- --noEmit`
  - `npm run build`
  - `npm run test:e2e`
- Commandes DB:
  - `npm run db:preflight`
  - `npm run db:migrate`
  - `npm run db:sync-allergens`
  - `npm run db:seed`
  - `npm run db:setup`
- Deploiement:
  - `npm run deploy:prod` (wrapper prod Vercel)
- Dossiers cles:
  - `app/`: routes/pages/actions server
  - `components/`: UI et interactions
  - `lib/`: auth, DB, data access, utilitaires
  - `migrations/`: migrations SQL (node-pg-migrate)
  - `scripts/db/`, `scripts/e2e/`, `scripts/users/`: scripts operatifs
  - `tests/e2e/`: couverture Playwright

## 3) Safety rails / do-not-do (db/e2e/deploy)
- DB:
  - Ne jamais executer de reset destructif sur une DB non locale.
  - Ne pas utiliser `SKIP_DB_SETUP=1` en prod/CI.
  - Faire `npm run db:preflight` avant migrations/seed en environnement cible.
- E2E:
  - Ne pas pointer les tests e2e vers la DB de prod.
  - Ne pas committer artefacts de test/build (`playwright-report`, `test-results`, `.next-e2e*`).
- Deploy:
  - Deployer prod via `npm run deploy:prod` pour appliquer le contexte Vercel attendu.
  - Verifier que la branche cible est poussee et que l'etat Git est intentionnel avant prod.
  - Ne jamais exposer de secrets dans code, commits, logs ou docs.

## 4) Session Lessons (YYYY-MM-DD)
- Contexte:
  - 
- Changements:
  - 
- Problemes rencontres:
  - 
- Suivis / next actions:
  - 
- Commandes executees:
  - 
