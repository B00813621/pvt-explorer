# GPT « Rédacteur PVT Explorer » — installation et utilisation

Ce dossier permet de créer dans ChatGPT un assistant qui reproduit la méthode utilisée pour les articles de pvt-explorer.fr : analyse des 3 premiers résultats Google, structure fusionnée, vérification des faits officiels, article long en « je + vous » optimisé SEO et GEO avec photos, tableaux, encadrés et FAQ finale, contrôle qualité, puis publication dans l'admin et indexation dans Search Console.

| Fichier | Rôle |
|---|---|
| `instructions.md` | À coller dans le champ « Instructions » du GPT (5 600 caractères, limite 8 000) |
| `connaissances/01-methode.md` | La méthode détaillée, étape par étape |
| `connaissances/02-gabarit-html.md` | Le format HTML exact et la fiche JSON d'import |
| `connaissances/03-controle-qualite.md` | Le script de contrôle que le GPT exécute avant de livrer |
| `connaissances/04-site-et-cocon.md` | Les 103 articles du site (en ligne / prévus), slugs, catégories, pays, maillage |
| `connaissances/05-photos-publication-indexation.md` | Photos libres de droits, publication dans l'admin, indexation Google |

Il faut un abonnement ChatGPT payant (Plus, Pro, Team…) pour créer un GPT.

## 1. Créer le GPT (10 minutes)

1. Sur chatgpt.com : menu de gauche → **GPT** → **+ Créer** → onglet **Configurer**.
2. **Nom** : `Rédacteur PVT Explorer`
3. **Description** : `Rédige un article de blog PVT long et sourcé, optimisé SEO et GEO, à partir de l'analyse des 3 premiers résultats Google.`
4. **Instructions** : copier tout le contenu de `instructions.md`.
5. **Amorces de conversation** :
   - `Rédige l'article « Les 88 jours en Australie » (réécriture, réforme 2027)`
   - `Analyse le top 3 Google pour « assurance pvt canada » et propose une structure`
   - `Quel est le prochain article à écrire dans le cocon Australie ?`
   - `Mets à jour l'article PVT Canada 2027 avec les annonces officielles`
6. **Connaissances** : téléverser les 5 fichiers du dossier `connaissances/`.
7. **Fonctionnalités** : cocher **Recherche sur le Web**, **Canevas** et **Interpréteur de code et analyse de données**. Laisser la génération d'images décochée (les photos viennent de Wikimedia Commons).
8. **Créer** → partage : **Moi uniquement**.

Variante sans GPT : créer un **Projet** ChatGPT, coller `instructions.md` dans les instructions du projet et ajouter les 5 fichiers. Le fonctionnement est identique.

## 2. Rédiger un article

1. Ouvrir le GPT et donner un sujet ou un titre (« Rédige l'article sur le TFN en Australie »).
2. **Message 1** : le GPT analyse les 3 premiers résultats Google, vérifie les faits officiels et propose la structure. Relire, corriger si besoin, puis répondre « Oui, rédige ».
3. **Message 2** : l'article s'écrit dans un canevas, puis le GPT lance son contrôle qualité et corrige jusqu'à « Tout est conforme ».
4. **Message 3** : la fiche JSON d'import, les 3 photos (liens, crédits, textes alternatifs), la procédure de publication et d'indexation, et le compte rendu.

Un article par conversation : ouvrir une nouvelle conversation pour le suivant, afin que le GPT reste concentré.

## 3. Publier et indexer

1. https://pvt-explorer.fr/admin → **Articles** → **Nouvel article** (ou l'article existant à réécrire).
2. Bouton **« Importer (ChatGPT, HTML) »** sous la barre d'outils de l'éditeur → coller la fiche JSON → **Importer**.
3. (Recommandé) Remplacer les photos Wikimedia par les mêmes photos téléversées avec le bouton **Photo** (converties en WebP, plus rapides).
4. Vérifier avec **Aperçu**, choisir **En ligne**, **Enregistrer**.
5. Search Console → **Inspecter l'URL** → **Demander une indexation** (environ 10 par jour).

## 4. Ce que le GPT ne peut pas faire seul

- Se connecter à l'admin ou à Search Console : la publication et la demande d'indexation restent manuelles (2 minutes).
- Lire certains sites officiels qui bloquent les robots (ex. immi.homeaffairs.gov.au peut répondre 403) : le GPT doit alors le signaler ; vérifier soi-même la page dans un navigateur.
- Télécharger et convertir les photos : il donne les liens et les crédits, vous téléversez si vous voulez du WebP.

## 5. Garder le GPT à jour

- `04-site-et-cocon.md` liste les articles en ligne : le régénérer après chaque série de publications (dans Claude Code : demander « régénère le fichier 04 du GPT »), puis le remplacer dans les connaissances du GPT.
- Les faits datés de `01-methode.md` (tarifs, réformes) sont un point de départ : le GPT doit toujours les revérifier, mais les mettre à jour évite qu'il s'appuie sur des chiffres anciens.
