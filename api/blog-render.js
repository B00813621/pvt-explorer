'use strict';
// Rendu serveur des pages éditoriales (articles, index des guides, 404) dans le monde « Le Visa » :
// nettoyage du HTML de l'éditeur (Quill 2), encadrés tamponnés, sommaire, checklist, liens internes,
// articles liés et données structurées (BlogPosting, BreadcrumbList, FAQPage, CollectionPage).

const SITE = 'https://pvt-explorer.fr';

const CAT_LABELS = { vols: 'Vols', hébergement: 'Hébergement', assurance: 'Assurance', budget: 'Budget', visa: 'Visa', travail: 'Travail', 'vie-pratique': 'Vie pratique', activités: 'Activités' };

const COUNTRIES = {
  australie: { name: 'Australie', iso: 'AUS', pillar: 'pvt-australie' },
  canada: { name: 'Canada', iso: 'CAN', pillar: 'pvt-canada-2027' },
  'nouvelle-zélande': { name: 'Nouvelle-Zélande', iso: 'NZL', pillar: 'pvt-nouvelle-zelande' },
  japon: { name: 'Japon', iso: 'JPN', pillar: 'pvt-japon' },
  'corée-du-sud': { name: 'Corée du Sud', iso: 'KOR', pillar: 'pvt-coree-du-sud' },
  'hong-kong': { name: 'Hong Kong', iso: 'HKG' },
  'taïwan': { name: 'Taïwan', iso: 'TWN' },
  argentine: { name: 'Argentine', iso: 'ARG' },
  'brésil': { name: 'Brésil', iso: 'BRA' },
  chili: { name: 'Chili', iso: 'CHL' },
  colombie: { name: 'Colombie', iso: 'COL' },
  'équateur': { name: 'Équateur', iso: 'ECU' },
  mexique: { name: 'Mexique', iso: 'MEX' },
  'pérou': { name: 'Pérou', iso: 'PER' },
  uruguay: { name: 'Uruguay', iso: 'URY' }
};
const COUNTRY_ORDER = Object.keys(COUNTRIES);

// Miniatures 500 px hébergées sur le site (public/images/miniatures/<slug>.jpg) ; sinon l'image de l'article
const MINIATURES = new Set(['pvt-australie', 'pvt-canada-2027', 'pvt-nouvelle-zelande', 'pvt-japon', 'pvt-coree-du-sud',
  'budget-pvt-australie', 'assurance-pvt-australie', 'tuto-immiaccount-pvt-australie', 'tfn-australie-tax-file-number',
  'trouver-travail-australie-pvt', '88-jours-pvt-australie-specified-work']);
function thumbOf(p) {
  if (MINIATURES.has(p.slug)) return `/images/miniatures/${p.slug}.jpg`;
  return p.image || '';
}
function thumbImg(p, cls) {
  const src = thumbOf(p);
  return src ? `<img class="${cls}" src="${htmlEsc(src)}" alt="" width="500" height="333" loading="lazy" decoding="async">` : '';
}

const NOTE_DEFAULTS = {
  tip: ['Bon à savoir', 'cover'], info: ['À noter', 'ink'], warning: ['Attention', 'red'],
  danger: ['Important', 'red'], key: ['À retenir', 'cover']
};

const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function htmlEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
}
function slugId(s) {
  return stripTags(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/, '');
}
function ldJson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}
// Espaces insécables fines de la typographie française, hors balises, scripts et styles
function typoFr(html) {
  return String(html).split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/).map((part, i) => {
    if (i % 2) return part;
    return part.replace(/[  ]+([?!;:»])/g, ' $1').replace(/«[  ]+/g, '« ');
  }).join('');
}
function frDate(iso, opts = { year: 'numeric', month: 'long', day: 'numeric' }) {
  if (!iso) return '';
  const d = new Date(iso);
  return isNaN(d) ? '' : d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', ...opts });
}
function stamp(label, tone, rot = -4, attrs = '') {
  return `<span class="stamp stamp--${tone}" style="--rot:${rot}deg"${attrs}>${htmlEsc(label)}</span>`;
}

