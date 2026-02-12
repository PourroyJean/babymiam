# Plan de déploiement Babymiam sur Vercel + Vercel SQL

## 1. Objectif
Déployer l'application Next.js sur Vercel avec Vercel SQL (Postgres/Neon), en garantissant stabilité des connexions, migrations reproductibles et sécurité des secrets.

## 2. État actuel (constaté dans le repo)
- App Next.js 14 (App Router) avec `pg`.
- Initialisation schéma + seed au runtime dans `lib/data.ts` (`ensureDatabaseReady()`).
- Seed source: `aliments_categories.json`.
- Auth via `AUTH_USER`, `AUTH_PASSWORD`, `AUTH_SECRET`.
- `.env.local` est déjà ignoré par Git.

## 3. Décisions techniques retenues
- Hébergement: Vercel (Preview puis Production).
- Base: Vercel SQL liée au projet.
- Connexions DB:
  - option cible recommandée: migrer vers `@vercel/postgres`,
  - si maintien temporaire de `pg`: pool borné (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`) et endpoint poolé Vercel SQL.
- Migrations:
  - sortir complètement la création du schéma du runtime,
  - exécuter les migrations dans le build (`node scripts/db/migrate.js && next build`).
- Seed:
  - seed idempotent via script versionné,
  - stratégie par défaut: base neuve + seed (pas de `pg_dump`), sauf besoin explicite de reprendre des données locales.

## 4. Plan de travail détaillé

### Phase A - Préparation Vercel
1. Importer le repo dans Vercel.
2. Vérifier les settings:
   - Install: `npm install` (ou `npm ci`)
   - Build: `npm run build`
   - Framework: Next.js
3. Connecter `main` à Production et les branches de travail à Preview.

### Phase B - Provisioning Vercel SQL
1. Créer et lier une base Vercel SQL au projet.
2. Vérifier les variables DB injectées par l'intégration.
3. Séparer Preview et Production (bases ou environnements clairement isolés).

### Phase C - Refonte DB (runtime -> scripts)
1. Créer `scripts/db/migrate.js` (ou `.ts`) pour le schéma.
2. Créer `scripts/db/seed.ts` idempotent depuis `aliments_categories.json`.
3. Mettre à jour `package.json`:
   - `build`: `node scripts/db/migrate.js && next build`
4. Réduire `ensureDatabaseReady()` à un check minimal ou le supprimer en production.
5. Ajouter une protection anti-exécution concurrente des migrations (lock table/migration table).

### Phase D - Gestion des données
1. Cas par défaut (recommandé): démarrer sur base propre avec migration + seed.
2. Cas exceptionnel (données locales critiques): planifier une migration ciblée des données utiles.
3. Éviter `pg_dump` complet sauf nécessité forte (risques de rôles/permissions entre environnements).

### Phase E - Secrets et sécurité
1. Configurer sur Vercel:
   - `AUTH_USER`
   - `AUTH_PASSWORD`
   - `AUTH_SECRET` distinct par environnement
2. Générer `AUTH_SECRET` fort (exemple):
   - `openssl rand -base64 32`
3. Conserver les fallbacks uniquement en dev local.
4. Vérifier la politique cookie en production HTTPS.

### Phase F - Validation Preview puis Production
1. Déployer en Preview.
2. Vérifier:
   - login/logout,
   - lecture dashboard,
   - écriture exposition/préférence/date/note,
   - persistance après reload.
3. Vérifier timezone/date:
   - test d'écriture/lecture de `first_tasted_on`,
   - confirmer absence de décalage de jour entre local et Vercel (UTC).
4. Vérifier logs build/runtime (migrations, pool, erreurs SQL).
5. Promouvoir en Production.

### Phase G - Exploitation
1. Documenter la procédure de migration future.
2. Définir une stratégie de backup/restore.
3. Ajouter une checklist de release (DB, secrets, smoke tests, timezone).

## 5. Risques principaux et mitigations
- Saturation connexions (serverless + pool mal configuré):
  - mitigation: `@vercel/postgres` ou pool `pg` borné + endpoint poolé.
- Migration échouée au build:
  - mitigation: considéré comme garde-fou; rollback via redéploiement version stable.
- Pollution Preview/Prod:
  - mitigation: isolation stricte des environnements DB.
- Décalage de date lié au fuseau UTC:
  - mitigation: tests dédiés sur `DATE` et validations manuelles cross-env.

## 6. Checklist exécutable
- [ ] Projet Vercel créé et connecté au repo
- [ ] Base Vercel SQL créée et liée
- [ ] Variables DB valides en Preview + Production
- [ ] Stratégie connexions choisie (`@vercel/postgres` ou `pg` borné)
- [ ] Scripts migration + seed versionnés
- [ ] Script build exécutant `migrate` avant `next build`
- [ ] Secrets `AUTH_*` configurés (secret fort par environnement)
- [ ] Déploiement Preview validé (smoke tests + timezone)
- [ ] Déploiement Production validé
- [ ] Procédure rollback documentée

## 7. Découpage en tickets
1. Ticket 1: Setup Vercel projet + environnements
2. Ticket 2: Setup Vercel SQL + isolation Preview/Prod
3. Ticket 3: Refonte DB (migrate/seed + build hook)
4. Ticket 4: Optimisation connexions (`@vercel/postgres` ou pool `pg`)
5. Ticket 5: Validation preview (fonctionnel + timezone) puis prod
6. Ticket 6: Documentation exploitation/rollback

## 8. Definition of Done
- Déploiement production actif sur Vercel.
- Aucune dépendance à l'init DB runtime.
- Schéma et seed reproductibles par scripts versionnés.
- Connexions DB stables sans saturation de quota.
- Secrets production configurés et testés.
- Aucun décalage de date constaté sur les cas métier.
