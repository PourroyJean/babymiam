# Idées V2

## Les 14 allergènes européens (UE)

1. Céréales contenant du gluten (blé, seigle, orge, avoine, épeautre, kamut ou leurs souches hybridées)
2. Crustacés
3. Oeufs
4. Poissons
5. Arachides
6. Soja
7. Lait (y compris lactose)
8. Fruits à coque (amande, noisette, noix, noix de cajou, noix de pécan, noix du Brésil, pistache, noix de macadamia/du Queensland)
9. Céleri
10. Moutarde
11. Graines de sésame
12. Anhydride sulfureux et sulfites (concentrations > 10 mg/kg ou 10 mg/litre)
13. Lupin
14. Mollusques

## Idée de section / affichage spécial allergènes

Pour ces 14 allergènes, créer un affichage dédié avec :

- Calendrier d’introduction
- Fréquence recommandée
- Guide de gestion : réaction légère vs urgence

## Nouvelle partie idée : progression des textures (anti "purée trop longue")

Beaucoup de parents restent trop longtemps sur du mixé lisse. On peut ajouter une timeline visuelle très claire pour guider la progression.

### Timeline visuelle (chiffres validés)

- 4-6 mois (repère France) : début de diversification + purée/compote lisse
- 6-8 mois : écrasé / haché grossier, purée granuleuse
- 8-10 mois : petits morceaux très mous/fondants
- 10-12 mois : morceaux à croquer puis transition vers "presque comme les parents"
- Vers 12 mois : la plupart des enfants peuvent manger les mêmes types d’aliments que la famille (adaptés pour la sécurité)

### Message clé à afficher

Ne pas rester bloqué trop longtemps en purée lisse : la progression des textures est importante pour l’acceptation alimentaire et la mastication.

### Sources de validation

- MangerBouger (site officiel PNNS) : repères textures 6/8, 8 et 10 mois  
  https://www.mangerbouger.fr/site/manger-mieux/a-tout-age-et-a-chaque-etape-de-la-vie/jeunes-enfants-de-0-a-3-ans-du-lait-a-la-diversification/a-partir-de-6-8-mois-on-touche-on-mache-on-decouvre-de-nouvelles-textures
- Tableau officiel "Diversification alimentaire jusqu’à 3 ans" (MangerBouger) : repère 4-6 mois en mixé lisse  
  https://www.mangerbouger.fr/site/content/download/1498/file/Tableau_diversification_alimentaire_jusqu%27a_3_ans.pdf
- WHO (Complementary feeding) : purée/écrasé à 6 mois, finger foods vers 8 mois, aliments familiaux vers 12 mois  
  https://www.who.int/health-topics/complementary-feeding
- Étude ALSPAC (PubMed, 2009) : introduction tardive des textures grumeleuses/après 9 mois associée à plus de difficultés alimentaires  
  https://pubmed.ncbi.nlm.nih.gov/19161546/

## Partie idée : gamification utile (pas gadget)

Objectif : motiver les parents à progresser sur les indicateurs qui ont un intérêt nutrition/allergie, sans logique de "jeu pour le jeu".

### Statistiques à afficher (avec définition produit)

1. % légumes verts introduits  
   `nb légumes verts testés au moins 1 fois / nb total de légumes verts du catalogue âge-compatible`.

2. Diversité totale  
   `nombre d’aliments uniques introduits` (depuis le début), + vue "7 derniers jours" pour éviter l’effet collection sans répétition.

3. Score de variété (ancré WHO/UNICEF)  
   `nombre de groupes alimentaires couverts sur 8 (24h)` avec repère "minimum atteint" si `>= 5/8` (Minimum Dietary Diversity).

4. Exposition allergènes  
   Deux barres distinctes :
   - Introduction : `x/14 allergènes testés`
   - Maintien : `% d’allergènes tolérés reconsommés régulièrement (fenêtre 4 semaines)`

5. Expositions répétées (très utile en pratique)  
   `nb aliments retestés >= 8 fois` (surtout légumes), pour lutter contre l’arrêt trop précoce après 1-2 refus.

### Gamification intelligente

Badges proposés (simples et compréhensibles) :

- Badge "30 aliments"
- Badge "Tous les allergènes testés"
- Badge "8 essais sur un légume vert"
- Badge "Variété 5/8 atteinte 7 jours de suite"

Règles UX à garder :

- Pas de comparaison entre enfants / leaderboard.
- Badges orientés constance et sécurité, pas vitesse.
- Si allergie confirmée : marquer "exclu médicalement" pour ne pas pénaliser le score.

### Pourquoi ces stats ne sont pas gadgets (base scientifique)

- WHO/UNICEF : indicateur standard "Minimum Dietary Diversity" = au moins 5 groupes sur 8 chez les 6-23 mois.
- Étude NorthPop (Pediatr Allergy Immunol, 2025) : à 9 mois, 13-14 aliments introduits associés à 45% d’odds en moins d’allergie alimentaire à 18 mois ; score élevé de diversité pondérée associé à 61% d’odds en moins.
- Repeated exposure : les revues/essais montrent qu’il faut souvent 8-10 expositions pour améliorer l’acceptation d’un aliment (notamment légumes/fruits).
- Allergènes : les recommandations récentes insistent sur l’introduction précoce puis l’ingestion régulière des allergènes tolérés (pas "tester une fois puis arrêter").

### Sources

- WHO - Child feeding: Minimum dietary diversity (6-23 months)  
  https://www.who.int/data/gho/data/indicators/indicator-details/GHO/minimum-dietary-diversity-6-23-months
- WHO/UNICEF - Indicators for assessing infant and young child feeding practices (2021)  
  https://www.who.int/publications/i/item/9789240018389
- PubMed - Diversity of complementary diet and early food allergy risk (NorthPop, 2025)  
  https://pubmed.ncbi.nlm.nih.gov/39868464/
- USDA NESR - Repeated exposure and early food acceptance  
  https://nesr.usda.gov/what-relationship-between-repeated-exposure-timing-quantity-and-frequency-foods-and-early-food
- EAACI guideline (2020 update) - prévention allergie alimentaire  
  https://pubmed.ncbi.nlm.nih.gov/33710678/
- CSACI statement - importance de l’ingestion régulière après introduction  
  https://aacijournal.biomedcentral.com/articles/10.1186/s13223-023-00814-2

