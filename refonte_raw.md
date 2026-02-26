# Refonte UX des Lignes d'Aliments (Rows)

Ce document décrit les améliorations visuelles et ergonomiques à apporter au composant \`VegetableRow\` (et potentiellement autres rangées d'aliments du même type) pour moderniser l'interface, particulièrement sur mobile.

## 1. Nouvelle Structure et Espacement (L'Effet "Carte")

Actuellement, les aliments semblent posés sur le fond continu du tableau. L'objectif est de créer un effet de "cartes indidivudelles" (cards) empilées.

*   **Détachement du fond :** Les lignes (`<li>`) doivent avoir un fond blanc pur (`bg-white`) contrastant avec un fond de tableau/page légèrement grisé ou crème (ex: `bg-slate-50` ou `bg-[#fcfbf9]`).
*   **Mise en évidence (Ombres) :** Ajouter une ombre légère et diffuse sous chaque ligne pour les faire ressortir. 
    *   *Classe Tailwind suggérée :* `shadow-sm` ou une ombre personnalisée très douce.
*   **Espacement inter-lignes (Gap) :** Au lieu d'avoir les lignes collées (si c'est le cas actuellement) ou séparées par de simples bordures, forcer un espacement vertical (marge) entre chaque ligne (ex: `mb-2` ou `gap-2` sur le conteneur parent `<ul>`).
*   **Rayons de courbure (Border radius) :** Conserver ou accentuer les bords arrondis pour renforcer l'effet "pilule" ou "carte" (ex: `rounded-2xl`).

## 2. Allègement de l'Interface (Mobile First)

La ligne actuelle est trop chargée horizontalement, entraînant un risque de compression du texte sur smartphone.

*   **Suppression du bouton Édition (Crayon) :** L'icône du crayon à droite est supprimée pour gagner de l'espace.
*   **Nouvelle interaction d'ouverture :** Le résumé/l'édition de l'aliment doit s'ouvrir soit :
    1.  En cliquant sur **le nom de l'aliment**.
    2.  En cliquant **n'importe où sur la zone vide** de la carte (rendre toute la surface cliquable, sauf les tigres/boutons d'action).

## 3. Refonte du Bouton "Première bouchée"

Ce bouton est l'appel à l'action principal mais semble actuellement un peu brut et encombrant. L'objectif est de le rendre plus élégant et gratifiant au clic.

*   **Réduction de l'encombrement textuel :** Laisser respirer le texte. L'inspiration montre un texte sur deux lignes (Titre fort + Sous-titre plus léger) qui permet un format plus compact horizontalement tout en restant lisible. 
    *   *Exemple :* "ENREGISTRER" (petit, gras, espacé) au-dessus de "PREMIÈRE BOUCHÉE" (plus grand, régulier).
*   **Ajout d'une iconographie :** Intégrer une icône illustrative "fun" mais discrète à gauche du texte (ex: un visage de tigre en contour simple ou une icône "check" stylisée). Cela ajoute un côté ludique propre à l'application.
*   **Ajustement de la forme et couleur :** Le bouton actuel est très contrasté (contour beige sur fond crème foncé). 
    *   L'adoucir en utilisant une couleur de fond unie et douce (comme le vert d'eau de l'exemple ou un beige très léger) texturé, **sans bordure**.
    *   Accentuer la forme en "pilule" complète (`rounded-full`) avec un contour interne invisible au survol pour un effet de matériau moderne.

## 4. Centrage et Alignement Optique (Le "Nettoyage")

Les éléments à l'intérieur de la ligne manquent de consistance de taille, créant un sentiment de déséquilibre.

*   **Hauteur homogène des actions :** Le gros bouton "Première bouchée" et les cercles contenant les tigres/réactions doivent avoir **exactement la même hauteur globale** et la même ligne médiane d'alignement. 
    *   *Actuellement :* Décalage entre `h-11` (bouton) et `h-9` (visuel tigre). Il faut standardiser la boîte englobante.
*   **Chevauchement des avatars (Tigres) :** Si possible, et pour gagner encore en largeur, faire légèrement se chevaucher les cercles des réactions (façon "Avatar group" typique des apps modernes), avec une fine bordure blanche autour de chaque cercle pour bien les détacher.
*   **Alignement vertical parfait :** S'assurer que le flex conteneur (`items-center`) centre parfaitement l'emoji/nom à gauche avec les actions à droite, sans marges internes (padding) parasites qui pousseraient le bouton "Première bouchée" vers le haut ou le bas.

## 5. Ce Qui Ne Change Pas

*   **Le design system :** On conserve les couleurs (beiges, marrons terrestres), la typographie et le style des réactions (tigres). Pas de refonte complète vers un style "SaaS" gris/bleu froid.
*   **L'arborescence DOM globale :** Pas besoin de réécrire toute la logique React ou de forcer l'usage de composants lourds pour faire le rendu de cette simple ligne.
