---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["api/blog-render.js"]
---

# Surface brief — accueil PVT Explorer (et monde partagé par tout le site)

## Scope and mode

- Surfaces : `public/index.html` (Persuade). Le même monde habille les articles (`api/blog-render.js`, Read), l'index des guides `/nos-astuces` (Read), À propos, pages légales, 404 et confirmation.
- Visiteur : 18-35 ans, arrive de Google (« pvt », « pvt + pays »), souvent sur mobile. Travail : savoir quel PVT lui est ouvert et quoi faire ensuite.
- Action : vérifier son éligibilité par l'âge et ouvrir le guide du pays. Preuve : données réelles des 15 destinations, 11 guides publiés, voix « je » d'un auteur qui a fait un PVT. Aucun témoignage ni chiffre inventé.

## Direction contract

THESIS: Chaque destination est une vignette visa à obtenir ; chaque étape franchie reçoit son tampon. La page refuse le standard du secteur : grande photo de paysage, titre centré, grille de cartes à drapeaux emoji.

OWN-WORLD: Couverture de passeport bordeaux (#5b1a2c) dorée à chaud (#d4b26a) en bandeau et en pied ; pages intérieures en papier de sécurité froid (#f1f2f5) bordé de guilloché fin ; vignettes blanches à rosace guillochée unique par pays, champs étiquetés FR · EN, ligne MRZ en mono ; encres de tampon pour l'état : vert ouvert, violet sur invitation, rouge actualité ou fermé. Grotesque large pour les titres, mono pour les données. Jamais Marianne, tricolore ni « République française ».

STORY: Le visiteur comprend en une ligne ce qu'est le guide, tape son âge, voit sa ligne MRZ se réécrire avec les codes des pays encore possibles et les vignettes éligibles recevoir leur tampon ; il ouvre le guide du pays, puis s'inscrit ou écrit à l'auteur.

FIRST VIEWPORT: Bandeau couverture bordeaux pleine largeur (logo doré, liens). Sous lui, sur papier de sécurité : à gauche le H1 « Partir en PVT » en très grand, sous-titre des 15 destinations, chapeau à la première personne, deux liens vers les piliers. À droite, la vignette d'éligibilité, objet principal : champ âge, choix de durée, compteur de pays, ligne MRZ vivante, bouton « Voir mes destinations ». Bande d'actualité tamponnée en rouge sous le pli.

FORM: Direction « Le Visa », carte IMPECCABLE'S PICK (mon premier candidat ancré), choisie par l'utilisateur à la place de la n°5 tirée. seed:e268ddbae0c05b3a. Interaction signature : le tampon qui se pose (pression, encre, légère rotation) sur l'éligibilité, la checklist cochée et l'inscription ; la ligne MRZ qui se réécrit.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