// ---------- Habillage commun ----------
function siteHeader(active = '') {
  const cur = key => (key === active ? ' aria-current="page"' : '');
  return `<a class="skip" href="#contenu">Aller au contenu</a>
<header class="cover">
  <div class="wrap cover__bar">
    <a class="brand" href="/" aria-label="PVT Explorer, accueil"><span class="brand__logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path transform="rotate(90 12 12)" d="M12 2.5c.8 0 1.4.9 1.4 2.2v5.1l7.1 4.3v1.9l-7.1-2.1v4.6l2 1.5v1.5L12 20.6l-3.4.9V20l2-1.5v-4.6l-7.1 2.1v-1.9l7.1-4.3V4.7c0-1.3.6-2.2 1.4-2.2Z"/></svg></span><span class="brand__mot">PVT <em>Explorer</em></span></a>
    <button class="cover__toggle" type="button" aria-expanded="false" aria-controls="menu">Menu</button>
    <nav id="menu" aria-label="Navigation principale">
      <ul class="cover__links">
        <li><a href="/#destinations">Destinations</a></li>
        <li><a href="/#comparer">Comparer</a></li>
        <li class="cover__deroulant"><a class="cover__blog" href="/nos-astuces"${cur('guides')}>Nos astuces <span aria-hidden="true">|</span> Blog</a><button class="cover__ouvrir" type="button" aria-expanded="false" aria-controls="menu-astuces"><span class="visually-hidden">Trier les articles par pays ou par thème</span><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button><div class="cover__sous" id="menu-astuces"><div><p class="cover__sous-titre">Par pays</p><ul><li><a href="/nos-astuces?pays=australie">Australie</a></li><li><a href="/nos-astuces?pays=canada">Canada</a></li><li><a href="/nos-astuces?pays=nouvelle-z%C3%A9lande">Nouvelle-Zélande</a></li><li><a href="/nos-astuces?pays=japon">Japon</a></li><li><a href="/nos-astuces?pays=cor%C3%A9e-du-sud">Corée du Sud</a></li></ul></div><div><p class="cover__sous-titre">Par thème</p><ul><li><a href="/nos-astuces?categorie=visa">Visa</a></li><li><a href="/nos-astuces?categorie=budget">Budget</a></li><li><a href="/nos-astuces?categorie=assurance">Assurance</a></li><li><a href="/nos-astuces?categorie=travail">Travail</a></li><li><a href="/nos-astuces?categorie=vie-pratique">Vie pratique</a></li></ul></div><a class="cover__tous" href="/nos-astuces">Tous les articles</a></div></li>
        <li><a href="/a-propos"${cur('about')}>À propos</a></li>
        <li><a href="/#ecrire">Écrire</a></li>
      </ul>
    </nav>
  </div>
</header>`;
}

function siteFooter() {
  return `<footer class="backcover">
  <div class="wrap">
    <div class="backcover__grid">
      <div>
        <a class="brand" href="/"><span class="brand__logo" aria-hidden="true"><svg viewBox="0 0 24 24"><path transform="rotate(90 12 12)" d="M12 2.5c.8 0 1.4.9 1.4 2.2v5.1l7.1 4.3v1.9l-7.1-2.1v4.6l2 1.5v1.5L12 20.6l-3.4.9V20l2-1.5v-4.6l-7.1 2.1v-1.9l7.1-4.3V4.7c0-1.3.6-2.2 1.4-2.2Z"/></svg></span><span class="brand__mot">PVT <em>Explorer</em></span></a>
        <p class="backcover__about">Le guide indépendant du Programme Vacances-Travail, écrit par quelqu'un qui en a fait un. Non affilié à un gouvernement ni à un organisme de visas.</p>
        <p class="mrz" aria-hidden="true">PVT&lt;EXPLORER&lt;&lt;GUIDE&lt;INDEPENDANT&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</p>
      </div>
      <nav aria-labelledby="pied-destinations">
        <h2 id="pied-destinations">Destinations</h2>
        <ul>
          <li><a href="/blog/pvt-australie">PVT Australie</a></li>
          <li><a href="/blog/pvt-canada-2027">PVT Canada</a></li>
          <li><a href="/blog/pvt-nouvelle-zelande">PVT Nouvelle-Zélande</a></li>
          <li><a href="/blog/pvt-japon">PVT Japon</a></li>
          <li><a href="/blog/pvt-coree-du-sud">PVT Corée du Sud</a></li>
          <li><a href="/#destinations">Les 15 destinations</a></li>
        </ul>
      </nav>
      <nav aria-labelledby="pied-guides">
        <h2 id="pied-guides">Guides</h2>
        <ul>
          <li><a href="/nos-astuces">Tous les guides</a></li>
          <li><a href="/blog/budget-pvt-australie">Budget PVT Australie</a></li>
          <li><a href="/blog/assurance-pvt-australie">Assurance PVT Australie</a></li>
          <li><a href="/blog/tuto-immiaccount-pvt-australie">Tuto ImmiAccount</a></li>
          <li><a href="/blog/88-jours-pvt-australie-specified-work">Les 88 jours</a></li>
        </ul>
      </nav>
      <nav aria-labelledby="pied-site">
        <h2 id="pied-site">Le site</h2>
        <ul>
          <li><a href="/a-propos">À propos</a></li>
          <li><a href="/#ecrire">Écrire à l'auteur</a></li>
          <li><a href="/mentions-legales.html">Mentions légales</a></li>
          <li><a href="/confidentialite.html">Confidentialité</a></li>
          <li><button type="button" class="linklike" data-cookie-settings>Gérer les cookies</button></li>
        </ul>
      </nav>
    </div>
    <div class="backcover__legal">
      <p>Informations indicatives, vérifiées à la date indiquée dans chaque guide. Les conditions de visa changent : confirmez-les toujours auprès des autorités du pays (Department of Home Affairs, IRCC, Immigration New Zealand, ambassades).</p>
      <p>© 2026 PVT Explorer</p>
    </div>
  </div>
</footer>`;
}

