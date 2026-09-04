# Déployer Grrrignote sur Vercel

## Avant la release

1. Vérifier la branche et `git status --short` : `npm run deploy:prod` publie le worktree courant.
2. Exécuter les contrôles adaptés :

   ```sh
   npm run lint -- --max-warnings=0
   npm exec tsc -- --noEmit
   npm run test:users
   npm run build
   ```

3. Vérifier dans le scope Vercel concerné les variables d'authentification, de base, d'e-mail et `APP_BASE_URL`. Ne pas copier leurs valeurs dans les logs ou la documentation.

## Migration de base

Si la release contient une migration, prévoir une sauvegarde et activer `MAINTENANCE_MODE=true` si elle n'est pas compatible sans interruption.

Sur l'environnement cible :

```sh
npm run db:preflight
npm run db:migrate
```

Lancer `npm run db:seed` uniquement si nécessaire. Après un seed qui doit préparer le compte personnel, vérifier :

```sh
npm run db:assert-personal-access
```

## Publication et vérification

1. Publier :

   ```sh
   npm run deploy:prod
   ```

2. Vérifier en production : connexion, écriture d'une dégustation, lien grands-parents et réinitialisation de mot de passe.
3. Vérifier les logs Vercel et la base. Désactiver `MAINTENANCE_MODE` si elle a été activée.

Les builds ne lancent ni migration, ni seed, ni génération de lien de connexion.
