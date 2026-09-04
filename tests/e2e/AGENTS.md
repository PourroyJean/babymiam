# tests/e2e/

Suite Playwright couvrant l'authentification, le dashboard, les dégustations, les aliments personnalisés, le compte, le rapport pédiatrique et le partage public.

## Exécution et fixtures

- La configuration est dans `playwright.config.ts`; `global.setup.ts` crée/réinitialise la DB, applique les migrations, prépare l'utilisateur et charge le catalogue de fixtures.
- `fixtures/test-fixtures.ts` fournit l'auto-login, la page applicative et un reset avant chaque test.
- `helpers/db.ts` centralise le cycle de vie de DB, les fixtures et les assertions/mutations directes. Garder les données de test déterministes et s'appuyer sur les libellés canoniques de `aliments_categories.json`.
- Les tests s'exécutent en série : ne pas introduire de dépendance à l'ordre ou à un état laissé par une autre spec.

## Sécurité du reset

- Le reset destructif est autorisé uniquement sur une base locale dont le nom se termine par `_e2e` ou `_test`. Ne jamais définir l'override de reset distant pour une base partagée ou de production.
- Toute nouvelle table mutable doit être ajoutée à `E2E_RESETTABLE_TABLES` **et** au SQL de `resetMutableTables()` afin d'éviter la pollution entre tests.
- Ne pas committer `playwright-report/`, `test-results/` ou `.next-e2e*`.

## Invariants de test

- Le premium est forcé et allowlisté explicitement dans l'environnement E2E pour des résultats reproductibles.
- Préférer des sélecteurs accessibles et non ambigus ; avec un libellé partagé, utiliser une cible précise (`exact: true`, rôle ou conteneur).
- Toute modification responsive du dashboard doit être vérifiée en desktop et avec un viewport mobile de 390 × 844 ; couvrir l'absence de contenu masqué, tronqué ou séparé par un espace anormal.
- Le filtre Playwright `-g` est une expression régulière : vérifier le nombre de tests réellement exécutés.
- Couvrir les chemins négatifs d'authentification/autorisation en plus du chemin de succès, notamment pour les actions sensibles et le rapport premium.
