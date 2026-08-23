# lib/

Cœur logique, accès aux données, authentification et utilitaires serveur de Grrrignote.

## Modules clés

- **auth.ts** (1034L) : Hub d'authentification de l'application.
  - Session : Cookie signé `bb_session` (payload `{uid, sv, iat, exp}`).
  - Priorité des secrets : `AUTH_SECRETS` > `AUTH_SECRET` > fallback de dev.
  - Fallback de dev uniquement sous `ALLOW_INSECURE_DEV_AUTH=1` (hors runtime strict).
  - Runtime strict : `NODE_ENV=production` ou `CI=true` (secrets manquants bloquants).
  - `requireAuth()` redirige vers `/login`.
  - `requireVerifiedAuth()` redirige vers `/account?verify_required=1`.
  - Tokens gérés : Réinitialisation de mot de passe, vérification d'email, accès test partagé.
  - Nettoyage opportuniste et asynchrone des tables `auth_*_attempts`.

- **db.ts** (85L) : Résolution de la connexion PostgreSQL.
  - Résolution : `LOCAL_POSTGRES_URL` (hors prod/CI) > `POSTGRES_URL` > `DATABASE_URL` > fallback local.
  - En runtime strict : lève une exception immédiate si aucune URL n'est trouvée.
  - SSL : Normalise `sslmode` `require|prefer|verify-ca` vers `verify-full` (sauf si `uselibpqcompat=true`).
  - Pool d'exécution : Singleton persistant mis en cache dans `global.__grrrignotePool`.

- **data.ts** (1234L) : Couche d'accès aux données (Repository).
  - Lectures : Dashboard, timeline, profil enfant, lookup de partage public.
  - Écritures : Quick entry, upsert/delete de dégustation, préférence finale, résumé.
  - Autres écritures : CRUD aliments personnalisés, profil enfant, événements de croissance, partage public.
  - Sécurité : Contrôle centralisé via `getAccessibleFoodById` (`owner_id IS NULL OR owner_id = current user`).
  - Dérive de schéma : Cache global avec TTL pour `food_progress`, fallback colonnes manquantes, checks `to_regclass`.
  - Partage public : Advisory locks et fenêtres de déduplication pour la rotation sécurisée.

- **Gating Premium** : Contrôle des accès aux fonctionnalités payantes.
  - `premium-entitlement-core.js` (100L) : Règles d'accès, parsing d'env, allowlists et fallback personnel.
  - Fichiers compagnons : `premium-entitlement-core.d.ts` et `premium-entitlement-core.test.js`.
  - `premium-features.ts` : Wrapper léger exposant la fonction `hasPremiumAccess()`.

- **Tokens** : Gestion de la cryptographie de partage et de test.
  - `public-share-token.js` (155L) + `.d.ts` + `.test.js` : Cycle de vie du partage public.
  - `shared-test-login-token.js` (128L) + `.d.ts` : Jeton d'accès au compte de test garanti.

- **Modules de restitution et d'analyse** :
  - `dashboard-read-model.ts` (283L) : Résumés de progression, KPI, timeline aplatie, agrégats public.
  - `weekly-action-plan.ts` (388L) : Calcul et génération du plan d'action hebdomadaire.
  - `weekly-discovery-plan.ts` (317L) : Calcul du plan de découverte de nouveaux aliments.
  - `age-guidance.ts` (297L) : Recommandations nutritionnelles selon l'âge.
  - `pediatric-report.ts` (543L) : Logique de compilation du rapport pédiatrique complet.
  - `simple-pdf.ts` (273L) : Génération de PDF texte avec le marqueur de police monospace `[[MONO]]`.

- **Utilitaires et constantes partagés** :
  - `tasting-metadata.ts` : Enums texture/réaction (`TEXTURE_OPTIONS`, `REACTION_OPTIONS`), `DEFAULT_TEXTURE_LEVEL` (=1), `DEFAULT_REACTION_TYPE` (=0), validateurs (`isTextureLevel`, `getTextureOption`, ...).
  - `ui-utils.ts` (126L) : Normalisation recherche, collator fr, formater date, parseur d'URL de redirection.
  - `date-utils.ts` (25L) : Manipulation de dates ISO avec prise en compte du décalage horaire `tzOffset`.
  - `request-ip.ts` (103L) : Extraction et validation de l'IP du client via proxy de confiance.
  - `app-url.ts` (45L) : Construction d'URL absolues avec fallback automatique vers `VERCEL_URL`.
  - `email.ts` (95L) : Expédition des e-mails via l'API Resend.
  - `category-ui.ts` : Association des tons et pictogrammes aux catégories alimentaires.
  - `public-share-preferences.ts` : Configuration des libellés et couleurs du partage public.
  - `types.ts` : Déclarations de types de domaine transverses.

## Conventions

- Fichiers `.js` critiques typés via `.d.ts` et couverts par des tests colocalisés `.test.js` (`npm run test:users`).
- Propriété `liked` tri-état : `boolean | null` (la valeur `null` qualifie un état indécis/neutre).
- Texture « aucune » : modèle métier `textureLevel = null` (le type `TextureLevel` est `1|2|3|4`, défaut 1) ; icône `texture-0-aucune.webp` gérée côté UI/CSS, pas via une constante de `tasting-metadata.ts`.
- Envoi systématique de `tzOffsetMinutes` par le client lors de la validation des dates.

## Pièges

- Cache du schéma dans `data.ts` : Le cache des colonnes de `food_progress` est global et persiste avec un TTL.
- Contrôle d'accès aliment : `getAccessibleFoodById()` est le garde principal (owner-scoped) pour lire/muter un aliment par id — mais pas l'unique chemin : `createUserFood`/`deleteUserFood` et les lectures dashboard ont leurs propres checks d'ownership.
- sslmode : Le mapping de node-postgres vers `sslmode` est susceptible d'évoluer avec l'arrivée de pg v9.
