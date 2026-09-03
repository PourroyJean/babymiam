# scripts/

Scripts Node opérationnels du dépôt.

## Points d'entrée

- `db/preflight.js`, `db/migrate-runner.js`, `db/seed.js` et `db/query.js` servent à valider, migrer, peupler et inspecter PostgreSQL. `lib/database-url.js` centralise la résolution et la normalisation de l'URL DB : ne pas recopier cette logique.
- `users/` contient la création d'utilisateur, la vérification du compte personnel, l'attribution premium et les commandes de lien de test. Les mots de passe ne doivent pas être passés dans le code ni journalisés.
- `e2e/web-server.js` prépare le serveur Playwright et restaure les fichiers de configuration temporairement modifiés.
- `dev/dev-with-shared-link.js` lance le développement et tente de produire un lien de test ; `deploy/postbuild-production.js` le fait uniquement pour les builds Vercel preview/production.

## Règles d'exploitation

- Employer `npm run db:preflight` avant migration, seed ou requête visant un environnement non évident. `db:setup` est une commodité locale, pas un runbook de production.
- Pour la production, utiliser les scripts existants et `npm run deploy:prod`; ne jamais contourner la résolution DB ou afficher de variables d'environnement.
- Le lien de test est une capacité sensible : sa génération requiert le compte personnel, les secrets d'authentification et la DB. Les logs de build qui le contiennent ne sont pas publics.
- Les tests unitaires de scripts sont des fichiers `*.test.js`, exécutés par `npm run test:users`.

## Seed

Le seed lit `aliments_categories.json`, conserve le catalogue global et injecte des données de démonstration rejouables. Toute modification du catalogue doit aussi vérifier l'alignement des fixtures E2E.
