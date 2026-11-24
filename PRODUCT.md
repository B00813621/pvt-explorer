# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primaire :** jeunes Français de 18 à 35 ans qui envisagent ou préparent un Programme Vacances-Travail (PVT, « working holiday visa »). Deux moments : la recherche (quel pays, quelles conditions, combien) puis la préparation (visa, budget, assurance, premières démarches sur place).
- Ils arrivent surtout depuis Google, souvent sur mobile, avec une requête précise : « pvt + pays », « budget pvt australie », « 88 jours », « tfn australie », « assurance pvt ».
- **Leur travail :** décider où partir, savoir exactement quoi faire et dans quel ordre, partir sans mauvaise surprise.

## Product Purpose

PVT Explorer est un guide éditorial indépendant, en français, sur le PVT : les 15 destinations accessibles aux Français comparées, et des guides détaillés par pays et par démarche (visa, budget, travail, assurance, vie pratique).

Succès : être la réponse de référence sur Google pour « pvt » et « pvt + pays », que le lecteur trouve sa réponse sans chercher ailleurs, puis revienne ou s'inscrive à la newsletter.

## Positioning

Écrit à la première personne par un auteur qui a lui-même fait un PVT, indépendant de tout organisme et sans rémunération à ce jour. Des guides longs, datés et sourcés (Department of Home Affairs, IRCC, Immigration New Zealand, ambassades), organisés en cocon sémantique : un pilier par pays, des satellites par démarche.

## Operating Context

- Lecture majoritairement mobile depuis Google ; lecture longue des guides ; checklists cochables dans les articles (progression gardée dans le navigateur).
- Calendrier saisonnier : Canada à l'ouverture d'EIC (mi-décembre / janvier), Australie à la rentrée (septembre-octobre) et au changement de tarifs du 1er juillet.
- Les internautes tapent « PVT », pas « WHV » ni « visa vacances-travail » (Google Trends, 23/11/2026, `docs/analyse-google-trends.md`).

## Capabilities and Constraints

- Site statique HTML/CSS/JS sans framework dans `public/`, déployé sur Vercel par `build.sh` (Build Output API v3). Fonctions serverless dans `api/` : catch-all `api/[...path].js` et redirections partenaires `api/go.js`.
- Articles stockés dans Vercel Blob (`data/blog-posts.json`), écrits dans `/admin` (éditeur Quill), rendus côté serveur par `api/blog-render.js` : JSON-LD BlogPosting, BreadcrumbList, FAQPage, sommaire, checklists.
- Plan éditorial de 103 articles (`api/blog-plan.json`, `docs/plan-editorial-100-articles.md`), cocon PVT Australie (`docs/cocon-pvt-australie.md`).
- Fonctions du site : fiches et comparateur des 15 destinations, carte interactive, FAQ, formulaire de contact (Resend), newsletter Brevo à double opt-in (si configurée), questions/réponses modérées, liens partenaires via `/go/:slug` (non affiliés à ce jour), sélection Amazon (tag partenaire si configuré), sitemap dynamique.
- Mesure d'audience GA4 chargée uniquement après consentement (`public/analytics.js`).
- Domaine canonique : https://pvt-explorer.fr (www redirigé en 308).
- Développement local : `npm run dev` (reproduit le routage Vercel, articles rédigés du plan servis comme publiés).

## Brand Commitments

- Nom : PVT Explorer. Domaine : pvt-explorer.fr. Contact : pvtexplorer@gmail.com.
- Voix : « je » et vouvoiement partout (pages, articles, formulaires, e-mails, bandeau cookies). Un seul auteur : jamais « notre équipe ».
- Indépendance : non affilié à un gouvernement ; toute relation commerciale est signalée ; les informations visa sont indicatives et renvoient aux sources officielles.

## Evidence on Hand

- 11 articles rédigés (`content/articles/*.html`, `api/blog-plan.json`), dont le pilier PVT Australie (~3 000 mots).
- Photos d'articles en WebP dans `public/images/blog/` ; photos Wikimedia Commons créditées sous chaque article.
- Données indicatives des 15 destinations (âge, durée, budget, liens officiels) dans `public/index.html`.
- Absences à ne jamais combler par de l'invention : aucun témoignage réel, aucun chiffre d'audience, aucune presse, aucun partenaire actif, aucune équipe. Le pays du PVT de l'auteur n'est pas encore précisé.

## Product Principles

1. La réponse d'abord : chaque page répond à la question tapée sur Google avant de raconter.
2. Vérifiable : date de mise à jour visible, sources officielles liées, montants marqués comme indicatifs.
3. Une voix humaine et unique : quelqu'un qui a vécu un PVT et qui écrit, pas une rédaction anonyme.
4. Tout se relie : chaque page mène au pilier du pays et à l'étape suivante.
5. Honnêteté commerciale : aucun lien partenaire déguisé, aucun faux avis.