function headCommon({ title, desc, url, robots = 'index,follow,max-image-preview:large' }) {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${desc ? `<meta name="description" content="${desc}">` : ''}
<meta name="robots" content="${robots}">
${url ? `<link rel="canonical" href="${htmlEsc(url)}">` : ''}
<meta name="theme-color" content="#055a56">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<link rel="preload" href="/fonts/archivo-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/css/site.css">`;
}

function pageScripts(extra = '') {
  return `<script src="/app-config.js"></script>
<script src="/analytics.js" defer></script>
<script src="/js/visa.js" defer></script>
<script type="module" src="/js/speed-insights.js"></script>${extra}`;
}

// ---------- Contenu de l'éditeur ----------
function renderList(kind, items) {
  if (kind === 'ordered') return `<ol>${items.map(i => `<li>${i.body}</li>`).join('')}</ol>`;
  if (kind === 'bullet') return `<ul>${items.map(i => `<li>${i.body}</li>`).join('')}</ul>`;
  return `<div class="checklist-box"><div class="checklist-head"><span class="label">À faire avant de partir</span><span class="checklist-progress data" aria-live="polite"></span></div>` +
    `<span class="checklist-bar" aria-hidden="true"><span></span></span>` +
    `<ul class="checklist">${items.map(i => `<li><label><input type="checkbox"${i.checked ? ' checked' : ''}><span>${i.body}</span></label></li>`).join('')}</ul></div>`;
}

function renderNote(type, inner) {
  const [defLabel, tone] = NOTE_DEFAULTS[type] || ['À noter', 'ink'];
  let body = inner.replace(/^\s*(?:\p{Extended_Pictographic}|️|‍)+\s*/u, '');
  let label = defLabel;
  const m = body.match(/^([^<:.!?]{3,30}?)\s*:\s+/);
  if (m) {
    label = m[1].trim();
    body = body.slice(m[0].length);
    body = body.charAt(0).toUpperCase() + body.slice(1);
  }
  const wrapped = /<(p|ul|ol|div)\b/.test(body) ? body : `<p>${body}</p>`;
  return `<div class="note note--${tone}" role="note">${stamp(label, tone, type === 'warning' || type === 'danger' ? -3 : -5)}<div class="note__body">${wrapped}</div></div>`;
}

/**
 * Normalise le HTML d'un article pour le rendu public.
 * opts.publishedSlugs : Set des slugs publiés — un lien /blog/<slug> vers un article non publié
 * est remplacé par son texte (pas de lien cassé ; il réapparaît dès la publication).
 * Retourne { html, toc, faq, words }.
 */
function normalizeContent(input, opts = {}) {
  let h = String(input || '');

  // 1. Débris de l'éditeur
  h = h.replace(/<span class="ql-ui"[^>]*>\s*<\/span>/g, '')
    .replace(/\s(?:data-row|contenteditable|spellcheck|data-indent)="[^"]*"/g, '')
    .replace(/<p>(?:\s|<br\s*\/?>)*<\/p>/g, '');

  // 2. Listes : Quill 2 écrit toutes les listes en <ol><li data-list="bullet|ordered|checked|unchecked">
  h = h.replace(/<(ol|ul)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g, (whole, tag, inner) => {
    const items = [...inner.matchAll(/<li([^>]*)>([\s\S]*?)<\/li>/g)];
    if (!items.length) return whole;
    const groups = [];
    for (const [, attrs, body] of items) {
      const t = (attrs.match(/data-list="([a-z]+)"/) || [])[1] || (tag === 'ul' ? 'bullet' : 'ordered');
      const kind = t === 'checked' || t === 'unchecked' ? 'check' : t === 'bullet' ? 'bullet' : 'ordered';
      const item = { body: body.trim(), checked: t === 'checked' };
      const last = groups[groups.length - 1];
      if (last && last.kind === kind) last.items.push(item); else groups.push({ kind, items: [item] });
    }
    return groups.map(g => renderList(g.kind, g.items)).join('');
  });

  // 3. Tableaux : 1re ligne promue en <thead>/<th> si l'éditeur l'a aplatie, + conteneur défilant sur mobile
  h = h.replace(/<table(?:\s[^>]*)?>([\s\S]*?)<\/table>/g, (whole, inner) => {
    if (/<thead/.test(inner)) {
      inner = inner.replace(/<th(?=[\s>])(?![^>]*scope=)([^>]*)>/g, '<th scope="col"$1>');
      return `<div class="registre-wrap" tabindex="0" role="region" aria-label="Tableau"><table class="registre">${inner}</table></div>`;
    }
    const rows = [...inner.replace(/<\/?tbody[^>]*>/g, '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(r => r[1]);
    if (!rows.length) return whole;
    const head = rows[0].replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g, (x, c) => `<th scope="col">${c.replace(/<\/?strong>/g, '')}</th>`);
    return `<div class="registre-wrap" tabindex="0" role="region" aria-label="Tableau"><table class="registre"><thead><tr>${head}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r}</tr>`).join('')}</tbody></table></div>`;
  });

  // 4. Encadrés de l'éditeur : l'étiquette de l'auteur devient le tampon, l'emoji disparaît
  h = h.replace(/<blockquote data-callout="(\w+)"[^>]*>([\s\S]*?)<\/blockquote>/g, (w, type, inner) => renderNote(type, inner.trim()));

  // 5. Liens internes : URL relative, pas de nouvel onglet, et masqués si la cible n'est pas publiée
  h = h.replace(/<a\s[^>]*?href="(?:https?:\/\/(?:www\.)?pvt-explorer\.fr)?\/blog\/([^"#?]+)([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (whole, slug, rest, text) => {
    let s = slug;
    try { s = decodeURIComponent(slug); } catch {}
    if (opts.publishedSlugs && !opts.publishedSlugs.has(s)) return text;
    return `<a href="/blog/${slug}${rest}">${text}</a>`;
  });
  h = h.replace(/<a\s[^>]*?href="(\/(?!\/)[^"]*)"[^>]*>/g, (whole, href) => `<a href="${href}">`);
  h = h.replace(/<a\s([^>]*?)target="_blank"(?![^>]*rel=)([^>]*)>/g, '<a $1target="_blank" rel="noopener"$2>');

  // 6. Images du corps : chargement différé
  h = h.replace(/<img(?![^>]*loading=)/g, '<img loading="lazy" decoding="async"');

  // 7. Titres H2 : ancres + sommaire
  const toc = [];
  const used = new Set();
  h = h.replace(/<h2([^>]*)>([\s\S]*?)<\/h2>/g, (whole, attrs, inner) => {
    let id = (attrs.match(/\sid="([^"]+)"/) || [])[1] || slugId(inner) || 'section';
    const base = id;
    let n = 2;
    while (used.has(id)) id = `${base}-${n++}`;
    used.add(id);
    toc.push({ id, text: stripTags(inner) });
    return `<h2 id="${id}">${inner}</h2>`;
  });

  h = typoFr(h);
  return { html: h, toc, faq: extractFaq(h), words: stripTags(h).split(' ').filter(Boolean).length };
}

