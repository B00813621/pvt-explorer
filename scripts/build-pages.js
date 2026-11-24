'use strict';
// Génère les pages statiques de texte (À propos, mentions légales, confidentialité, confirmation, 404)
// avec le même habillage que les articles (api/blog-render.js). Lancer : npm run build:pages
const fs = require('node:fs');
const path = require('node:path');
const { siteHeader, siteFooter, headCommon, pageScripts, renderNotFound, typoFr } = require('../api/blog-render.js');

const PUB = path.join(__dirname, '..', 'public');
const SITE = 'https://pvt-explorer.fr';

function doc({ file, title, desc, url, robots, active, crumb, h1, lead, body, ld, extraHead = '' }) {
  const html = `<!doctype html>
<html lang="fr">
<head>
${headCommon({ title, desc, url, robots })}
${extraHead}${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body class="page-doc">
${siteHeader(active)}
<main id="contenu">
  <div class="page-edge" aria-hidden="true"></div>
  <article class="wrap doc">
    <header class="doc__head">
      <nav class="crumbs" aria-label="Fil d'Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">${crumb}</li></ol></nav>
      <h1 class="doc__title">${h1}</h1>
      ${lead ? `<p class="article__lead">${lead}</p>` : ''}
    </header>
    <div class="prose">
${body.trim()}
    </div>
  </article>
</main>
${siteFooter()}
${pageScripts()}
</body>
</html>
`;
  fs.writeFileSync(path.join(PUB, file), typoFr(html));
  console.log('écrit', file);
}

doc({
  file: 'a-propos.html',
  title: 'À propos : qui écrit PVT Explorer ? | PVT Explorer',
  desc: 'PVT Explorer est un guide indépendant du PVT écrit par un ancien PVTiste : sources officielles citées, guides datés, aucune agence de visas derrière.',
  url: SITE + '/a-propos',
  active: 'about',
  crumb: 'À propos',
  h1: 'Qui écrit ce guide ?',
  lead: 'Une seule personne : moi. J\'ai fait un PVT, et PVT Explorer est le guide que j\'aurais aimé lire avant de partir.',
  ld: {
    '@context': 'https://schema.org', '@type': 'AboutPage', url: SITE + '/a-propos', name: 'À propos de PVT Explorer', inLanguage: 'fr-FR',
    isPartOf: { '@id': SITE + '/#website' },
    mainEntity: { '@type': 'Organization', '@id': SITE + '/#organization', name: 'PVT Explorer', url: SITE + '/', email: 'pvtexplorer@gmail.com' }
  },
  body: `
<p>PVT Explorer réunit au même endroit ce qu'il faut savoir pour partir en Programme Vacances-Travail : qui peut partir, pour combien de temps, avec quel budget, et dans quel ordre faire les démarches. Je compare les 15 destinations ouvertes aux Français et j'écris un guide détaillé pour chaque étape, en commençant par l'Australie et le Canada.</p>

<h2 id="methode">Comment je travaille</h2>
<ul>
<li><strong>Je pars des sources officielles.</strong> Department of Home Affairs pour l'Australie, IRCC pour le Canada, Immigration New Zealand, ambassades et consulats pour les autres pays. Chaque guide cite ses sources.</li>
<li><strong>Chaque guide est daté.</strong> Les tarifs et les quotas changent, en Australie souvent au 1er juillet. La date de mise à jour figure en tête de chaque article.</li>
<li><strong>Les montants sont indicatifs.</strong> Ils servent à préparer un budget. Avant de payer quoi que ce soit, vérifiez toujours le site officiel du pays.</li>
</ul>

<h2 id="independance">Ce que ce site n'est pas</h2>
<p>Je ne suis ni un organisme officiel ni une agence de visas : je ne dépose aucune demande à votre place et je ne vends aucun visa. Le site n'est affilié à aucun gouvernement.</p>
<p>PVT Explorer ne me rapporte rien à ce jour. Si un lien devient affilié, je le signale à côté du lien et dans les <a href="/mentions-legales.html">mentions légales</a>.</p>

<h2 id="contact">Me contacter</h2>
<p>Une question sur votre PVT, une erreur repérée dans un guide ? Écrivez-moi depuis <a href="/#ecrire">le formulaire de la page d'accueil</a> ou à <a href="mailto:pvtexplorer@gmail.com">pvtexplorer@gmail.com</a>. Je lis chaque message.</p>
`
});

