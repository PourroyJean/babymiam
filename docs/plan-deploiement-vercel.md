# Plan de déploiement Grrrignote sur Vercel + Vercel SQL

## 1. Objectif
Déployer et exploiter l'application Next.js sur Vercel avec Vercel SQL (Neon/Postgres), avec une base reproductible, des secrets robustes et un runbook opérationnel simple.

## 2. État actuel
- App déployée en production sur Vercel (domaine Grrrignote).
- Base Neon liée au projet Vercel.
- Variables DB (`POSTGRES_URL`, `DATABASE_URL`, etc.) configurées.
- Variables auth (`AUTH_USER`, `AUTH_PASSWORD`, `AUTH_SECRET`) configurées.
- Schéma + seed sortis du runtime et gérés par scripts (`scripts/db/*`).
- Build exécute migration + seed avant `next build`.

## 3. Décisions techniques retenues
- Hébergement: Vercel.
- Base de données: une seule base Neon partagée entre Development, Preview et Production.
- Connexion DB: `pg` avec pool borné dans l'app.
- Migrations: script SQL versionné exécuté au build.
- Seed: script idempotent à partir de `aliments_categories.json`.
- Sauvegarde: stratégie manuelle simple (hebdomadaire + avant chaque release prod).

## 4. Plan de travail détaillé

### Phase A - Préparation Vercel
Statut: fait.

### Phase B - Provisioning Vercel SQL
Statut: fait.

### Phase C - Refonte DB (runtime -> scripts)
Statut: fait.

### Phase D - Gestion des données
Statut: fait (stratégie retenue: base recréée depuis seed, sans migration legacy).

### Phase E - Secrets et sécurité
Statut: fait.

### Phase F - Validation Preview puis Production
Statut: fait (preview et production déployées, tests fonctionnels validés).

### Phase G - Exploitation
Statut: fait.

## 5. Procédure de migration future
1. Modifier le schéma dans `scripts/db/migrate.sql`.
2. Vérifier localement:
   - `npm run db:setup`
   - `npm run build`
3. Déployer en preview et valider les parcours critiques (login, lecture, écriture, date).
4. Déployer en production.
5. Surveiller les logs Vercel après release.

## 6. Backup/Restore (simple hebdo)
### Backup
1. Une fois par semaine: créer un backup/snapshot manuel dans Neon Dashboard (nom daté).
2. Avant chaque déploiement production: créer un backup manuel supplémentaire.

### Restore
1. Restaurer vers une nouvelle branche/base Neon depuis le backup choisi.
2. Mettre à jour sur Vercel les variables DB (`POSTGRES_URL` et `DATABASE_URL`) vers la cible restaurée.
3. Redéployer l'application.
4. Vérifier login, lecture dashboard et écriture d'une donnée test.

## 7. Checklist release
- Vérifier `AUTH_USER`, `AUTH_PASSWORD`, `AUTH_SECRET` dans Vercel.
- Exécuter `npm run build` en local.
- Valider preview (login + écriture + date sans décalage).
- Déployer production.
- Contrôler les logs Vercel après mise en ligne.

## 8. Risques principaux et mitigations
- Saturation connexions DB:
  - mitigation: pool borné (`max`, `idleTimeoutMillis`, `connectionTimeoutMillis`).
- Échec migration au build:
  - mitigation: build bloque la release, rollback via redéploiement précédent.
- Erreur humaine sur secrets:
  - mitigation: checklist release systématique.
- Décalage date/timezone:
  - mitigation: test explicite de `first_tasted_on` en preview avant prod.

## 9. Checklist exécutable
- [x] Projet Vercel créé et connecté au repo
- [x] Base Vercel SQL créée et liée
- [x] Variables DB valides en Preview + Production
- [x] Stratégie connexions choisie (`pg` borné)
- [x] Scripts migration + seed versionnés
- [x] Script build exécutant migration + seed avant `next build`
- [x] Secrets `AUTH_*` configurés
- [x] Déploiement Preview validé (smoke tests + timezone)
- [x] Déploiement Production validé
- [x] Procédure rollback documentée

## 10. Definition of Done
- Production active sur Vercel.
- Schéma et seed reproductibles via scripts versionnés.
- App fonctionnelle avec persistance Neon.
- Procédure d'exploitation et rollback documentée.