// Questions/réponses de la section « FAQ » (h2 contenant FAQ, puis h3 question + contenu réponse)
function extractFaq(html) {
  const m = String(html || '').match(/<h2[^>]*>[^<]*FAQ[\s\S]*?<\/h2>([\s\S]*?)(?=<h2|$)/i);
  if (!m) return null;
  const items = [];
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi;
  let q;
  while ((q = re.exec(m[1]))) {
    const name = stripTags(q[1]).replace(/ /g, ' '), text = stripTags(q[2]).replace(/ /g, ' ');
    if (name && text) items.push({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } });
  }
  return items.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items } : null;
}

// Articles proches : même pays d'abord, pilier du pays en tête, puis même catégorie
function relatedPosts(post, pool, n = 3) {
  const own = new Set(post.countries || []);
  const pillars = new Set([...own].map(c => COUNTRIES[c] && COUNTRIES[c].pillar).filter(Boolean));
  const scored = (pool || []).filter(p => p.slug && p.slug !== post.slug).map(p => {
    let s = 0;
    (p.countries || []).forEach(c => { if (own.has(c)) s += 3; });
    if (pillars.has(p.slug)) s += 4;
    if (p.category && p.category === post.category) s += 2;
    return { p, s };
  });
  scored.sort((a, b) => b.s - a.s || new Date(b.p.publishedAt || 0) - new Date(a.p.publishedAt || 0));
  return scored.slice(0, n).map(x => x.p);
}

function countryOf(post) {
  const c = (post.countries || [])[0];
  return c && COUNTRIES[c] ? { key: c, ...COUNTRIES[c] } : null;
}

