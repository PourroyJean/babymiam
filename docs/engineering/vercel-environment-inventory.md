# Inventaire des variables Vercel

Inventaire établi le 3 septembre 2026 à partir de la configuration Vercel. Les valeurs ne sont volontairement pas consignées ici. **Aucune variable Vercel n'a été supprimée dans ce chantier.** Avant toute suppression, valider les intégrations Vercel/Neon qui pourraient les consommer.

## À conserver

| Variable | Environnements constatés | Consommateur | Décision |
| --- | --- | --- |
| `POSTGRES_URL` | Production, Preview, Development | Runtime et scripts PostgreSQL | Conserver |
| `DATABASE_URL` | Production, Preview, Development | Fallback compatible du runtime et des scripts | Conserver |
| `AUTH_SECRET` | Production, Preview, Development | Authentification et jetons | Conserver |
| `APP_BASE_URL` | Production | Liens et URLs applicatives | Conserver |
| `PERSONAL_ACCESS_EMAIL` | Production, Preview | Compte personnel et lien de test | Conserver |
| `PERSONAL_ACCESS_PASSWORD` | Production, Preview | Compte personnel et lien de test | Conserver |
| `RESEND_API_KEY` | Production | Envoi d'e-mail | Conserver |
| `MAIL_FROM` | Production | Expéditeur e-mail | Conserver |
| `PREMIUM_FEATURE_USER_EMAILS` | Production | Gating premium unifié | Conserver |

## Sans consommateur applicatif identifié

| Variables | Environnements constatés | Recommandation |
| --- | --- | --- |
| `AUTH_USER`, `AUTH_PASSWORD` | Preview | Obsolètes : le bootstrap n'accepte plus ce couple. Valider puis supprimer manuellement. |
| `DATABASE_URL_UNPOOLED` | Production, Preview, Development | Vérifier une intégration Neon/Vercel, puis retirer si inutilisée. |
| `NEON_AUTH_BASE_URL`, `NEON_PROJECT_ID` | Production, Preview, Development | Vérifier une intégration Neon/Vercel, puis retirer si inutilisée. |
| `PGDATABASE`, `PGHOST`, `PGHOST_UNPOOLED`, `PGPASSWORD`, `PGUSER` | Production, Preview, Development | Variables injectées Neon/Vercel ; non lues par l'application. Vérifier l'intégration avant retrait. |
| `POSTGRES_DATABASE`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NO_SSL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER` | Production, Preview, Development | Variables injectées Neon/Vercel ; non lues par l'application. Vérifier l'intégration avant retrait. |
| `VITE_NEON_AUTH_URL` | Production, Preview, Development | Aucun consommateur dans cette application Next.js ; vérifier l'intégration avant retrait. |

## À investiguer

| Variables | Environnements constatés | Motif |
| --- | --- | --- |
| `WEEKLY_DISCOVERY_PLAN_PREMIUM_USER_EMAILS` | Production | Aucun consommateur trouvé ; semble remplacée par `PREMIUM_FEATURE_USER_EMAILS`. |
| `PEDIATRIC_REPORT_PREMIUM_USER_EMAILS` | Production | Aucun consommateur trouvé ; semble remplacée par `PREMIUM_FEATURE_USER_EMAILS`. |

La suppression éventuelle doit être effectuée dans Vercel après validation fonctionnelle et vérification des intégrations, jamais en copiant des valeurs dans le dépôt.
