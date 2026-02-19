# Plan de déploiement Grrrignote sur Vercel + Neon

## 1. Objectif
Déployer l'application Next.js multi-user sur Vercel avec Neon/Postgres, avec un runbook explicite pour les migrations et un mode maintenance pendant la bascule.

## 2. État actuel
- App hébergée sur Vercel.
- Base Neon liée au projet Vercel.
- Variables DB (`POSTGRES_URL`, `DATABASE_URL`, etc.) configurées.
- Auth multi-user (table `users`, mot de passe hashé, session signée).
- Build applicatif découplé des migrations DB.

## 3. Décisions techniques retenues
- Hébergement: Vercel.
- Base de données: Neon (Postgres).
- Connexion DB: `pg` avec pool borné.
- Migrations: `node-pg-migrate` en SQL pur (dossier `migrations/`).
- Runner migration: `scripts/db/migrate-runner.js`.
- Préflight DB: `scripts/db/preflight.js` (`npm run db:preflight`).
- Chargement env migration: `POSTGRES_URL` puis `DATABASE_URL`.
- En prod/CI: URL DB obligatoire (pas de fallback local).
- Mode maintenance: variable `MAINTENANCE_MODE=true` pilotée via Vercel env.

## 4. Runbook migration prod (downtime accepté)
1. Activer `MAINTENANCE_MODE=true`.
2. Exécuter `npm run db:preflight` sur la base Neon cible.
3. Exécuter `npm run db:migrate` sur la base Neon cible.
4. Exécuter `npm run db:sync-allergens` sur la base Neon cible.
5. Exécuter `npm run db:seed` sur la base Neon cible.
6. Créer l'utilisateur initial (`npm run users:create -- --email <email> --password "<password>"`).
7. Déployer le code applicatif.
8. Désactiver `MAINTENANCE_MODE`.

## 5. Checklist release
- Vérifier `AUTH_SECRET` (ou `AUTH_SECRETS`) dans Vercel.
- Vérifier `RESEND_API_KEY`, `MAIL_FROM`, `APP_BASE_URL`.
- Vérifier `POSTGRES_URL` / `DATABASE_URL`.
- Vérifier `SKIP_DB_SETUP` absent (ou différent de `1`).
- Exécuter `npm run build` en local.
- Valider preview (login, write path, partage public, reset password).
- Déployer production.
- Contrôler les logs Vercel et Neon après mise en ligne.

## 6. Risques principaux et mitigations
- Échec migration DB:
  - mitigation: maintenance mode + backup Neon avant exécution.
- Erreur sur secrets mail/auth:
  - mitigation: checklist release systématique.

## 7. Definition of Done
- Production active sur Vercel.
- Schéma multi-user en place (`owner_id` partout où requis).
- Sessions/signatures et reset password opérationnels.
- Runbook maintenance documenté et testable.
