# components/

UI React de diversification alimentaire, architecture plate (sans sous-dossiers), 25 fichiers.

## Composants cles

* categories-grid.tsx (970L, client) : orchestrateur d'etat principal. Ouvre search, timeline, guide, weekly plan, quick add, add food et summary. Source unique de verite pour la gestion open/close.
* profile-menu.tsx (682L, client) : dropdown compte, profil enfant, mot de passe, deconnexion et lien de partage public.
* food-summary-modal.tsx (501L, client) : resume de degustation modifiable avec suppression et sauvegarde via portals.
* vegetable-row.tsx (457L, client) : ligne aliment, slots de degustation, editeur inline, cycle de preference finale.
* quick-add-panel.tsx (319L, client) : panneau d'ajout rapide de degustation.
* weekly-plan-panel.tsx (286L, premium) et weekly-action-plan-panel.tsx (220L) : plan de decouverte de sept jours.
* guide-panel.tsx (112L, premium) et age-guidance-panel.tsx (149L, premium) : recommandations de diversification par age.
* search-panel.tsx (146L) : barre de recherche d'aliments.
* add-food-panel.tsx (183L) : panneau pour ajouter un aliment personnalise.
* timeline-panel.tsx : modal timeline et passage de donnees pour le resume.
* texture-timeline.tsx (84L, server) : contenu educatif statique.
* Famille public-share :
  * public-share-dashboard.tsx (106L, server shell)
  * public-share-timeline-panel.tsx (39L, server)
  * public-share-unavailable.tsx (20L, server) : affichage d'un lien expire ou invalide.
  * public-share-category-chart.tsx (121L) : graphique des categories.
  * public-share-preference-chart.tsx (165L) : donut de preferences.
  * public-share-cumulative-chart-live.tsx (229L) : graphique cumule interactif.
  * public-share-food-list-dialog.tsx (168L) : dialogue portal de drilldown.
* site-nav.tsx (68L, server/shared) : barre de navigation superieure avec profil.

## Client vs Server

* Environ 20 composants clients declares avec la directive "use client" pour les interactions.
* Cinq composants serveurs partages : site-nav, public-share-dashboard, public-share-timeline-panel, public-share-unavailable, texture-timeline.
* Les shells serveurs injectent des composants clients pour gerer les actions utilisateur.

## Conventions

* Primitives de composition partagees :
  * tasting-entry-form-fields.tsx (238L) : utilise par quick-add-panel et vegetable-row.
  * texture-segmented-control.tsx (87L) : injecte dans tasting-entry-form-fields.
  * password-field.tsx (95L) : champ avec icone de masquage.
  * food-timeline-feed.tsx (221L) : utilise par timeline-panel et public-share-timeline-panel.
* Styling : Aucun module CSS (pas de fichier *.module.css). Tout est declare via className avec styles globaux dans app/globals.css. Namespaces obligatoires :
  * dashboard : quick-add-*, food-search-*, weekly-plan-*, guide-panel-*, age-guidance-*
  * public-share : public-share-*
  * nav/account : site-nav-*, password-field-*
* Modals : Overlay, dialog, header et bouton food-search-close avec focus trap, Escape et scroll lock. Toujours passer par des portals.

## Pieges

* categories-grid.tsx (970L) est la piece centrale de l'etat des fenetres. Modifier sa structure necessite une grande prudence.
* Le tri de la timeline s'applique uniquement dans timeline-panel.tsx cote client. buildTimelineEntries dans categories-grid.tsx prepare un tableau a plat brut sans trier. Ne pas trier dans les deux fichiers. Ordre attendu : date decroissante, slot decroissant, nom francais croissant.
* Toute mise a jour d'une icone de texture ou reaction doit etre synchronisee entre timeline-panel et texture-segmented-control.
