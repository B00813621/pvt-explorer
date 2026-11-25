# 05 — Photos, publication et indexation

## Photos (3 par article)

1. **Chercher** sur Wikimedia Commons (commons.wikimedia.org) un lieu précis en anglais : « Bondi Beach », « Twelve Apostles Great Ocean Road », « Melbourne skyline », « Fushimi Inari »…
2. **Licence acceptée** uniquement : CC0, domaine public, CC BY, CC BY-SA. Refuser toute autre licence, les photos de stock et les images générées.
3. **Format** : paysage, au moins 1 500 px de large. Pour la photo à la une, éviter les panoramas plus de 2 fois plus larges que hauts (la page l'affiche en 16:9).
4. **URL à utiliser** : la vignette 1280 px, de la forme
   `https://upload.wikimedia.org/wikipedia/commons/thumb/X/XY/Nom_du_fichier.jpg/1280px-Nom_du_fichier.jpg`
   (lien « Autres résolutions → 1 280 × … » sur la page du fichier). Hauteur = 1280 × hauteur d'origine ÷ largeur d'origine, arrondie.
5. **Texte alternatif** : ce que montre la photo + le lien avec le sujet, moins de 125 caractères, mot-clé seulement s'il est naturel.
6. **Crédit** à mettre en fin d'article : `<p><em>Photo : sujet en français — Auteur, licence, via Wikimedia Commons.</em></p>`
7. **Livrer** pour chaque photo : page Wikimedia, URL 1280 px, dimensions, licence, auteur, alt, crédit, nom de fichier conseillé (`<slug>-<sujet>.webp`).

Option recommandée pour la vitesse du site : dans l'admin, bouton « Photo » de l'éditeur (ou « Choisir » pour l'image à la une) → glisser la photo téléchargée → l'admin la convertit en WebP et l'héberge sur le site ; remplacer ensuite l'URL Wikimedia par la nouvelle.

## Publication dans l'admin (https://pvt-explorer.fr/admin)

1. Se connecter.
2. **Articles** → **Nouvel article** (ou ouvrir l'article à réécrire pour garder son adresse).
3. Sous la barre d'outils de l'éditeur, cliquer **« Importer (ChatGPT, HTML) »**, coller la fiche JSON complète, cliquer **Importer** : titre, adresse, description, mot-clé, catégorie, pays, mots-clés secondaires, image à la une et texte sont remplis.
4. Vérifier le panneau **Référencement** (aperçu Google, contrôles), cliquer **Aperçu** pour voir la page réelle.
5. Choisir l'état **En ligne** (ou **Programmé** avec une date), puis **Enregistrer** (Ctrl ou ⌘ + S).
6. Ouvrir la page publique `https://pvt-explorer.fr/blog/<slug>` et vérifier : sommaire, photos, encadrés, tableaux, FAQ.

Réécriture d'un article existant : ouvrir l'article, importer la fiche par-dessus, enregistrer. L'ancienne version reste dans « Versions précédentes ».

## Indexation Google (Search Console)

1. Ouvrir https://search.google.com/search-console et choisir la propriété **pvt-explorer.fr** (domaine).
2. Coller l'URL complète de l'article dans la barre **« Inspecter n'importe quelle URL »** en haut, valider.
3. Attendre le résultat, puis cliquer **« Demander une indexation »** (ou « Redemander » pour un article mis à jour). Le test prend jusqu'à 2 minutes ; attendre « Indexation demandée ».
4. **Quota** : environ 10 demandes par jour. Au-delà, Google affiche « Quota dépassé » : réessayer le lendemain. Les articles restent découverts via le plan du site (https://pvt-explorer.fr/sitemap.xml, déjà déclaré), seulement plus lentement.
5. Après 2 à 7 jours : vérifier dans **Pages** (indexation) et **Performances** (impressions, clics, position moyenne) ; noter les requêtes réelles qui font venir des visiteurs pour enrichir l'article.

## Suivi (GA4)

Google Analytics 4 (identifiant G-YT7ENEJMXM) ne compte que les visiteurs qui acceptent les cookies. Rapports utiles : **Rapports → Engagement → Pages et écrans** (vues, durée d'engagement) et **Acquisition** (part de Google).

## Mise à jour d'un article (fraîcheur)

- Calendrier : Canada à l'ouverture d'EIC (mi-décembre / janvier) ; Australie au changement de tarifs du 1er juillet et à la rentrée ; toute réforme annoncée par un site officiel.
- Revérifier les chiffres, mettre à jour la mention « Mise à jour pour … », réimporter, redemander l'indexation.