const CHECKLIST_JS = `(function(){var k='pvt-checklist:'+location.pathname,s={};try{s=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){}
document.querySelectorAll('.checklist-box').forEach(function(box,b){var cbs=box.querySelectorAll('input[type=checkbox]'),out=box.querySelector('.checklist-progress'),bar=box.querySelector('.checklist-bar span');
function upd(){var n=0;cbs.forEach(function(c){if(c.checked)n++});out.textContent=n+' / '+cbs.length+(n===cbs.length?' : prêt à partir':' cochées');bar.style.width=(cbs.length?n*100/cbs.length:0)+'%';box.classList.toggle('is-done',n===cbs.length&&n>0)}
cbs.forEach(function(c,i){var id=b+'-'+i,li=c.closest('li');if(typeof s[id]==='boolean')c.checked=s[id];li.classList.toggle('is-checked',c.checked);c.addEventListener('change',function(){s[id]=c.checked;try{localStorage.setItem(k,JSON.stringify(s))}catch(e){}li.classList.toggle('is-checked',c.checked);var st=li.querySelector('.stamp');if(!c.checked){if(st)st.remove()}else{if(!st){st=document.createElement('span');st.className='stamp stamp--green';st.setAttribute('aria-hidden','true');st.textContent='Fait';st.style.setProperty('--rot',((i*7)%11-6)+'deg');li.appendChild(st)}if(window.PVT)window.PVT.press(st)}upd()});
if(c.checked){var st0=document.createElement('span');st0.className='stamp stamp--green';st0.setAttribute('aria-hidden','true');st0.textContent='Fait';st0.style.setProperty('--rot',((i*7)%11-6)+'deg');li.appendChild(st0)}});upd()})})();`;

