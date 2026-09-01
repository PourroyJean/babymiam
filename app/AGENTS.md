# app/

Routes App Router, pages et server actions de Grrrignote.

## Organisation

- Dashboard : `/`.
- Authentification : `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email` et `/magic-login`.
- Compte : `/account`; partage public : `/share` et `/share/[token]`.
- Contenu et états système : `/blog`, `/maintenance`, favicon et `layout.tsx`.
- Handler API : `/api/pediatric-report` génère le rapport PDF.
- Les actions transverses sont dans `app/actions.ts`; les actions de compte sont dans `app/account/actions.ts`; les flux d'authentification gardent leurs actions près de leur route.

## Invariants

- Les pages et mutations protégées s'appuient sur `requireAuth()` ou `requireVerifiedAuth()` de `lib/auth`. Les actions sensibles exigent un e-mail vérifié ; la déconnexion de la session courante reste disponible sans cette vérification.
- La vérification d'e-mail consomme son jeton par `POST` explicite, jamais via un `GET`.
- Le flux « mot de passe oublié » ne doit pas révéler si une adresse existe, y compris en cas de rate-limit ou d'erreur interne.
- `/api/pediatric-report` doit conserver ses protections d'authentification et de premium.

## Styles

Les styles sont globaux dans `app/globals.css`; il n'y a pas de CSS modules. Lors d'une suppression de surface UI, supprimer aussi les classes devenues inutilisées après vérification des usages.
