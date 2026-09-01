# Retours d’expérience d’ingénierie

Contexte historique pour les choix non évidents. Les invariants actifs restent dans les `AGENTS.md` locaux ; ce document ne remplace ni le code ni les tests.

## Tests E2E et fiabilité

- Une nouvelle table mutable doit être ajoutée à `E2E_RESETTABLE_TABLES` **et** au SQL de `resetMutableTables()` dans `tests/e2e/helpers/db.ts` : un seul des deux laisse des données entre les tests.
- Les fixtures doivent décrire un état stable. Attendre l'effet métier visible après une mutation plutôt que cibler un aliment, un slot ou un compteur dont l'état peut dépendre d'une autre spec.
- Avec un libellé partagé, préférer un sélecteur Playwright explicite (`exact: true`, rôle ou conteneur). Le filtre `-g` est une expression régulière : contrôler le nombre de tests réellement exécutés.
- Tout monkey patch de navigateur, notamment `FormData.prototype.set`, doit être restauré dans un `try/finally` pour ne pas contaminer les tests suivants.
- Les flux PDF peuvent échapper certains caractères dans le stream ; tester le texte avec une expression régulière adaptée plutôt qu’une comparaison littérale fragile.
- Un serveur de développement externe peut être réutilisé par Playwright avec un environnement différent : l'arrêter ou vérifier son environnement avant d'interpréter un résultat E2E.

## Authentification et sécurité

- Un jeton de vérification e-mail doit être consommé par une action `POST` explicite, jamais lors d'un `GET` susceptible d'être préchargé ou scanné.
- Le flux « mot de passe oublié » doit produire la même réponse observable pour un compte existant, absent, limité ou en erreur interne afin de ne pas permettre l’énumération d’adresses.
- Les actions sensibles vérifient l’e-mail côté serveur, même lorsqu’elles sont masquées par l’interface. La déconnexion de la session courante reste l’exception : elle doit rester disponible à un compte non vérifié.
- Une même métadonnée acceptée via formulaire et JSON doit passer par la même validation stricte ; les coercitions implicites changent la surface d’entrée.

## Données, schéma et logique métier

- Pour corriger un doublon du catalogue, traiter la normalisation, les lignes historiques et leurs relations, puis aligner les fixtures E2E : modifier le JSON seul ne répare pas les données déjà créées.
- Une donnée tri-état doit rester tri-état jusqu’à la persistance et aux helpers de test ; `Boolean(...)` détruit la différence entre `false` et `null`.
- Une vue doit avoir une seule source de vérité pour son ordre final. La timeline trie au rendu ; la construction des entrées se limite à l’aplatissement.
- Les compatibilités temporaires de schéma sont une dette encadrée : ne les étendre que pour une période de migration explicitement supportée, puis les retirer lorsque toutes les bases sont à jour.

## Base de données et opérations

- `db:preflight` exige une URL de base explicite, y compris en local : définir l’environnement avant de diagnostiquer un incident de base.
- Hors runtime strict, `LOCAL_POSTGRES_URL` permet de prioriser la base locale sans renommer les fichiers `.env*`.
- Un échec DNS ou réseau dans le sandbox n’est pas une preuve de panne Vercel, Neon ou DNS : refaire le contrôle avec l’accès réseau approprié avant toute conclusion.
- Lors d’une bascule de base, vérifier les variables secondaires de connexion et d’authentification, puis conserver l’ancienne base jusqu’aux migrations, seeds, smoke tests et logs post-déploiement validés.

## Déploiement, partage et UX

- `npm run deploy:prod` publie l’état du worktree, y compris les changements non commités : contrôler `git status --short` et l’ancestry de la branche avant de déployer. Les opérations Git qui modifient la même branche se font en séquence.
- Le lien de test partagé utilise une date d’émission dédiée pour son expiration ; sa révocation passe par la rotation de session. Les logs qui l’affichent sont sensibles.
- En preview, le fallback depuis `VERCEL_URL` évite de dépendre d’une URL applicative configurée manuellement. Vérifier malgré tout les variables requises dans chaque scope Vercel.
- Après un ajout rapide déclenché depuis le plan 7 jours, fermer la modale à la réussite : réinitialiser son contenu sans la fermer casse la continuité du parcours.
- Pour améliorer le défilement mobile d’une page riche, réduire d’abord les effets visuels coûteux (`backdrop-filter`, grandes ombres, overlays) ; `content-visibility` seul peut déplacer le coût au premier affichage.

## Entretien

- Ajouter seulement une leçon vérifiée, durable et actionnable ; la formuler sans date ni récit de correction.
- Supprimer ou réécrire une leçon lorsque le code, les tests ou la décision produit ont changé.
- Un invariant devenu nécessaire à chaque intervention doit être résumé dans l’`AGENTS.md` local concerné ; ce document conserve le pourquoi, pas le mode d’emploi ponctuel.
