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

## Session Lessons (2026-02-19)
- Lessons learned:
  - Un test Playwright peut echouer en mode strict si plusieurs champs partagent un label "Note"; pour la note globale, cibler avec `exact: true`.
  - Lorsqu'une nouvelle table mutable est ajoutee (ex: `auth_password_reset_attempts`), il faut l'ajouter aux deux resets E2E dans `tests/e2e/helpers/db.ts` (`E2E_RESETTABLE_TABLES` et `resetMutableTables`).
  - La validation de date cote serveur reste stable en envoyant `tzOffsetMinutes` depuis les formulaires clients qui soumettent des dates.
- Reliable commands:
  - `npm run lint -- --max-warnings=0`
  - `npx tsc --noEmit`
  - `npm run test:e2e`
  - `npm run build`
  - `node -e "process.env.NODE_ENV='production'; import('./next.config.mjs')..."`
- Safety rails / do-not-do:
  - Ne pas depender d'un bind reseau en sandbox pour verifier la CSP si `npm start` echoue avec `EPERM`; utiliser l'inspection de `next.config.mjs` en fallback.
  - Ne pas casser la non-enumeration du flux forgot-password: conserver la meme sortie utilisateur pour succes, rate-limit et erreurs internes.
  - Ne pas oublier de propager les nouvelles tables auth aux routines de reset E2E pour eviter la pollution inter-tests.

## Session Lessons (2026-02-20)
- Lessons learned:
  - Pour une texture "aucune", conserver le modele metier `textureLevel = null` et centraliser le chemin d'icone dans une constante partagee (`TEXTURE_NONE_ICON_SRC`) dans `lib/tasting-metadata.ts`.
  - Le remplacement du fallback visuel `ø` par une image doit etre applique dans les deux surfaces: timeline (`components/timeline-panel.tsx`) et controle texture partage (`components/texture-segmented-control.tsx`).
  - Lors du retrait de `ø`, supprimer aussi les classes CSS obsoletes desktop + mobile (`.food-timeline-meta-chip-empty`, `.texture-segmented-empty-label`) pour eviter les styles morts.
  - Si une WebP convertie parait incorrecte, verifier d'abord le PNG source: la conversion peut etre correcte mais l'asset d'origine etre deja noir/plat.
  - Le flux de verification email doit consommer le token via action explicite `POST` (et non en `GET`) pour eviter la consommation involontaire par des prefetch/scanners.
- Reliable commands:
  - `cwebp -q 80 public/images/legacy/png/texture_0_aucune.png -o public/images/textures/texture-0-aucune.webp`
  - `sips -g pixelWidth -g pixelHeight public/images/textures/texture-0-aucune.webp`
  - `npm run test:e2e -- tests/e2e/specs/food-summary.spec.ts`
  - `npm run test:e2e -- tests/e2e/specs/dashboard-progress.spec.ts`
  - `npm run test:e2e -- tests/e2e/specs/auth-and-guards.spec.ts tests/e2e/specs/profile-account.spec.ts`
- Safety rails / do-not-do:
  - En E2E, eviter les selecteurs dependants d'un etat variable (ex: slot exact sur un aliment potentiellement deja teste); preferer un flow stable (ex: "Premiere bouchee" sur aliment vide) pour ouvrir l'editeur.
  - En scope "icones seulement", ne pas modifier les libelles textuels de formulaire (ex: "Texture non renseignee" dans le resume aliment).
  - En E2E local, ne pas laisser un serveur `npm run dev` externe avec un env different: Playwright peut le reutiliser (`reuseExistingServer`) et produire des resultats trompeurs.

## Session Lessons (2026-02-24)
- Lessons learned:
  - Pour aligner des colonnes dans un PDF texte, il faut une police monospaced (ex: `Courier`); des largeurs fixes ne suffisent pas avec `Helvetica`.
  - Le rendu monospaced base sur la presence de `|` cree des faux positifs (ex: ligne symptomes); utiliser un marqueur explicite (ex: `[[MONO]]`) pour les seules lignes tabulaires.
  - Le gate premium du rapport PDF doit etre force en E2E (`PREMIUM_GATE_MODE=on`) avec allowlist explicite (`PEDIATRIC_REPORT_PREMIUM_USER_EMAILS`) pour garder des tests deterministes.
  - Le endpoint `/api/pediatric-report` doit etre couvert aussi sur les chemins negatifs: user authentifie non premium -> `402`, non-auth -> redirection `307` vers `/login`.
