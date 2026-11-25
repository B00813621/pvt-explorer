# 02 — Gabarit HTML et fiche d'import

L'article est un **fragment HTML** (pas de `<html>`, `<head>`, `<body>` ni `<h1>` : le titre devient le H1 automatiquement). Le site génère tout seul le sommaire, les ancres des titres, les données structurées (BlogPosting, BreadcrumbList, FAQPage) et la mise en forme des encadrés.

## Balises autorisées

| Élément | Syntaxe |
|---|---|
| Paragraphe | `<p>…</p>` |
| Titres | `<h2>…</h2>`, `<h3>…</h3>` (pas d'id, pas de h4) |
| Gras / italique | `<strong>`, `<em>` |
| Liste à puces | `<ul><li>…</li></ul>` |
| Étapes numérotées | `<ol><li>…</li></ol>` |
| Checklist cochable | `<ol><li data-list="unchecked">Étape</li></ol>` |
| Lien interne | `<a href="/blog/slug-exact">ancre descriptive</a>` |
| Lien externe (source officielle) | `<a href="https://…" target="_blank" rel="noopener">…</a>` |
| Photo dans le texte | `<p><img src="URL" alt="…" width="1280" height="…"></p>` |
| Encadré | `<blockquote data-callout="TYPE">…</blockquote>` |

Types d'encadrés (le site affiche l'étiquette) :
- `key` → « À retenir » : chiffres clés (obligatoire en ouverture) ;
- `tip` → « Bon à savoir » : conseil d'expert ;
- `info` → « À noter » : précision, mise à jour, date ;
- `warning` → « Attention » : piège à éviter ;
- `danger` → « Important » : erreur grave (refus, fraude, perte d'argent).

Un encadré peut commencer par « Libellé : » pour remplacer l'étiquette (ex. `<blockquote data-callout="key">📊 À retenir : …</blockquote>`).

## Tableaux : pas de `<thead>`

L'éditeur de l'admin casse les `<thead>`/`<th>`. Écrire la ligne d'en-tête comme première ligne du `<tbody>`, en gras ; le site la transforme en vrai en-tête au rendu :

```html
<table>
<tbody>
<tr><td><strong>Poste</strong></td><td><strong>Prix</strong></td></tr>
<tr><td>Visa 417</td><td>840 AUD</td></tr>
</tbody>
</table>
```

## Squelette d'un article

```html
<p>Réponse directe en 2-3 phrases avec le <strong>mot-clé principal</strong>…</p>
<p>Ce que je vous enseigne dans ce guide…</p>

<blockquote data-callout="key">📊 À retenir : chiffre 1 · chiffre 2 · chiffre 3 (date, source).</blockquote>

<p>Liens vers le cocon : <a href="/blog/pvt-australie">mon guide complet du PVT Australie</a>…</p>

<h2>Question 1 avec le mot-clé</h2>
<p>Réponse directe en une phrase, puis détail.</p>
<table>…</table>

<h2>Question 2</h2>
<p><img src="https://upload.wikimedia.org/wikipedia/commons/thumb/…/1280px-….jpg" alt="Ce que montre la photo, lien avec le sujet" width="1280" height="853"></p>
<h3>Sous-question</h3>
<ul><li>…</li></ul>
<blockquote data-callout="tip">💡 Conseil d'expert : …</blockquote>

<!-- … autres H2 … -->

<h2>Checklist avant le départ</h2>
<ol>
<li data-list="unchecked">Étape 1</li>
<li data-list="unchecked">Étape 2</li>
</ol>

<h2>En résumé</h2>
<p>Récapitulatif + liens vers les 2 prochains articles du parcours.</p>

<h2>FAQ : vos questions sur …</h2>
<h3>Question exacte posée sur Google ?</h3>
<p>Réponse autonome de 40 à 80 mots.</p>
<!-- 6 à 10 questions -->

<p>Sources officielles : <a href="https://…" target="_blank" rel="noopener">Organisme – page</a>.</p>
<p><em>Photo : sujet — Auteur, licence, via Wikimedia Commons.</em></p>
<p><em>Photo : …</em></p>
<p><em>Photo : …</em></p>
```

Règle FAQ : le H2 contient le mot « FAQ », chaque question est un `<h3>`, chaque réponse un ou plusieurs `<p>` juste après. Les lignes « Sources officielles » et « Photo : » qui suivent sont automatiquement exclues des réponses envoyées à Google.

## Fiche JSON d'import (message 3)

À coller dans l'admin : Articles → Nouvel article (ou ouvrir l'article existant) → bouton **« Importer (ChatGPT, HTML) »** sous la barre d'outils → coller → Importer → Enregistrer.

```json
{
  "title": "Titre SEO de 50 à 65 caractères",
  "slug": "slug-court-avec-mot-cle",
  "description": "Meta description de 140 à 158 caractères, en je + vous, avec le mot-clé.",
  "focusKeyword": "mot-clé principal",
  "category": "visa",
  "countries": ["australie"],
  "tags": ["mot-clé secondaire 1", "mot-clé secondaire 2"],
  "image": "https://upload.wikimedia.org/wikipedia/commons/thumb/…/1280px-….jpg",
  "imageAlt": "Texte alternatif de la photo à la une",
  "readingTime": 14,
  "content": "<p>…tout le HTML de l'article sur une seule chaîne JSON…</p>"
}
```

- `category` : une de `visa`, `budget`, `assurance`, `travail`, `vie-pratique`, `vols`, `hébergement`, `activités`, `actualites`.
- `countries` : valeurs exactes de 04-site-et-cocon.md (ex. `australie`, `canada`, `nouvelle-zélande`, `japon`, `corée-du-sud`).
- `content` : HTML échappé pour JSON (guillemets `\"`, pas de retour à la ligne brut, ou `\n`). Le JSON doit être valide : le valider avec l'outil d'analyse de code (`json.loads`) avant de le donner.
- `readingTime` : nombre de mots ÷ 220, arrondi.