// ---------- Article ----------
function renderBlogPost(post, host = 'pvt-explorer.fr', opts = {}) {
  const baseUrl = `https://${host}`;
  const abs = u => (!u ? '' : /^https?:\/\//.test(u) ? u : baseUrl + (u.startsWith('/') ? '' : '/') + u);
  const postUrl = `${baseUrl}/blog/${post.slug}`;
  const titleRaw = post.title || '';
  const title = htmlEsc(titleRaw);
  const desc = htmlEsc(post.description || '');
  const updated = post.updatedAt || post.publishedAt;
  const catLabel = CAT_LABELS[post.category] || post.category || '';
  const catUrl = `/nos-astuces?categorie=${encodeURIComponent(post.category || '')}`;
  const country = countryOf(post);
  const { html: body, toc, faq, words } = normalizeContent(post.content || '<p>Contenu à venir.</p>', opts);
  const readTime = post.readingTime || Math.max(1, Math.round(words / 220));

  const img = abs(post.image);
  const imgAlt = htmlEsc(post.imageAlt || post.title || '');
  const dims = post.imageWidth && post.imageHeight ? ` width="${+post.imageWidth}" height="${+post.imageHeight}"` : ' width="1280" height="720"';
  const figure = img ? `<figure class="article__hero"><img src="${htmlEsc(post.image)}" alt="${imgAlt}"${dims} loading="eager" fetchpriority="high" decoding="async">${post.imageAlt ? `<figcaption>${htmlEsc(post.imageAlt)}</figcaption>` : ''}</figure>` : '';

  const pool = (opts.relatedPool || []).filter(p => !opts.publishedSlugs || opts.publishedSlugs.has(p.slug));
  const related = relatedPosts(post, pool, 3);

  const imageObj = img ? { '@type': 'ImageObject', url: img, ...(post.imageWidth ? { width: +post.imageWidth, height: +post.imageHeight } : {}), ...(post.imageAlt ? { caption: post.imageAlt } : {}) } : undefined;
  const article = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': postUrl + '#article',
    headline: titleRaw.slice(0, 110), description: post.description, url: postUrl, inLanguage: 'fr-FR',
    ...(imageObj ? { image: imageObj } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(updated ? { dateModified: updated } : {}),
    author: { '@type': 'Organization', name: post.author || 'PVT Explorer', url: baseUrl + '/a-propos' },
    publisher: { '@type': 'Organization', '@id': SITE + '/#organization', name: 'PVT Explorer', url: baseUrl + '/', logo: { '@type': 'ImageObject', url: SITE + '/images/logo-pvt-explorer.png', width: 512, height: 512 } },
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    isPartOf: { '@type': 'WebSite', '@id': SITE + '/#website', name: 'PVT Explorer', url: SITE + '/' },
    ...(country ? { about: { '@type': 'Country', name: country.name } } : {}),
    ...(catLabel ? { articleSection: catLabel } : {}),
    ...((post.tags || []).length ? { keywords: post.tags.join(', ') } : {}),
    wordCount: words, timeRequired: `PT${readTime}M`
  };
  const crumbs = [
    { name: 'Accueil', item: baseUrl + '/' },
    { name: 'Nos astuces', item: baseUrl + '/nos-astuces' },
    ...(catLabel ? [{ name: catLabel, item: baseUrl + catUrl }] : []),
    { name: titleRaw, item: postUrl }
  ];
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) };
  const lds = [article, breadcrumb, faq].filter(Boolean).map(o => `<script type="application/ld+json">${ldJson(o)}</script>`).join('\n');

  const tocHtml = toc.length >= 4 ? `<details class="toc" data-toc>
        <summary><span class="label">Sommaire</span><span class="data toc__count">${toc.length} parties</span></summary>
        <ol>${toc.map(t => `<li><a href="#${t.id}">${typoFr(htmlEsc(t.text))}</a></li>`).join('')}</ol>
      </details>` : '';

  const relatedHtml = related.length ? `<section class="next" aria-labelledby="a-lire">
        <h2 class="h-sub" id="a-lire">À lire ensuite</h2>
        <ul class="next__list" role="list">${related.map(r => {
          const rc = countryOf(r);
          return `<li class="vignette next__item">
            ${thumbImg(r, 'next__img')}
            <div class="vignette__body"><a class="next__link" href="/blog/${htmlEsc(r.slug)}">${typoFr(htmlEsc(r.title))}</a><p class="vignette__sum">${typoFr(htmlEsc(r.description || ''))}</p><p class="next__meta data">${htmlEsc(CAT_LABELS[r.category] || r.category || 'Guide')} · ${rc ? rc.iso : 'PVT'}${r.readingTime ? ` · ${+r.readingTime} min` : ''}</p></div>
          </li>`;
        }).join('')}</ul>
      </section>` : '';

  const pubDate = frDate(post.publishedAt);
  const modDate = updated ? frDate(updated, { year: 'numeric', month: 'short', day: 'numeric' }) : '';

  return `<!doctype html>
<html lang="fr">
<head>
${headCommon({ title: `${title} | PVT Explorer`, desc, url: postUrl })}
<meta property="og:type" content="article">
<meta property="og:site_name" content="PVT Explorer">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${htmlEsc(postUrl)}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
${img ? `<meta property="og:image" content="${htmlEsc(img)}">${post.imageWidth ? `<meta property="og:image:width" content="${+post.imageWidth}"><meta property="og:image:height" content="${+post.imageHeight}">` : ''}<meta property="og:image:alt" content="${imgAlt}">` : `<meta property="og:image" content="${SITE}/images/og-pvt-explorer.jpg">`}
${post.publishedAt ? `<meta property="article:published_time" content="${htmlEsc(post.publishedAt)}">` : ''}${updated ? `<meta property="article:modified_time" content="${htmlEsc(updated)}">` : ''}${catLabel ? `<meta property="article:section" content="${htmlEsc(catLabel)}">` : ''}
${(post.tags || []).map(t => `<meta property="article:tag" content="${htmlEsc(t)}">`).join('')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
${img ? `<meta name="twitter:image" content="${htmlEsc(img)}"><meta name="twitter:image:alt" content="${imgAlt}">` : ''}
${img ? `<link rel="preload" as="image" href="${htmlEsc(post.image)}" fetchpriority="high">` : ''}
${lds}
</head>
<body class="page-article">
${siteHeader('guides')}
<main id="contenu">
  <div class="page-edge" aria-hidden="true"></div>
  <article class="wrap article">
    <header class="article__head">
      <nav class="crumbs" aria-label="Fil d'Ariane"><ol><li><a href="/">Accueil</a></li><li><a href="/nos-astuces">Nos astuces</a></li>${catLabel ? `<li><a href="${htmlEsc(catUrl)}">${htmlEsc(catLabel)}</a></li>` : ''}</ol></nav>
      <h1 class="article__title">${typoFr(title)}</h1>
      ${post.description ? `<p class="article__lead">${typoFr(desc)}</p>` : ''}
      <div class="article__meta">
        ${modDate ? stamp(`Mis à jour · ${modDate}`, 'ink', -3, ` title="Dernière mise à jour"`) : ''}
        <span>Par <a href="/a-propos">l'auteur de PVT Explorer</a>, ancien PVTiste</span>
        <span>${readTime} min de lecture${pubDate ? ` · publié le <time datetime="${htmlEsc(post.publishedAt)}">${pubDate}</time>` : ''}${updated && updated !== post.publishedAt ? ` · <time datetime="${htmlEsc(updated)}">modifié le ${frDate(updated)}</time>` : ''}</span>
      </div>
    </header>
    ${figure}
    <div class="article__grid">
      ${tocHtml ? `<aside class="article__rail">${tocHtml}</aside>` : ''}
      <div class="prose">${body}</div>
    </div>
    <footer class="article__end">
      <div class="ask">
        <p class="ask__text"><strong>Une question sur votre PVT ?</strong> Écrivez-moi : je lis chaque message et je réponds par e-mail.</p>
        <a class="btn" href="/#ecrire">Écrire à l'auteur ${ARROW}</a>
      </div>
      ${relatedHtml}
      <p class="article__back"><a class="link-arrow" href="/nos-astuces">Tous les guides ${ARROW}</a></p>
    </footer>
  </article>
</main>
${siteFooter()}
${pageScripts(body.includes('checklist-box') ? `\n<script>${CHECKLIST_JS}</script>` : '')}
</body>
</html>`;
}

