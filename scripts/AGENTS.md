# scripts/

Documentation opérationnelle des scripts Node.js du dépôt.

## db/

- `_db-url.js` : Résout l'URL de connexion et l'environnement. Utilise le même ordre de priorité que `lib/db.ts`. Strict en production et CI. Pas de repli local en preflight.

- `preflight.js` : Verrouille l'accès en production ou CI. Exige une URL explicite de base de données. Refuse la variable `SKIP_DB_SETUP=1`. Exécute une requête `SELECT 1`.

- `migrate-runner.js` : Pilote `node-pg-migrate` pour appliquer, annuler ou créer des migrations. Bloque le contournement sauf si `ALLOW_MIGRATE_SKIP=1` en local.

- `seed.js` : Lit le fichier de structure `aliments_categories.json`. Upserte les catégories globales et aliments de base. Vérifie l'utilisateur de test. Injecte les données de démonstration déterministes. Charge ses dépendances lourdes en lazy au sein de `runSeed` avec une garde `require.main === module`.

- `seed.test.js` : Valide la sélection des aliments de démo et les comptes exacts. Vérifie les totaux de 45 lignes `food_progress`, 108 lignes `food_tastings` et la répartition stable par slots (45, 36, 27).

## users/

- `_shared-test-link.js` : Utilitaire commun de gestion du lien de connexion. Détermine la base d'URL, résout les secrets d'authentification, calcule l'expiration du jeton, cherche le compte cible et gère la session.

- `ensure-personal-access.js` : Configure le profil personnel de test canonique. Force l'état actif, vérifié et prêt.

- `assert-personal-access.js` : Contrôle de sécurité. Vérifie que le profil personnel existe, est actif, validé par e-mail et dispose de l'accès premium.

- `create-user.js` : Commande d'inscription générale en ligne de commande. Lit le mot de passe depuis l'entrée standard ou en argument. Rend la vérification d'adresse optionnelle.

- `test-link-generate.js` : Génère ou récupère le lien d'accès automatique. Se base sur `shared_test_link_issued_at` au lieu de `session_version`. Conserve le jeton actif s'il a moins de 31 jours. Crée une nouvelle date sinon. Affiche systématiquement le lien complet.

- `test-link-revoke.js` : Révoque l'accès immédiat. Incrémente `session_version` et réinitialise `shared_test_link_issued_at` à nul. Invalide ainsi les jetons générés et déconnecte les sessions existantes.

- `ensure-personal-access.test.js` : Validation unitaire de l'insertion et des mécanismes de contrôle de l'utilisateur personnel.

## e2e/ dev/ deploy/

- `scripts/e2e/web-server.js` : Enveloppe d'exécution pour le serveur de tests Playwright. Sauvegarde et rétablit les configurations `next-env.d.ts` et `tsconfig.json` durant la session de test pour préserver le plan de typage.

- `scripts/dev/dev-with-shared-link.js` : Pilote de la commande locale `npm run dev`. Essaye de générer le lien de test en tâche de fond avant Next. Charge lui-même l'environnement local `.env*`. Calcule l'URL de base depuis le port et l'hôte déclarés à l'exécution.

- `scripts/deploy/postbuild-production.js` : Crochet de post-compilation Vercel. Émet le lien magique uniquement sur les environnements de prévisualisation et production. Ignore silencieusement l'opération sur les autres branches.

## Conventions

- Code source écrit exclusivement en JavaScript natif pour Node.js.

- Tests automatisés colocalisés via l'extension `*.test.js` et exécutés avec le lanceur interne de Node `npm run test:users`.

- Gestion unifiée des informations de connexion déléguée entièrement à l'utilitaire `_db-url.js`.

- Utilisation de l'empreinte temporelle de création pour le jeton de test afin d'isoler ce flux des mécanismes de cycle de session.

## Pieges

- Le lien magique de test apparaît directement dans les traces de build Vercel. Considérez ces données comme des secrets et ne publiez jamais les logs de déploiement en clair.

- La création automatisée post-build nécessite l'accès à `PERSONAL_ACCESS_EMAIL`, au secret d'authentification global et à la chaîne de connexion de base de données.

- En cas de changement de port en local, transmettez les paramètres à l'appel pour éviter des incohérences d'URL sur le lien affiché.

- Pour rejouer le jeu de démo de manière stable, supprimez au préalable les entrées liées à l'utilisateur dans les tables `food_tastings`, `food_progress` et `foods` associées avant de lancer la réinjection.
