# app/

Cartographie du repertoire app/ de l'application Next.js (App Router).

## Routes
- `/` : page.tsx (dashboard principal, 59 lignes).
- `/login` : page.tsx (authentification des utilisateurs).
- `/signup` : page.tsx (creation de compte).
- `/forgot-password` : page.tsx (demande de reinitialisation).
- `/reset-password` : page.tsx (saisie du nouveau mot de passe).
- `/verify-email` : page.tsx (validation de l'adresse mail).
- `/account` : page.tsx (gestion du profil, 198 lignes).
- `/blog` : page.tsx (articles d'accompagnement, 273 lignes).
- `/share` : page.tsx (ancien lien, desormais indisponible).
- `/share/[token]` : page.tsx (dashboard public signe, 139 lignes).
- `/maintenance` : page.tsx (ecran de coupure technique).

## Route handlers / API
- `/api/pediatric-report` -> route.ts : generation du PDF du rapport pediatrique.
- `/magic-login` -> route.ts : connexion immediate de test pour le partage.
- `/favicon.ico` -> route.ts : livraison dynamique de la favicône.

## Server actions
- `app/actions.ts` (429 lignes) : actions globales (tastings, quick entries, création/suppression aliments, profil bebe, sauvegarde résumé, logout).
- Actions specifiques par route :
  - `login/actions.ts` : gestion de la soumission de connexion.
  - `signup/actions.ts` : enregistrement initial.
  - `forgot-password/actions.ts` : declenchement du mail de reinitialisation.
  - `reset-password/actions.ts` : application du nouveau mot de passe.
  - `verify-email/actions.ts` : validation du jeton utilisateur.
  - `account/actions.ts` (290 lignes) : securite, verification, configuration du partage public.
- Note : `account/page.tsx` embarque des wrappers serveur inline vers `account/actions.ts`.

## Conventions
- Aucun groupe de routes dans la structure (pas de segment specifique type `(auth)` ou `(marketing)`).
- Seul parametre dynamique autorise au sein de l'arborescence : `/share/[token]`.
- Securite des pages : verification d'acces via `lib/auth` (fonctions requireAuth et requireVerifiedAuth).
- Securite des actions : les actions de modification sensibles requierent requireVerifiedAuth.
- Exception de securite : la deconnexion de la session courante reste autorisee sans email valide.
- Fichiers speciaux : `layout.tsx` (police Fredoka locale), `error.tsx` (app-wide error boundary), `loading.tsx`.
- Assets stockes dans `app/` : `blog/deep-research-report.md` (227 lignes), icones, polices woff2.

## Pieges
- Verification email : le token doit etre valide via requete POST explicite, jamais en GET (evite les prefetchers).
- Styles globaux : le fichier `app/globals.css` fait 5317 lignes. Les composants n'utilisent aucun module CSS.
- Acces rapport : endpoint `/api/pediatric-report` protege (code 402 si non premium, redirection 307 vers login si non auth).