- Reliable commands:
  - `npm run lint -- --max-warnings=0`
  - `npm exec tsc -- --noEmit`
  - `npm run build`
  - `npm run test:e2e -- tests/e2e/specs/pediatric-report.spec.ts`
  - `set -a; [ -f .env.local ] && source .env.local; [ -f .env.development.local ] && source .env.development.local; npm run db:preflight`
- Safety rails / do-not-do:
  - Ne pas conclure a un probleme DB distant sur un `db:preflight` en sandbox sans verifier d'abord la connectivite reseau du contexte d'execution.
  - Ne pas laisser des heuristiques implicites de style PDF (ex: detection via `|`) en prod; preferer des marqueurs explicites pour eviter des regressions visuelles silencieuses.
  - Ne pas valider la feature PDF uniquement sur le rendu `200`: verifier aussi les statuts `402` et `307` pour verrouiller auth/authz.

## Session Lessons (2026-02-25)
- Lessons learned:
  - Vercel CLI injecte `.env.development.local` qui ecrase `.env.local`. Pour forcer la priorite de la DB locale sans manipuler les fichiers, introduire une variable `LOCAL_POSTGRES_URL` prioritaire dans la resolution de connexion hors contexte de production (`isStrictRuntime`).
  - Si Resend est configure sur un sous-domaine d'envoi (ex: `noreply.grrrignote.fr`), le DKIM se valide sur `resend._domainkey.noreply.grrrignote.fr` (et non sur l'apex).
  - `vercel env list` confirme la presence/scope des variables, mais pour verifier leur valeur effective en production il faut `vercel env pull` vers un fichier temporaire puis inspecter localement.
- Reliable commands:
  - `dig TXT resend._domainkey.noreply.grrrignote.fr +short` (validation DKIM Resend du sous-domaine d'envoi)
  - `dig TXT _dmarc.grrrignote.fr +short`
  - `vercel env list`
  - `vercel env pull /tmp/babymiam.env.production --environment production --yes`
  - `npx tsx --env-file=.env.local <script.ts>` (executer un script TS avec env local sans dependre de dotenv)
- Safety rails / do-not-do:
  - Ne pas renommer ou supprimer manuellement `.env.development.local` a chaque fois pour utiliser la base locale; implementer une priorite programmatique (via `LOCAL_POSTGRES_URL`).
  - Ne pas conclure a un DNS/certificat casse sur un `dig`/`curl` echoue en sandbox (`Operation not permitted`, `Could not resolve host`) sans re-test en mode escalade.
  - Ne pas passer une cle API en argument CLI ou en dur; pour `vercel env add`, preferer un pipe depuis variable/fichier temporaire puis supprimer le fichier temporaire.

## Session Lessons (2026-02-26)
- Lessons learned:
  - Dans `tests/e2e/specs/custom-foods.spec.ts`, la fermeture de la modale d'ajout ne suffit pas; pour eliminer la flake post-ajout, attendre explicitement la visibilite de `Ouvrir le resume de <aliment>` dans la categorie cible.
  - Pour `appendQuickEntry`, cacher l'introspection `information_schema.columns` en process-global (cache + promesse in-flight + TTL) evite une requete schema a chaque action rapide.
  - Avec ce cache schema, gerer `code 42703` (`undefined_column`) en invalidant le cache puis en retentant une seule fois garde la compatibilite en cas de drift.
  - Unifier l'entitlement premium dans `lib/premium-entitlement-core.{js,d.ts}` puis le reutiliser depuis `lib/premium-features.ts` et `scripts/users/assert-personal-access.js` evite les divergences app/script.
  - La suppression de `scripts/users/bootstrap-user.js` est sure apres cleanup des references `DB_SETUP_BOOTSTRAP*` et des aliases env legacy (`AUTH_*`, `LEGACY_ADMIN_*`).
- Reliable commands:
  - `npm run lint -- --max-warnings=0`
  - `npm exec tsc -- --noEmit`
  - `npm run test:users`
  - `npm run test:e2e -- tests/e2e/specs/custom-foods.spec.ts --repeat-each=3`
  - `npm run test:e2e -- tests/e2e/specs/pediatric-report.spec.ts`
- Safety rails / do-not-do:
  - Ne pas considerer la fermeture de modale comme signal de stabilite E2E apres un ajout; attendre un selecteur metier visible dans la grille.
  - Ne pas dupliquer la logique premium (allowlists, gate mode, fallback perso) entre runtime et scripts; passer par le core partage unique.
  - Ne pas reintroduire `DB_SETUP_BOOTSTRAP*`, `AUTH_*` ou `LEGACY_ADMIN_*`; verifier par grep avant merge.