// ---------- Index des guides (/nos-astuces) ----------
function renderBlogIndex(posts, host = 'pvt-explorer.fr', opts = {}) {
  const baseUrl = `https://${host}`;
  const url = baseUrl + '/nos-astuces';
  const all = (posts || []).slice().sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0));
  const country = COUNTRIES[opts.country] ? opts.country : '';
  const category = CAT_LABELS[opts.category] ? opts.category : '';
  const matches = p => (!country || (p.countries || []).includes(country)) && (!category || p.category === category);
  const list = all.filter(matches);

  const countries = COUNTRY_ORDER.filter(c => all.some(p => (p.countries || []).includes(c)));
  const categories = Object.keys(CAT_LABELS).filter(c => all.some(p => p.category === c));
  const href = (pays, cat) => {
    const qs = [pays ? `pays=${encodeURIComponent(pays)}` : '', cat ? `categorie=${encodeURIComponent(cat)}` : ''].filter(Boolean).join('&');
    return '/nos-astuces' + (qs ? '?' + qs : '');
  };
  const chip = (group, value, label, on, link) => `<li><a class="chip" href="${link}" data-filtre="${group}" data-valeur="${htmlEsc(value)}"${on ? ' aria-current="true"' : ''}>${htmlEsc(label)}</a></li>`;

  const entry = p => {
    const pc = countryOf(p);
    const isPillar = pc && pc.pillar === p.slug;
    const d = frDate(p.updatedAt || p.publishedAt, { year: 'numeric', month: 'short', day: 'numeric' });
    return `<li class="entry${isPillar ? ' entry--pillar' : ''}" data-pays="${htmlEsc((p.countries || []).join(' '))}" data-theme="${htmlEsc(p.category || '')}"${matches(p) ? '' : ' hidden'}>
          ${thumbImg(p, 'entry__img')}
          <h3 class="entry__title"><a href="/blog/${htmlEsc(p.slug)}">${typoFr(htmlEsc(p.title))}</a></h3>
          <p class="entry__desc">${typoFr(htmlEsc(p.description || ''))}</p>
          <p class="entry__meta data">${htmlEsc(CAT_LABELS[p.category] || 'Guide')}${isPillar ? ' · guide complet' : ''} · ${pc ? pc.iso : 'PVT'}${p.readingTime ? ` · ${+p.readingTime} min` : ''}${d ? ` · ${d}` : ''}</p>
        </li>`;
  };

  // Toutes les étagères sont rendues ; le filtre masque ce qui ne correspond pas, et le script le fait sans recharger
  const shelf = (id, title, items) => {
    const visible = items.filter(matches).length;
    return `<section class="shelf" aria-labelledby="g-${id}"${visible ? '' : ' hidden'}>
        <h2 class="shelf__title" id="g-${id}">${htmlEsc(title)} <span class="data shelf__compte">${visible} guide${visible > 1 ? 's' : ''}</span></h2>
        <ul class="entries" role="list">${items.map(entry).join('')}</ul>
      </section>`;
  };
  const byCountry = countries.map(c => {
    const items = all.filter(p => (p.countries || [])[0] === c);
    items.sort((a, b) => (COUNTRIES[c].pillar === b.slug) - (COUNTRIES[c].pillar === a.slug));
    return items.length ? shelf(slugId(c), COUNTRIES[c].name, items) : '';
  }).join('');
  const rest = all.filter(p => !(p.countries || []).length || !COUNTRIES[(p.countries || [])[0]]);
  const groups = byCountry + (rest.length ? shelf('tous', 'Toutes destinations', rest) : '') +
    `<p class="filters__vide prose-note"${list.length ? ' hidden' : ''}>Aucun guide publié pour ce filtre pour l'instant. <a href="/nos-astuces" data-filtre="raz">Voir tous les guides</a></p>`;

  const ld = [{
    '@context': 'https://schema.org', '@type': 'CollectionPage', '@id': url + '#page', url, name: 'Guides PVT', inLanguage: 'fr-FR',
    description: 'Tous les guides de PVT Explorer pour préparer un Programme Vacances-Travail : visa, budget, assurance, travail et démarches sur place.',
    isPartOf: { '@id': SITE + '/#website' },
    mainEntity: { '@type': 'ItemList', numberOfItems: all.length, itemListElement: all.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: `${baseUrl}/blog/${p.slug}`, name: p.title })) }
  }, {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: baseUrl + '/' },
      { '@type': 'ListItem', position: 2, name: 'Nos astuces', item: url }
    ]
  }];

  const pageTitle = 'Guides PVT : visa, budget, assurance et travail, pays par pays | PVT Explorer';
  const pageDesc = 'Tous mes guides pour préparer votre PVT : conditions du visa, budget, assurance, recherche d\'emploi et démarches sur place, en Australie, au Canada, au Japon et ailleurs.';

  return `<!doctype html>
<html lang="fr">
<head>
${headCommon({ title: pageTitle, desc: htmlEsc(pageDesc), url, robots: country || category ? 'noindex,follow' : 'index,follow,max-image-preview:large' })}
<meta property="og:type" content="website">
<meta property="og:site_name" content="PVT Explorer">
<meta property="og:locale" content="fr_FR">
<meta property="og:url" content="${url}">
<meta property="og:title" content="Guides PVT : visa, budget, assurance et travail">
<meta property="og:description" content="${htmlEsc(pageDesc)}">
<meta property="og:image" content="${SITE}/images/og-pvt-explorer.jpg">
<meta name="twitter:card" content="summary_large_image">
${ld.map(o => `<script type="application/ld+json">${ldJson(o)}</script>`).join('\n')}
</head>
<body class="page-guides">
${siteHeader('guides')}
<main id="contenu">
  <div class="page-edge" aria-hidden="true"></div>
  <div class="wrap guides-index">
    <header class="index__head">
      <nav class="crumbs" aria-label="Fil d'Ariane"><ol><li><a href="/">Accueil</a></li><li aria-current="page">Nos astuces</li></ol></nav>
      <h1 class="display index__title">Mes guides PVT</h1>
      <p class="lead">${typoFr(`Visa, budget, assurance, travail : tout ce que j'ai appris en préparant mon PVT, rangé pays par pays. ${all.length} guide${all.length > 1 ? 's' : ''} publié${all.length > 1 ? 's' : ''}, chacun daté et sourcé.`)}</p>
    </header>
    <nav class="filters" aria-label="Trier les guides par pays et par thème">
      <div class="filters__row"><span class="label">Pays</span><ul role="list">${chip('pays', '', 'Tous les pays', !country, href('', category))}${countries.map(c => chip('pays', c, COUNTRIES[c].name, c === country, href(c, category))).join('')}</ul></div>
      <div class="filters__row"><span class="label">Thème</span><ul role="list">${chip('categorie', '', 'Tous les thèmes', !category, href(country, ''))}${categories.map(c => chip('categorie', c, CAT_LABELS[c], c === category, href(country, c))).join('')}</ul></div>
      <p class="filters__compte data" aria-live="polite">${list.length} guide${list.length > 1 ? 's' : ''}</p>
    </nav>
    ${groups}
    <p class="credits">Photos des guides via Wikimedia Commons, sous licences libres (CC0, CC BY ou CC BY-SA) : l'auteur et la licence de chaque photo sont indiqués à la fin de son article.</p>
  </div>