doc({
  file: 'mentions-legales.html',
  title: 'Mentions légales | PVT Explorer',
  desc: 'Mentions légales du site PVT Explorer : éditeur, hébergeur, propriété intellectuelle et responsabilité éditoriale.',
  url: SITE + '/mentions-legales.html',
  robots: 'noindex,follow',
  crumb: 'Mentions légales',
  h1: 'Mentions légales',
  lead: 'Conformément à l\'article 6 de la loi n° 2004-575 du 21 juin 2004 pour la confiance dans l\'économie numérique (LCEN), voici les informations relatives à l\'éditeur et à l\'hébergeur du site <strong>pvt-explorer.fr</strong>.',
  body: `
<h2 id="editeur">Éditeur du site</h2>
<p>Le site est édité par une personne physique, à titre non professionnel. Conformément à l'article 6-III-2 de la LCEN, l'éditeur a choisi de préserver son anonymat : ses coordonnées complètes ont été communiquées à l'hébergeur ci-dessous.</p>
<p>Contact : <a href="mailto:pvtexplorer@gmail.com">pvtexplorer@gmail.com</a></p>

<h2 id="hebergement">Hébergement</h2>
<p>Le site et ses données sont hébergés par <strong>Vercel Inc.</strong>, 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis (<a href="https://vercel.com" rel="noopener">vercel.com</a>).</p>

<h2 id="propriete">Propriété intellectuelle</h2>
<p>Les textes, la structure et la charte graphique du site sont protégés par le droit d'auteur. Toute reproduction substantielle sans autorisation est interdite. Les photographies issues de Wikimedia Commons sont utilisées selon leur licence (CC0, CC BY ou CC BY-SA) et créditées sous chaque article.</p>

<h2 id="affiliation">Liens d'affiliation et publicité</h2>
<p>Le site ne perçoit à ce jour aucune rémunération. Si des liens affiliés ou des contenus sponsorisés sont mis en place, ils seront clairement signalés et ces mentions seront mises à jour.</p>

<h2 id="responsabilite">Responsabilité éditoriale</h2>
<p>Les informations publiées sur les visas, l'immigration, le travail, la santé, les assurances et les budgets sont fournies à titre indicatif et peuvent évoluer. Elles ne remplacent pas les sources officielles (Department of Home Affairs, IRCC, Immigration New Zealand, ambassades…). Vérifiez-les toujours auprès des autorités et prestataires compétents avant toute décision.</p>

<h2 id="donnees">Données personnelles</h2>
<p>Le traitement des données personnelles est décrit dans la <a href="/confidentialite.html">politique de confidentialité</a>.</p>
`
});

