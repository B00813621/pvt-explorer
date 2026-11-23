'use strict';
// Rendu SSR des articles de blog : nettoyage du HTML de l'éditeur (Quill 2), sommaire,
// liens internes, checklist interactive et données structurées (BlogPosting, FAQPage, BreadcrumbList).

const CAT_LABELS = { vols: 'Vols', hébergement: 'Hébergement', assurance: 'Assurance', budget: 'Budget', visa: 'Visa', travail: 'Travail', 'vie-pratique': 'Vie pratique', activités: 'Activités' };
const CAT_ICONS = { vols: '✈️', hébergement: '🏠', assurance: '🛡️', budget: '💰', visa: '🛂', travail: '💼', 'vie-pratique': '🏙️', activités: '🎯' };

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
// Pour du JSON placé dans une balise <script>
function ldJson(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function renderList(kind, items) {
  if (kind === 'ordered') return `<ol>${items.map(i => `<li>${i.body}</li>`).join('')}</ol>`;
  if (kind === 'bullet') return `<ul>${items.map(i => `<li>${i.body}</li>`).join('')}</ul>`;
  // Checklist (Quill : data-list="checked" / "unchecked")
  return `<div class="checklist-box"><div class="checklist-head"><span class="checklist-progress" aria-live="polite"></span><span class="checklist-bar" aria-hidden="true"><span></span></span></div>` +
    `<ul class="checklist">${items.map(i => `<li><label><input type="checkbox"${i.checked ? ' checked' : ''}> <span>${i.body}</span></label></li>`).join('')}</ul></div>`;
}

/**
 * Normalise le HTML d'un article pour le rendu public.
 * opts.publishedSlugs : Set des slugs publiés — les liens /blog/<slug> vers un article non publié
 * sont remplacés par leur texte (pas de lien cassé, le lien réapparaît dès la publication).
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

  // 3. Tableaux : 1re ligne promue en <thead>/<th> si l'éditeur l'a aplatie, + conteneur scrollable mobile
  h = h.replace(/<table(?:\s[^>]*)?>([\s\S]*?)<\/table>/g, (whole, inner) => {
    if (/<thead/.test(inner)) {
      inner = inner.replace(/<th(?=[\s>])(?![^>]*scope=)([^>]*)>/g, '<th scope="col"$1>');
      return `<div class="table-wrap"><table>${inner}</table></div>`;
    }
    const rows = [...inner.replace(/<\/?tbody[^>]*>/g, '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map(r => r[1]);
    if (!rows.length) return whole;
    const head = rows[0].replace(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g, (x, c) => `<th scope="col">${c.replace(/<\/?strong>/g, '')}</th>`);
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${rows.slice(1).map(r => `<tr>${r}</tr>`).join('')}</tbody></table></div>`;
  });

  // 4. Liens internes : URL relative, pas de nouvel onglet, et masqués si la cible n'est pas publiée
  h = h.replace(/<a\s[^>]*?href="(?:https?:\/\/(?:www\.)?pvt-explorer\.fr)?\/blog\/([^"#?]+)([^"]*)"[^>]*>([\s\S]*?)<\/a>/g, (whole, slug, rest, text) => {
    let s = slug;
    try { s = decodeURIComponent(slug); } catch {}
    if (opts.publishedSlugs && !opts.publishedSlugs.has(s)) return text;
    return `<a href="/blog/${slug}${rest}">${text}</a>`;
  });
  h = h.replace(/<a\s[^>]*?href="(\/(?!\/)[^"]*)"[^>]*>/g, (whole, href) => `<a href="${href}">`);

  // 5. Images du corps : chargement différé
  h = h.replace(/<img(?![^>]*loading=)/g, '<img loading="lazy" decoding="async"');

  // 6. Titres H2 : ancres + sommaire
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
  if (toc.length >= 4) {
    const nav = `<nav class="toc" aria-label="Sommaire"><p class="toc-title">📑 Sommaire</p><ol>${toc.map(t => `<li><a href="#${t.id}">${htmlEsc(t.text)}</a></li>`).join('')}</ol></nav>`;
    const i = h.indexOf('<h2');
    h = h.slice(0, i) + nav + h.slice(i);
  }

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
    const name = stripTags(q[1]), text = stripTags(q[2]);
    if (name && text) items.push({ '@type': 'Question', name, acceptedAnswer: { '@type': 'Answer', text } });
  }
  return items.length ? { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: items } : null;
}

const CHECKLIST_JS = `(function(){var k='pvt-checklist:'+location.pathname,s={};try{s=JSON.parse(localStorage.getItem(k)||'{}')}catch(e){}
document.querySelectorAll('.checklist-box').forEach(function(box,b){var cbs=box.querySelectorAll('input[type=checkbox]'),out=box.querySelector('.checklist-progress'),bar=box.querySelector('.checklist-bar span');
function upd(){var n=0;cbs.forEach(function(c){if(c.checked)n++});out.textContent=n+' / '+cbs.length+' étapes cochées'+(n===cbs.length?' — prêt à partir 🎉':'');bar.style.width=(cbs.length?n*100/cbs.length:0)+'%'}
cbs.forEach(function(c,i){var id=b+'-'+i;if(typeof s[id]==='boolean')c.checked=s[id];c.addEventListener('change',function(){s[id]=c.checked;try{localStorage.setItem(k,JSON.stringify(s))}catch(e){}upd()})});upd()})})();`;

function renderBlogPost(post, host = 'pvt-explorer.fr', opts = {}) {
  const baseUrl = `https://${host}`;
  const abs = u => (!u ? '' : /^https?:\/\//.test(u) ? u : baseUrl + (u.startsWith('/') ? '' : '/') + u);
  const postUrl = `${baseUrl}/blog/${post.slug}`;
  const title = htmlEsc(post.title || '');
  const desc = htmlEsc(post.description || '');
  const pubDate = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const modDate = post.updatedAt && post.updatedAt !== post.publishedAt ? new Date(post.updatedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const countries = (post.countries || []).map(c => `<span class="tag-pill">${htmlEsc(c)}</span>`).join(' ');
  const catLabel = CAT_LABELS[post.category] || post.category || '';
  const catUrl = `/nos-astuces?categorie=${encodeURIComponent(post.category || '')}`;
  const { html: body, faq, words } = normalizeContent(post.content || '<p>Contenu à venir.</p>', opts);
  const readTime = post.readingTime || Math.max(1, Math.round(words / 220));

  const img = abs(post.image);
  const imgAlt = htmlEsc(post.imageAlt || post.title || '');
  const dims = post.imageWidth && post.imageHeight ? ` width="${+post.imageWidth}" height="${+post.imageHeight}"` : '';
  const imgHtml = img ? `<img src="${htmlEsc(post.image)}" alt="${imgAlt}" class="hero-img"${dims} loading="eager" fetchpriority="high" decoding="async">` : '';

  const imageObj = img ? { '@type': 'ImageObject', url: img, ...(post.imageWidth ? { width: +post.imageWidth, height: +post.imageHeight } : {}), ...(post.imageAlt ? { caption: post.imageAlt } : {}) } : undefined;
  const article = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', '@id': postUrl + '#article',
    headline: (post.title || '').slice(0, 110), description: post.description, url: postUrl, inLanguage: 'fr-FR',
    ...(imageObj ? { image: imageObj } : {}),
    ...(post.publishedAt ? { datePublished: post.publishedAt } : {}),
    ...(post.updatedAt || post.publishedAt ? { dateModified: post.updatedAt || post.publishedAt } : {}),
    author: { '@type': 'Organization', name: post.author || 'PVT Explorer', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'PVT Explorer', url: baseUrl },
    mainEntityOfPage: { '@type': 'WebPage', '@id': postUrl },
    ...(catLabel ? { articleSection: catLabel } : {}),
    ...((post.tags || []).length ? { keywords: post.tags.join(', ') } : {}),
    wordCount: words
  };
  const crumbs = [
    { name: 'Accueil', item: baseUrl + '/' },
    { name: 'Blog', item: baseUrl + '/nos-astuces' },
    ...(catLabel ? [{ name: catLabel, item: baseUrl + catUrl }] : []),
    { name: post.title, item: postUrl }
  ];
  const breadcrumb = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.item })) };
  const lds = [article, breadcrumb, faq].filter(Boolean).map(o => `<script type="application/ld+json">${ldJson(o)}</script>`).join('\n');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | PVT Explorer</title>
<meta name="description" content="${desc}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${htmlEsc(postUrl)}">
<link rel="sitemap" type="application/xml" href="/sitemap.xml">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
<meta property="og:type" content="article">
<meta property="og:url" content="${htmlEsc(postUrl)}">
<meta property="og:site_name" content="PVT Explorer">
<meta property="og:locale" content="fr_FR">
${img ? `<meta property="og:image" content="${htmlEsc(img)}">${post.imageWidth ? `<meta property="og:image:width" content="${+post.imageWidth}"><meta property="og:image:height" content="${+post.imageHeight}">` : ''}<meta property="og:image:alt" content="${imgAlt}">` : ''}
${post.publishedAt ? `<meta property="article:published_time" content="${htmlEsc(post.publishedAt)}">` : ''}${post.updatedAt ? `<meta property="article:modified_time" content="${htmlEsc(post.updatedAt)}">` : ''}${catLabel ? `<meta property="article:section" content="${htmlEsc(catLabel)}">` : ''}
${(post.tags || []).map(t => `<meta property="article:tag" content="${htmlEsc(t)}">`).join('')}
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${title}">
<meta name="twitter:description" content="${desc}">
${img ? `<meta name="twitter:image" content="${htmlEsc(img)}"><meta name="twitter:image:alt" content="${imgAlt}">` : ''}
${img ? `<link rel="preload" as="image" href="${htmlEsc(post.image)}" fetchpriority="high">` : ''}
${lds}
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--ink:#102b36;--muted:#60737a;--teal:#087e79;--mint:#dff4ed;--cream:#f7f8f4;--line:#e4eae6}
*{box-sizing:border-box;margin:0;padding:0}html{scroll-behavior:smooth;scroll-padding-top:88px}body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:var(--cream);line-height:1.6}a{color:inherit;text-decoration:none}
.wrap{width:min(760px,calc(100% - 32px));margin:auto}.nav{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}.navin{height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:10px;font-weight:850;font-size:19px;letter-spacing:-.6px}.logo{width:34px;height:34px;border-radius:10px;background:var(--teal);display:grid;place-items:center;color:white;font-size:18px}.brand em{color:var(--teal);font-style:normal}.back-link{font-size:13px;color:var(--teal);font-weight:700}.back-link:hover{text-decoration:underline}
.article-wrap{padding:48px 0 80px}.breadcrumb{font-size:12px;color:var(--muted);margin-bottom:1.5rem}.breadcrumb a{color:var(--teal);font-weight:600}.article-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-bottom:1rem;font-size:.8rem;color:var(--muted)}.cat-badge{background:var(--mint);color:var(--teal);border-radius:999px;padding:.25rem .75rem;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.tag-pill{background:#f1f5f9;color:#475569;border-radius:999px;padding:.2rem .6rem;font-size:.72rem;font-weight:600}
h1.article-title{font-size:clamp(28px,5vw,42px);line-height:1.15;letter-spacing:-1.5px;margin-bottom:1rem}.article-desc{font-size:1.05rem;color:var(--muted);line-height:1.7;margin-bottom:1.75rem;border-left:3px solid var(--teal);padding-left:1rem}.hero-img{display:block;width:100%;height:auto;aspect-ratio:16/9;border-radius:16px;margin-bottom:2rem;object-fit:cover;background:#dfe9e4}
.article-content{font-size:1rem;line-height:1.85;color:#1e3a44}.article-content h2{font-size:1.4rem;margin:2.25rem 0 .75rem;letter-spacing:-.5px;line-height:1.3}.article-content h3{font-size:1.15rem;margin:1.5rem 0 .6rem}.article-content p{margin-bottom:1.1rem}.article-content ul,.article-content ol{margin:.75rem 0 1.1rem 1.5rem}.article-content li{margin-bottom:.4rem}.article-content a{color:var(--teal);text-decoration:underline;text-underline-offset:2px}.article-content blockquote{border-left:3px solid var(--teal);padding:.75rem 1rem;background:var(--mint);border-radius:0 10px 10px 0;margin:1.25rem 0;font-style:italic;color:#2a5a52}
.article-content blockquote[data-callout]{border-left-width:4px;border-radius:10px;font-style:normal;padding:.9rem 1.1rem .9rem 1.3rem;margin:1.5rem 0}.article-content blockquote[data-callout] a{color:inherit;font-weight:600}.article-content blockquote[data-callout="tip"]{background:#f0fdf4;border-left-color:#22c55e;color:#166534}.article-content blockquote[data-callout="warning"]{background:#fff7ed;border-left-color:#f97316;color:#9a3412}.article-content blockquote[data-callout="danger"]{background:#fef2f2;border-left-color:#ef4444;color:#991b1b}.article-content blockquote[data-callout="info"]{background:#eff6ff;border-left-color:#3b82f6;color:#1e40af}.article-content blockquote[data-callout="key"]{background:#f5f3ff;border-left-color:#8b5cf6;color:#4c1d95;font-weight:500}
.table-wrap{overflow-x:auto;margin:1.25rem 0;border-radius:10px;border:1px solid #e2e8f0}.article-content table{width:100%;border-collapse:collapse;font-size:.88rem;line-height:1.55}.article-content th{background:#eef5f2;text-align:left;padding:.65rem .9rem;border-bottom:1px solid #d9e4df;font-weight:700;color:var(--ink)}.article-content td{padding:.6rem .9rem;border-top:1px solid #e2e8f0;vertical-align:top}.article-content tbody tr:nth-child(even) td{background:#f8fafc}.article-content img{max-width:100%;height:auto;border-radius:10px;margin:1rem 0}
.toc{background:#fff;border:1px solid var(--line);border-radius:14px;padding:1.1rem 1.3rem;margin:1.5rem 0 2rem}.toc-title{font-weight:800;margin-bottom:.5rem!important}.article-content .toc ol{margin:0 0 0 1.25rem}.article-content .toc li{margin-bottom:.2rem;font-size:.92rem}.article-content .toc a{text-decoration:none}.article-content .toc a:hover{text-decoration:underline}
.checklist-box{background:#fff;border:2px solid var(--teal);border-radius:16px;padding:1.1rem 1.3rem;margin:1.25rem 0 1.5rem;box-shadow:0 8px 24px rgba(8,126,121,.08)}.checklist-head{display:flex;flex-direction:column;gap:.45rem;margin-bottom:.75rem}.checklist-progress{font-size:.85rem;font-weight:700;color:var(--teal)}.checklist-bar{height:8px;background:var(--mint);border-radius:999px;overflow:hidden}.checklist-bar span{display:block;height:100%;width:0;background:var(--teal);transition:width .25s}
.article-content ul.checklist{list-style:none;margin:0}.checklist li{margin:0!important;border-top:1px solid var(--line)}.checklist li:first-child{border-top:0}.checklist label{display:flex;gap:.7rem;align-items:flex-start;padding:.55rem 0;cursor:pointer}.checklist input{width:20px;height:20px;margin-top:.3rem;accent-color:var(--teal);flex:none}.checklist input:checked+span{text-decoration:line-through;color:var(--muted)}
.divider{border:0;border-top:1px solid var(--line);margin:2.5rem 0}.back-block{padding:1.5rem;background:var(--mint);border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.back-block p{font-size:.9rem;color:#2a5a52}.back-block a{background:var(--teal);color:#fff;border-radius:999px;padding:.65rem 1.25rem;font-size:.85rem;font-weight:700;white-space:nowrap}.back-block a:hover{background:#066b67}
.footer{background:#0d3038;color:#d6e8e2;padding:28px 0}.footer .wrap{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}.footer a{color:#a9c2bb;font-size:12px}.footer a:hover{color:#fff}
@media(max-width:600px){.navin{height:60px}.article-wrap{padding:32px 0 60px}.article-content table{font-size:.82rem}}
</style>
</head>
<body>
<nav class="nav"><div class="wrap navin"><a class="brand" href="/"><span class="logo">✈</span><span>PVT <em>Explorer</em></span></a><a class="back-link" href="/nos-astuces">← Nos astuces</a></div></nav>
<main class="article-wrap"><article class="wrap">
<nav class="breadcrumb" aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/nos-astuces">Blog</a>${catLabel ? ` › <a href="${htmlEsc(catUrl)}">${htmlEsc(catLabel)}</a>` : ''} › ${title}</nav>
<div class="article-meta">
  ${post.category ? `<span class="cat-badge">${CAT_ICONS[post.category] || '📝'} ${htmlEsc(catLabel)}</span>` : ''}
  ${countries}
  <span>${readTime} min de lecture${pubDate ? ` · <time datetime="${htmlEsc(post.publishedAt)}">${pubDate}</time>` : ''}${modDate ? ` · mis à jour le <time datetime="${htmlEsc(post.updatedAt)}">${modDate}</time>` : ''}</span>
</div>
<h1 class="article-title">${title}</h1>
${post.description ? `<p class="article-desc">${desc}</p>` : ''}
${imgHtml}
<div class="article-content">${body}</div>
<hr class="divider">
<div class="back-block"><p>D'autres questions sur ton PVT ?</p><a href="/nos-astuces">Voir tous nos articles →</a></div>
</article></main>
<footer class="footer"><div class="wrap"><a class="brand" href="/"><span class="logo">✈</span><span style="color:white">PVT <em>Explorer</em></span></a><div style="display:flex;gap:16px"><a href="/">Accueil</a><a href="/nos-astuces">Nos astuces</a><a href="#" data-cookie-settings>Gérer les cookies</a></div></div></footer>
<script src="/app-config.js"></script>
<script src="/analytics.js" defer></script>
${body.includes('checklist-box') ? `<script>${CHECKLIST_JS}</script>` : ''}
</body></html>`;
}

module.exports = { renderBlogPost, normalizeContent, extractFaq };
