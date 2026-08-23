# tests/e2e/

Cartographie operationnelle de la suite de tests Playwright pour grrrignote.

## Specs
* auth-and-guards.spec.ts (316L):
  Login, redirection des invites, magic-link, forgot-password throttling et validation des headers de securite.
* dashboard-progress.spec.ts (1063L):
  Recherche, ajout rapide, editeur degustation, Premiere bouchee, tri-state tigre, profil enfant, guide et timeline.
* food-summary.spec.ts (536L):
  Modal de resume, sauvegardes atomiques, rejet de payload invalide, cycle tigre et suppression/edition.
* custom-foods.spec.ts:
  Aliments personnalises (foods owner), anti-doublon avec gestion casse/accent/ligature, tri et permissions de suppression.
* pediatric-report.spec.ts:
  Telechargement du PDF, table des allergenes, gate premium avec statut 402 et redirection non-authentifie avec statut 307.
* profile-account.spec.ts:
  Modal du compte, validation du mot de passe et gestion d'erreur de la verification email.
* public-share.spec.ts (387L):
  Page de partage publique, rendu responsive, indicateurs KPI, graphiques et tracking d'ouverture du lien.
* db-degraded-mode.spec.ts:
  Smoke test de l'application en mode base de donnees degradee via l'URL E2E_DEGRADED_BASE_URL.
* food-meta.spec.ts:
  Editeur en mode note-only et persistance de la saisie utilisateur.
* profile-and-share.spec.ts:
  Sauvegarde du profil, generation, copie dans le presse-papiers et regeneration du lien public.

## Helpers & fixtures
* helpers/db.ts (956L):
  * E2E_RESETTABLE_TABLES: truncate de food_tastings, food_progress, child_profiles, growth_events, public_share_links, password_reset_tokens, auth_password_reset_attempts, email_verification_tokens, auth_login_attempts, auth_signup_attempts, foods, categories, users.
  * ensureTestDatabaseReady(): lance DROP/CREATE DATABASE de maniere destructive puis tente un fallback truncate.
  * resetMutableTables(): nettoie les tables mutables, supprime les aliments du catalogue specifique au user, efface les utilisateurs, remet a zero la sequence users_id_seq et cree le user E2E standard.
  * seedFixtureData(): charge de facon deterministe le catalogue de fixtures (categories et aliments).
* fixtures/test-fixtures.ts:
  Etend l'API Playwright avec le helper db, loginAsDefaultUser et appPage (gestion de l'auto-login, navigation vers la racine et attente de la page d'accueil).
  Inclut la fixture automatique resetDbBeforeEach executant db.resetMutableTables() avant chaque test.

## Setup global
* global.setup.ts:
  Enchaîne la sequence stricte:
  1. ensureTestDatabaseReady()
  2. applyMigrations()
  3. ensureAuthUser()
  4. seedFixtureData()
  5. resetMutableTables()
* global.teardown.ts:
  Ferme proprement le pool de connexions a la base SQL.
* Config (../../playwright.config.ts):
  * testDir configure sur ./tests/e2e/specs.
  * Orchestration via globalSetup et globalTeardown.
  * Projet unique Chromium, avec workers à 1 et parallelisme desactive (fullyParallel: false).
  * Web server lance par node scripts/e2e/web-server.js.
  * Variables surchargeables (avec defaut, entree optionnelle): E2E_BASE_URL (defaut http://127.0.0.1:3005), E2E_AUTH_EMAIL, E2E_AUTH_PASSWORD, E2E_AUTH_SECRET, E2E_POSTGRES_URL (defaut ...babymiam_e2e), E2E_REUSE_EXISTING_SERVER.
  * Injectees par la config dans webServer.env (pas des entrees requises): AUTH_SECRET (depuis E2E_AUTH_SECRET), LOCAL_POSTGRES_URL/POSTGRES_URL/DATABASE_URL, PERSONAL_ACCESS_EMAIL, APP_BASE_URL, PASSWORD_RESET_RATE_LIMIT_WINDOW_MINUTES=60, PASSWORD_RESET_RATE_LIMIT_MAX_ATTEMPTS=2, PREMIUM_GATE_MODE=on, PREMIUM_FEATURE_USER_EMAILS, RESEND_API_KEY='', MAIL_FROM='', SKIP_DB_SETUP=1, E2E_DIST_DIR=.next-e2e.

## Conventions
* Nouvelle table mutable: declaration obligatoire dans E2E_RESETTABLE_TABLES et dans resetMutableTables() pour eviter la pollution inter-tests.
* Mode premium: force a "on" en test avec PREMIUM_GATE_MODE=on et allowlist d'emails explicite pour des tests reproductibles.
* Catalogue: fixtures alignees sur le fichier produit aliments_categories.json (gestion precise des ligatures comme "Oeuf (bien cuit)").
* Filtres Playwright: le commutateur -g interprete une regex. Toujours verifier le nombre de tests lances et echapper les parentheses du filtre.

## Pieges / safety rails
* Securite de reset: DROP/CREATE autorise seulement si la base finit par _e2e ou _test sur localhost, sinon necessite E2E_ALLOW_REMOTE_DB_RESET=1.
* Production: interdiction totale d'adresser la base de production pour les tests E2E.
* Mode strict Playwright: un libelle partage (ex: note globale vs note aliment) fait planter le selecteur. Utiliser exact: true pour cibler.
* Serveur externe concurrent: un processus npm run dev deja ouvert peut etre reutilise via reuseExistingServer et fausser les resultats.
* Fichiers de build/rapport: ne jamais committer playwright-report/, test-results/ ou le dossier .next-e2e*.
* Assertions PDF (latin1): les parentheses sont modifiees dans le flux brut. Utiliser une regex echappee plutot qu'un match literal.