doc({
  file: 'confidentialite.html',
  title: 'Politique de confidentialité | PVT Explorer',
  desc: 'Données traitées par PVT Explorer, durées de conservation, sous-traitants, mesure d\'audience avec consentement et exercice de vos droits.',
  url: SITE + '/confidentialite.html',
  robots: 'noindex,follow',
  crumb: 'Confidentialité',
  h1: 'Politique de confidentialité',
  lead: 'Dernière mise à jour : <time datetime="2026-11-23">23 novembre 2026</time>.',
  body: `
<h2 id="responsable">Responsable du traitement</h2>
<p>L'éditeur du site, personne physique agissant à titre non professionnel, joignable à <a href="mailto:pvtexplorer@gmail.com">pvtexplorer@gmail.com</a>.</p>

<h2 id="donnees">Données traitées</h2>
<div class="registre-wrap" tabindex="0" role="region" aria-label="Données traitées"><table class="registre">
<thead><tr><th scope="col">Traitement</th><th scope="col">Données</th><th scope="col">Finalité et base légale</th><th scope="col">Conservation</th></tr></thead>
<tbody>
<tr><td>Formulaire de contact</td><td>Prénom, e-mail, message</td><td>Répondre à votre demande (intérêt légitime / mesures précontractuelles)</td><td>12 mois après le dernier échange</td></tr>
<tr><td>Newsletter (si vous vous inscrivez)</td><td>E-mail</td><td>Envoi de la newsletter, avec double confirmation (consentement)</td><td>Jusqu'à la désinscription</td></tr>
<tr><td>Questions et réponses publiées</td><td>Pseudo facultatif, texte publié</td><td>Animation de l'espace d'entraide, après modération (intérêt légitime)</td><td>Tant que le contenu est en ligne</td></tr>
<tr><td>Mesure d'audience (Google Analytics 4)</td><td>Pages vues, durée, provenance, type d'appareil, identifiant de cookie</td><td>Statistiques de fréquentation (consentement)</td><td>Cookies 13 mois maximum ; données détaillées conservées 2 mois dans Google Analytics</td></tr>
<tr><td>Journaux techniques</td><td>Adresse IP, date, page demandée</td><td>Sécurité et bon fonctionnement du site (intérêt légitime)</td><td>Durée courte fixée par l'hébergeur</td></tr>
</tbody>
</table></div>
<p>Ne transmettez pas de données sensibles (santé, situation judiciaire, numéros de passeport…) dans les formulaires.</p>

<h2 id="destinataires">Destinataires et sous-traitants</h2>
<ul>
<li><strong>Vercel Inc.</strong> (États-Unis) : hébergement du site et stockage des données ;</li>
<li><strong>Resend</strong> (États-Unis) : envoi des e-mails liés au formulaire de contact ;</li>
<li><strong>Brevo</strong> (France) : gestion de la newsletter, si elle est activée ;</li>
<li><strong>Google Ireland Ltd</strong> : mesure d'audience, uniquement avec votre accord.</li>
</ul>
<p>Certains de ces prestataires peuvent traiter des données aux États-Unis. Ces transferts sont encadrés par le Data Privacy Framework UE–États-Unis ou par les clauses contractuelles types de la Commission européenne. Les polices de caractères du site sont hébergées sur le site lui-même : aucune requête n'est envoyée à Google Fonts.</p>

<h2 id="audience">Mesure d'audience (Google Analytics 4)</h2>
<p>Avec votre accord uniquement, le site utilise Google Analytics 4 pour mesurer son audience. Le script de Google et les cookies <code>_ga</code> et <code>_ga_*</code> ne sont chargés qu'après un clic sur « Accepter » dans le bandeau. Votre choix est mémorisé 13 mois sur votre appareil. Vous pouvez le modifier à tout moment via le lien « Gérer les cookies », présent en bas de chaque page. Refuser n'a aucune conséquence sur l'accès au site.</p>

<h2 id="affiliation">Liens d'affiliation</h2>
<p>Lorsque vous cliquez sur un lien affilié, le site partenaire (Amazon, assureur, comparateur…) peut déposer ses propres cookies selon sa politique de confidentialité, que je vous invite à consulter.</p>

<h2 id="droits">Vos droits</h2>
<p>Vous disposez d'un droit d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité de vos données, ainsi que du droit de retirer votre consentement à tout moment. Pour les exercer, écrivez à <a href="mailto:pvtexplorer@gmail.com">pvtexplorer@gmail.com</a>. Si vous estimez que vos droits ne sont pas respectés, vous pouvez adresser une réclamation à la CNIL (<a href="https://www.cnil.fr" rel="noopener">cnil.fr</a>).</p>
`
});

doc({
  file: 'inscription-confirmee.html',
  title: 'Inscription confirmée | PVT Explorer',
  desc: '',
  url: '',
  robots: 'noindex,nofollow',
  crumb: 'Inscription confirmée',
  h1: 'Merci, votre inscription est confirmée',
  lead: 'Vous recevrez mes prochaines mises à jour : tarifs qui changent, quotas, nouveaux guides. Chaque e-mail contient un lien pour vous désinscrire en un clic.',
  body: `
<p><span class="stamp stamp--green" style="--rot:-6deg">Inscrit</span></p>
<p>En attendant, le plus utile est sans doute de vérifier quels PVT vous sont ouverts selon votre âge, puis de lire le guide de votre destination.</p>
<p><a class="btn" href="/#eligibilite">Vérifier mes destinations</a> <a class="btn btn--line" href="/nos-astuces">Tous les guides</a></p>
`
});

fs.writeFileSync(path.join(PUB, '404.html'), renderNotFound());
console.log('écrit 404.html');
