# Grrrignote

Application Next.js de suivi de la diversification alimentaire, multi-utilisateur.

## Démarrage local

```sh
cp .env.example .env.local
docker compose up -d
npm install
npm run db:setup
npm run dev
```

`db:setup` est réservé au poste local. Configure `AUTH_SECRET`, `POSTGRES_URL`, `PERSONAL_ACCESS_EMAIL` et `PERSONAL_ACCESS_PASSWORD` dans `.env.local` ; les valeurs documentées dans `.env.example` sont les variables prises en charge.

Pour créer un compte local supplémentaire :

```sh
printf "change-me-now" | npm run users:create -- --email "dev@example.com" --password-stdin --status active --verify-email
```

## Commandes utiles

```sh
npm run lint -- --max-warnings=0
npm exec tsc -- --noEmit
npm run test:users
npm run build
npm run test:e2e
```

La suite E2E réinitialise une base locale dédiée, suffixée `_e2e` ou `_test`. Ne jamais la cibler vers une base partagée ou de production.

Pour les migrations sur un environnement ciblé :

```sh
npm run db:preflight
npm run db:migrate
```

Exécuter `npm run db:seed` seulement lorsqu'un seed est nécessaire, puis `npm run db:assert-personal-access` si le compte personnel est attendu. Le détail des migrations est dans `docs/engineering/database-migrations.md`.

## Déploiement

Le runbook Vercel actuel est `docs/plan-deploiement-vercel.md`. La production se publie uniquement avec :

```sh
npm run deploy:prod
```

Vérifier l'état Git et la branche avant de lancer la commande.

## Documentation de code

Les instructions locales sont dans `AGENTS.md`, `app/AGENTS.md`, `components/AGENTS.md`, `lib/AGENTS.md`, `scripts/AGENTS.md` et `tests/e2e/AGENTS.md`.

## Lien de test interne

La génération et la révocation restent manuelles : `npm run users:test-link:generate` et `npm run users:test-link:revoke`. Le lien produit donne accès à un compte et doit rester privé. Il n'est jamais généré au démarrage ni au build.
