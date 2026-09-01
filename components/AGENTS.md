# components/

Composants React de l'interface, regroupés à plat. Les composants interactifs sont clients ; les shells de pages publiques peuvent rester serveur et composer des enfants clients.

## Points d'entrée

- `categories-grid.tsx` orchestre le dashboard : catégories, recherche, timeline, guide, plans, ajout rapide, ajout d'aliment et résumé.
- `profile-menu.tsx` rassemble le menu de compte, le profil enfant, la sécurité et le partage public.
- `vegetable-row.tsx`, `quick-add-panel.tsx` et `food-summary-modal.tsx` portent les principaux flux de dégustation.
- `tasting-entry-form-fields.tsx`, `texture-segmented-control.tsx`, `password-field.tsx` et `food-timeline-feed.tsx` sont des primitives réutilisées : privilégier leur extension plutôt que dupliquer un formulaire ou une timeline.

## Conventions

- Les classes sont globales, définies dans `app/globals.css`. Préfixer les nouvelles classes par leur surface (`quick-add-`, `food-search-`, `public-share-`, `site-nav-`, etc.).
- Une modale doit utiliser un portal et préserver les comportements d'accessibilité : rôle de dialogue, focus initial/restauration, Escape et verrouillage du scroll.
- Garder un seul endroit responsable de l'ordre d'affichage final d'une donnée. Pour la timeline, le tri est dans `timeline-panel.tsx` : date décroissante, slot décroissant, puis nom français croissant. `buildTimelineEntries()` ne fait que l'aplatissement.
- Si une représentation de texture ou de réaction est partagée par plusieurs vues, modifier chaque vue concernée et couvrir le parcours utilisateur.

## Prudence

`categories-grid.tsx` est un hot path d'état d'overlays. Simplifier les états ou les transitions par étapes et valider recherche, timeline, ajout rapide, ajout d'aliment et résumé en E2E.
