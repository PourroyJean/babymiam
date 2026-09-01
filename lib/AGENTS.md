# lib/

Logique serveur, accès PostgreSQL, authentification et fonctions métier partagées.

## Responsabilités

- `auth.ts` gère sessions, mots de passe, vérification d'e-mail, rate limits et jetons d'authentification. Les fonctions `requireAuth()` et `requireVerifiedAuth()` sont les portes d'accès des routes/actions.
- `db.ts` résout la connexion PostgreSQL : `LOCAL_POSTGRES_URL` prévaut hors production/CI, puis `POSTGRES_URL`, puis `DATABASE_URL`. Les runtimes stricts refusent une configuration absente.
- `data.ts` porte les lectures/écritures owner-scoped du dashboard, des aliments personnalisés, du profil enfant, de la croissance et du partage public.
- `premium-entitlement-core.js` est la source de vérité du gating premium ; `premium-features.ts` en est le wrapper applicatif.
- Les jetons de partage public et de lien de test sont isolés dans leurs modules dédiés.
- Les read models et générateurs (plans hebdomadaires, recommandations d'âge, rapport pédiatrique/PDF) ne doivent pas dupliquer les règles d'accès ou de persistance.

## Invariants métier et sécurité

- Toute lecture ou mutation d'un aliment par identifiant doit contrôler son propriétaire ; le catalogue global est lisible, un aliment privé ne l'est que par son propriétaire.
- `liked` est tri-état : `boolean | null`. Ne pas le coercer avec `Boolean(...)`.
- Une texture de dégustation est un niveau obligatoire `1 | 2 | 3 | 4`, avec défaut `1`; utiliser les validateurs de `tasting-metadata.ts`.
- Les formulaires qui transmettent une date envoient aussi `tzOffsetMinutes`.
- Les fichiers JavaScript critiques disposent de déclarations `.d.ts` et de tests Node colocalisés lorsqu'ils portent de la sécurité ou des jetons.

## Prudence

- Les mécanismes de compatibilité de schéma dans `data.ts` existent pour des bases anciennes : ne pas les étendre sans une période de migration explicitement supportée. Toute suppression exige d'abord la confirmation que toutes les bases ciblées ont le schéma courant.
- Les opérations de partage public utilisent des transactions/verrous pour éviter les rotations et comptages concurrents : conserver ces garanties lors d'une simplification.