</main>
${siteFooter()}
${pageScripts('\n<script src="/js/astuces.js" defer></script>')}
</body>
</html>`;
}

// ---------- Page introuvable ----------
function renderNotFound() {
  return `<!doctype html>
<html lang="fr">
<head>
${headCommon({ title: 'Page introuvable | PVT Explorer', desc: '', url: '', robots: 'noindex,follow' })}
</head>
<body class="page-404">
${siteHeader()}
<main id="contenu">
  <div class="page-edge" aria-hidden="true"></div>
  <section class="wrap refus">
    <div class="vignette refus__card">
      <div class="vignette__body">
        ${stamp('Entrée refusée', 'red', -6)}
        <h1 class="h-section">Cette page n'existe pas, ou plus.</h1>
        <p class="vignette__sum">Le guide que vous cherchez a peut-être changé d'adresse. Repartez de la liste des guides ou des 15 destinations.</p>
        <p class="refus__links"><a class="btn" href="/nos-astuces">Voir tous les guides ${ARROW}</a><a class="btn btn--line" href="/#destinations">Les 15 destinations</a></p>
      </div>
      <p class="mrz" aria-hidden="true">V&lt;FRA404&lt;&lt;PAGE&lt;INTROUVABLE&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</p>
    </div>
  </section>
</main>
${siteFooter()}
${pageScripts()}
</body>
</html>`;
}

module.exports = { renderBlogPost, renderBlogIndex, renderNotFound, normalizeContent, extractFaq, siteHeader, siteFooter, headCommon, pageScripts, typoFr };
