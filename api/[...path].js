// PVT Explorer — Vercel serverless handler (catch-all for /api/*)
// Data is stored in /tmp on Vercel (ephemeral per Lambda instance).
// For persistent forum data, add Vercel KV: https://vercel.com/storage/kv
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const DATA_DIR = process.env.VERCEL ? '/tmp/pvt-data' : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

try {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ questions: [], clicks: {}, newsletter: [] }, null, 2));
  }
} catch (_) {}

const rate = new Map();

// ---- Blob helpers ----
function blobToken() { return process.env.BLOB_READ_WRITE_TOKEN || ''; }

let _vercelBlob;
function blob() {
  if (!_vercelBlob) _vercelBlob = require('@vercel/blob');
  return _vercelBlob;
}

async function blobGet(pathname) {
  const tk = blobToken();
  if (!tk) return null;
  try {
    const { blobs } = await blob().list({ prefix: pathname, token: tk, limit: 100 });
    const matches = blobs.filter(b => b.pathname === pathname);
    if (!matches.length) return null;
    matches.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    // For private blobs, must pass token as Bearer auth header
    const r = await fetch(matches[0].url, {
      headers: { authorization: `Bearer ${tk}` },
    });
    if (!r.ok) return null;
    return r.text();
  } catch { return null; }
}

async function blobPut(pathname, body, contentType = 'application/json') {
  const tk = blobToken();
  if (!tk) throw new Error('BLOB_READ_WRITE_TOKEN manquant');
  const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);
  await blob().put(pathname, bodyStr, {
    access: 'private',
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
    token: tk,
  });
}

async function blobList(prefix) {
  const tk = blobToken();
  if (!tk) return [];
  try {
    const { blobs } = await blob().list({ prefix, token: tk, limit: 200 });
    return blobs;
  } catch { return []; }
}

async function blobDelete(urls) {
  const tk = blobToken();
  if (!tk) return;
  try {
    await blob().del(Array.isArray(urls) ? urls : [urls], { token: tk });
  } catch {}
}

// ---- JWT helpers ----
function createToken(user) {
  const payload = Buffer.from(JSON.stringify({ user, exp: Date.now() + 86400000 })).toString('base64url');
  const secret = process.env.ADMIN_PASS || 'dev';
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(tok) {
  if (!tok) return null;
  const dot = tok.lastIndexOf('.');
  if (dot < 0) return null;
  const payload = tok.slice(0, dot);
  const sig = tok.slice(dot + 1);
  const secret = process.env.ADMIN_PASS || 'dev';
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expected, 'hex'))) return null;
    const d = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (d.exp < Date.now()) return null;
    return d;
  } catch { return null; }
}

function adminToken(req) {
  return (req.headers.authorization || '').replace(/^Bearer /, '');
}

function dbRead() {
  try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { return { questions: [], clicks: {}, newsletter: [] }; }
}

function dbWrite(db) {
  try {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (_) {}
}

function json(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(JSON.stringify(data));
}

function clean(v, n = 1200) {
  return typeof v === 'string' ? v.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, n) : '';
}

function newId() { return crypto.randomBytes(9).toString('hex'); }

function clientKey(req) {
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  return crypto.createHash('sha256').update(String(ip)).digest('hex').slice(0, 16);
}

function limited(req, key, max = 8, windowMs = 60000) {
  const k = key + ':' + clientKey(req);
  const now = Date.now();
  const arr = (rate.get(k) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) { rate.set(k, arr); return false; }
  arr.push(now);
  rate.set(k, arr);
  return true;
}

function isAdmin(req) {
  const tok = adminToken(req);
  // Accept new JWT session token
  if (verifyToken(tok)) return true;
  // Accept legacy ADMIN_TOKEN
  const TOKEN = process.env.ADMIN_TOKEN || '';
  if (TOKEN && tok.length === TOKEN.length) {
    try { return crypto.timingSafeEqual(Buffer.from(tok), Buffer.from(TOKEN)); } catch { return false; }
  }
  return false;
}

function publicQuestion(q) {
  return {
    id: q.id, title: q.title, body: q.body, country: q.country,
    author: q.author, createdAt: q.createdAt, votes: q.votes || 0,
    replies: (q.replies || []).filter(r => r.status === 'approved').map(r => ({
      id: r.id, body: r.body, author: r.author, createdAt: r.createdAt
    }))
  };
}

function readBody(req, max = 12000) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', c => {
      body += c;
      if (body.length > max) { reject(new Error('Contenu trop volumineux')); req.destroy(); }
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('JSON invalide')); }
    });
    req.on('error', reject);
  });
}

function htmlEsc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderBlogPost(post) {
  const title = htmlEsc(post.title || '');
  const desc = htmlEsc(post.description || '');
  const pubDate = post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const countries = (post.countries || []).map(c => `<span class="tag-pill">${htmlEsc(c)}</span>`).join(' ');
  const catIcons = { vols:'✈️', hébergement:'🏠', assurance:'🛡️', budget:'💰', visa:'🛂', travail:'💼', 'vie-pratique':'🏙️', activités:'🎯' };
  const catIcon = catIcons[post.category] || '📝';
  const readTime = post.readingTime ? `${post.readingTime} min · ` : '';
  const imgHtml = post.image ? `<img src="${htmlEsc(post.image)}" alt="${title}" class="hero-img" loading="eager">` : '';
  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org', '@type': 'Article',
    headline: post.title, description: post.description,
    ...(post.image ? { image: post.image } : {}),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { '@type': 'Organization', name: 'PVT Explorer' },
    publisher: { '@type': 'Organization', name: 'PVT Explorer' }
  });
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | PVT Explorer</title>
<meta name="description" content="${desc}">
<meta property="og:title" content="${title}">
<meta property="og:description" content="${desc}">
${post.image ? `<meta property="og:image" content="${htmlEsc(post.image)}">` : ''}
<meta property="og:type" content="article">
<meta name="twitter:card" content="summary_large_image">
<link rel="canonical" href="https://pvt-explorer.vercel.app/blog/${htmlEsc(post.slug)}">
<script type="application/ld+json">${jsonLd}<\/script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--ink:#102b36;--muted:#60737a;--teal:#087e79;--mint:#dff4ed;--cream:#f7f8f4;--line:#e4eae6}
*{box-sizing:border-box;margin:0;padding:0}body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;color:var(--ink);background:var(--cream);line-height:1.6}a{color:inherit;text-decoration:none}
.wrap{width:min(760px,calc(100% - 40px));margin:auto}.nav{background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:20}.navin{height:72px;display:flex;align-items:center;justify-content:space-between;gap:24px}.brand{display:flex;align-items:center;gap:10px;font-weight:850;font-size:19px;letter-spacing:-.6px}.logo{width:34px;height:34px;border-radius:10px;background:var(--teal);display:grid;place-items:center;color:white;font-size:18px}.brand em{color:var(--teal);font-style:normal}.back-link{font-size:13px;color:var(--teal);font-weight:700}.back-link:hover{text-decoration:underline}
.article-wrap{padding:48px 0 80px}.breadcrumb{font-size:12px;color:var(--muted);margin-bottom:1.5rem}.breadcrumb a{color:var(--teal);font-weight:600}.article-meta{display:flex;flex-wrap:wrap;align-items:center;gap:.5rem;margin-bottom:1rem;font-size:.8rem;color:var(--muted)}.cat-badge{background:var(--mint);color:var(--teal);border-radius:999px;padding:.25rem .75rem;font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.tag-pill{background:#f1f5f9;color:#475569;border-radius:999px;padding:.2rem .6rem;font-size:.72rem;font-weight:600}
h1.article-title{font-size:clamp(28px,5vw,42px);line-height:1.15;letter-spacing:-1.5px;margin-bottom:1rem}.article-desc{font-size:1.05rem;color:var(--muted);line-height:1.7;margin-bottom:1.75rem;border-left:3px solid var(--teal);padding-left:1rem}.hero-img{width:100%;border-radius:16px;margin-bottom:2rem;max-height:420px;object-fit:cover}
.article-content{font-size:1rem;line-height:1.85;color:#1e3a44}.article-content h2{font-size:1.4rem;margin:2rem 0 .75rem;letter-spacing:-.5px}.article-content h3{font-size:1.15rem;margin:1.5rem 0 .6rem}.article-content p{margin-bottom:1.1rem}.article-content ul,.article-content ol{margin:.75rem 0 1.1rem 1.5rem}.article-content li{margin-bottom:.4rem}.article-content a{color:var(--teal);text-decoration:underline}.article-content blockquote{border-left:3px solid var(--teal);padding:.75rem 1rem;background:var(--mint);border-radius:0 10px 10px 0;margin:1.25rem 0;font-style:italic;color:#2a5a52}.article-content img{max-width:100%;border-radius:10px;margin:1rem 0}
.divider{border:0;border-top:1px solid var(--line);margin:2.5rem 0}.back-block{padding:1.5rem;background:var(--mint);border-radius:14px;display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap}.back-block p{font-size:.9rem;color:#2a5a52}.back-block a{background:var(--teal);color:#fff;border-radius:999px;padding:.65rem 1.25rem;font-size:.85rem;font-weight:700;white-space:nowrap}.back-block a:hover{background:#066b67}
.footer{background:#0d3038;color:#d6e8e2;padding:28px 0}.footer .wrap{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}.footer a{color:#a9c2bb;font-size:12px}.footer a:hover{color:#fff}
@media(max-width:600px){.wrap{width:min(100% - 24px,760px)}.navin{height:60px}.article-wrap{padding:32px 0 60px}}
</style>
</head>
<body>
<nav class="nav"><div class="wrap navin"><a class="brand" href="/"><span class="logo">✈</span><span>PVT <em>Explorer</em></span></a><a class="back-link" href="/nos-astuces">← Nos astuces</a></div></nav>
<main class="article-wrap"><div class="wrap">
<nav class="breadcrumb"><a href="/">Accueil</a> › <a href="/nos-astuces">Nos astuces</a> › ${title}</nav>
<div class="article-meta">
  ${post.category ? `<span class="cat-badge">${catIcon} ${htmlEsc(post.category)}</span>` : ''}
  ${countries}
  <span>${readTime}${pubDate}</span>
</div>
<h1 class="article-title">${title}</h1>
${post.description ? `<p class="article-desc">${desc}</p>` : ''}
${imgHtml}
<div class="article-content">${post.content || '<p>Contenu à venir.</p>'}</div>
<hr class="divider">
<div class="back-block"><p>D'autres questions sur ton PVT ?</p><a href="/nos-astuces">Voir tous nos articles →</a></div>
</div></main>
<footer class="footer"><div class="wrap"><a class="brand" href="/"><span class="logo">✈</span><span style="color:white">PVT <em>Explorer</em></span></a><div style="display:flex;gap:16px"><a href="/">Accueil</a><a href="/nos-astuces">Nos astuces</a></div></div></footer>
</body></html>`;
}

module.exports = async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  // When routed via config.json rewrite (/api/(.*) → /api/catchall?__p=$1),
  // the original sub-path is passed as the __p query param.
  const rawP = url.searchParams.get('__p');
  const p = rawP ? '/api/' + rawP : url.pathname;

  try {
    // GET /api/config
    if (method === 'GET' && p === '/api/config') {
      return json(res, 200, {
        assistantEnabled: !!process.env.OPENAI_API_KEY,
        amazonConfigured: !!process.env.AMAZON_PARTNER_TAG,
        newsletterConfigured: !!(process.env.BREVO_API_KEY && process.env.BREVO_LIST_ID && process.env.BREVO_DOI_TEMPLATE_ID && process.env.BREVO_REDIRECT_URL),
        adsConfigured: false,
        adsPending: !!process.env.ADSENSE_CLIENT_ID,
        partnerConfigured: Object.fromEntries(
          ['flights', 'stay', 'insurance', 'esim', 'activities', 'car'].map(k => [
            k, !!process.env[`PARTNER_${k.toUpperCase()}_URL`]
          ])
        )
      });
    }

    // GET /api/questions
    if (method === 'GET' && p === '/api/questions') {
      const db = dbRead();
      const qs = db.questions
        .filter(q => q.status === 'approved')
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 100)
        .map(publicQuestion);
      return json(res, 200, { questions: qs });
    }

    // POST /api/questions
    if (method === 'POST' && p === '/api/questions') {
      if (!limited(req, 'question', 5)) return json(res, 429, { error: 'Trop de publications. Réessaie dans quelques minutes.' });
      const b = await readBody(req, 8000);
      const title = clean(b.title, 120), body = clean(b.body, 1600);
      const author = clean(b.author, 35) || 'Voyageur anonyme';
      const country = clean(b.country, 60) || 'Non précisée';
      if (title.length < 8 || body.length < 15) return json(res, 400, { error: 'Ajoute un titre (8 caractères minimum) et un détail (15 caractères minimum).' });
      const db = dbRead();
      db.questions.unshift({ id: newId(), title, body, author, country, createdAt: new Date().toISOString(), votes: 0, status: 'pending', replies: [] });
      dbWrite(db);
      return json(res, 201, { ok: true, message: 'Merci ! Ta question a été envoyée à la modération avant publication.' });
    }

    // POST /api/questions/:id/replies
    const replyMatch = p.match(/^\/api\/questions\/([a-f0-9]+)\/replies$/);
    if (method === 'POST' && replyMatch) {
      if (!limited(req, 'reply', 8)) return json(res, 429, { error: 'Trop de réponses. Réessaie plus tard.' });
      const b = await readBody(req, 5000);
      const body = clean(b.body, 1200), author = clean(b.author, 35) || 'Voyageur';
      if (body.length < 10) return json(res, 400, { error: 'La réponse doit contenir au moins 10 caractères.' });
      const db = dbRead();
      const q = db.questions.find(x => x.id === replyMatch[1] && x.status === 'approved');
      if (!q) return json(res, 404, { error: 'Discussion introuvable.' });
      q.replies = q.replies || [];
      q.replies.push({ id: newId(), body, author, createdAt: new Date().toISOString(), status: 'pending' });
      dbWrite(db);
      return json(res, 201, { ok: true, message: 'Réponse envoyée à la modération.' });
    }

    // POST /api/questions/:id/vote
    const voteMatch = p.match(/^\/api\/questions\/([a-f0-9]+)\/vote$/);
    if (method === 'POST' && voteMatch) {
      if (!limited(req, 'vote', 20)) return json(res, 429, { error: 'Limite de votes atteinte.' });
      const db = dbRead();
      const q = db.questions.find(x => x.id === voteMatch[1] && x.status === 'approved');
      if (!q) return json(res, 404, { error: 'Discussion introuvable.' });
      q.votes = (q.votes || 0) + 1;
      dbWrite(db);
      return json(res, 200, { votes: q.votes });
    }

    // GET /api/admin/pending
    if (method === 'GET' && p === '/api/admin/pending') {
      if (!isAdmin(req)) return json(res, 401, { error: 'Accès administrateur refusé. Configure ADMIN_TOKEN.' });
      const db = dbRead();
      const items = [];
      for (const q of db.questions) {
        if (q.status === 'pending') items.push({ type: 'question', questionId: q.id, id: q.id, title: q.title, body: q.body, author: q.author, country: q.country, createdAt: q.createdAt });
        for (const r of q.replies || []) {
          if (r.status === 'pending') items.push({ type: 'reply', questionId: q.id, id: r.id, title: q.title, body: r.body, author: r.author, createdAt: r.createdAt });
        }
      }
      return json(res, 200, { items });
    }

    // POST /api/admin/moderate
    if (method === 'POST' && p === '/api/admin/moderate') {
      if (!isAdmin(req)) return json(res, 401, { error: 'Accès administrateur refusé.' });
      const b = await readBody(req, 3000);
      if (!['approve', 'reject'].includes(b.action)) return json(res, 400, { error: 'Action invalide.' });
      const db = dbRead();
      const q = db.questions.find(x => x.id === b.questionId);
      if (!q) return json(res, 404, { error: 'Élément introuvable.' });
      const status = b.action === 'approve' ? 'approved' : 'rejected';
      if (b.type === 'reply') {
        const r = (q.replies || []).find(x => x.id === b.id);
        if (!r) return json(res, 404, { error: 'Réponse introuvable.' });
        r.status = status;
      } else {
        q.status = status;
      }
      dbWrite(db);
      return json(res, 200, { ok: true });
    }

    // GET /api/admin/stats
    if (method === 'GET' && p === '/api/admin/stats') {
      if (!isAdmin(req)) return json(res, 401, { error: 'Accès administrateur refusé.' });
      const db = dbRead();
      return json(res, 200, {
        clicks: db.clicks,
        questions: db.questions.length,
        approved: db.questions.filter(q => q.status === 'approved').length,
        pending: db.questions.filter(q => q.status === 'pending').length
      });
    }

    // POST /api/ask
    if (method === 'POST' && p === '/api/ask') {
      if (!limited(req, 'ask', 10)) return json(res, 429, { error: 'Trop de questions en peu de temps. Réessaie dans une minute.' });
      const API_KEY = process.env.OPENAI_API_KEY || '';
      if (!API_KEY) return json(res, 503, { error: 'Assistant IA non configuré : ajoute OPENAI_API_KEY dans les variables Vercel.' });
      const b = await readBody(req, 6000);
      const question = clean(b.question, 1500), country = clean(b.country, 80) || 'non précisée';
      if (question.length < 4) return json(res, 400, { error: 'La question est trop courte.' });
      const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
      const instructions = `Tu es l'assistant de préparation PVT de PVT Explorer, destiné aux Français. Réponds en français, clairement et concrètement. Destination : ${country}. N'invente jamais les conditions de visa, quotas, prix, salaires, droits au travail ou URL officielles. Pour toute information administrative évolutive, demande de vérifier le site officiel de l'immigration du pays et précise que tu ne consultes pas les données en temps réel. Ne fournis pas de conseil médical, juridique ou financier personnalisé.`;
      const r = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: MODEL, instructions, input: question, max_output_tokens: 800 })
      });
      const data = await r.json();
      if (!r.ok) return json(res, 502, { error: data.error?.message || 'Erreur du fournisseur IA.' });
      let answer = data.output_text;
      if (!answer && Array.isArray(data.output)) {
        answer = data.output.flatMap(o => o.content || []).filter(c => c.type === 'output_text').map(c => c.text).join('\n');
      }
      return json(res, 200, { answer: answer || 'Je ne peux pas répondre pour le moment.' });
    }

    // POST /api/newsletter
    if (method === 'POST' && p === '/api/newsletter') {
      if (!limited(req, 'newsletter', 3, 3600000)) return json(res, 429, { error: 'Trop de tentatives. Réessaie plus tard.' });
      const BREVO_KEY = process.env.BREVO_API_KEY || '';
      const BREVO_LIST = Number(process.env.BREVO_LIST_ID || 0);
      const BREVO_TPL = Number(process.env.BREVO_DOI_TEMPLATE_ID || 0);
      const BREVO_URL = process.env.BREVO_REDIRECT_URL || '';
      if (!BREVO_KEY || !BREVO_LIST || !BREVO_TPL || !BREVO_URL) {
        return json(res, 503, { error: 'Newsletter non configurée : le propriétaire doit renseigner les paramètres Brevo dans les variables Vercel.' });
      }
      const b = await readBody(req, 2000);
      const email = clean(b.email, 254).toLowerCase();
      const consent = b.consent === true;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !consent) {
        return json(res, 400, { error: 'Adresse e-mail invalide ou consentement manquant.' });
      }
      const br = await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation', {
        method: 'POST',
        headers: { 'api-key': BREVO_KEY, 'Content-Type': 'application/json', 'accept': 'application/json' },
        body: JSON.stringify({ email, includeListIds: [BREVO_LIST], templateId: BREVO_TPL, redirectionUrl: BREVO_URL })
      });
      if (!br.ok) {
        const err = await br.json().catch(() => ({}));
        return json(res, 502, { error: err.message || 'Brevo n\'a pas pu envoyer la confirmation.' });
      }
      return json(res, 200, { ok: true, message: 'Un e-mail de confirmation vient de t\'être envoyé. Confirme ton inscription pour rejoindre la newsletter.' });
    }

    // POST /api/admin/login
    if (method === 'POST' && p === '/api/admin/login') {
      if (!limited(req, 'login', 5)) return json(res, 429, { error: 'Trop de tentatives. Réessaie dans 1 minute.' });
      const b = await readBody(req, 1000);
      const ADMIN_USER = process.env.ADMIN_USER || 'admin';
      const ADMIN_PASS = process.env.ADMIN_PASS || '';
      if (!ADMIN_PASS) return json(res, 503, { error: 'ADMIN_PASS non configuré dans les variables Vercel.' });
      if ((b.user || '').trim() !== ADMIN_USER || b.pass !== ADMIN_PASS) {
        return json(res, 401, { error: 'Identifiant ou mot de passe incorrect.' });
      }
      return json(res, 200, { token: createToken(ADMIN_USER) });
    }

    // GET /api/admin/affiliates
    if (method === 'GET' && p === '/api/admin/affiliates') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      try {
        if (blobToken()) {
          const raw = await blobGet('data/affiliates.json');
          return json(res, 200, raw ? JSON.parse(raw) : { affiliates: [] });
        }
        const affFile = path.join(DATA_DIR, 'affiliates.json');
        if (fs.existsSync(affFile)) return json(res, 200, JSON.parse(fs.readFileSync(affFile, 'utf8')));
        return json(res, 200, { affiliates: [] });
      } catch(e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/admin/affiliates
    if (method === 'POST' && p === '/api/admin/affiliates') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      const b = await readBody(req, 100000);
      try {
        if (blobToken()) {
          await blobPut('data/affiliates.json', JSON.stringify(b));
        } else {
          fs.writeFileSync(path.join(DATA_DIR, 'affiliates.json'), JSON.stringify(b));
        }
        return json(res, 200, { ok: true });
      } catch(e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/admin/images
    if (method === 'GET' && p === '/api/admin/images') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      try {
        const blobs = await blobList('images/');
        return json(res, 200, { images: blobs.map(b => ({ url: b.url, pathname: b.pathname, size: b.size, uploadedAt: b.uploadedAt })) });
      } catch(e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/admin/upload
    if (method === 'POST' && p === '/api/admin/upload') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      const b = await readBody(req, 5 * 1024 * 1024);
      const { filename, contentType, data } = b;
      if (!filename || !contentType || !data) return json(res, 400, { error: 'filename, contentType et data requis.' });
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowed.includes(contentType)) return json(res, 400, { error: 'Type de fichier non autorisé.' });
      try {
        const buf = Buffer.from(data, 'base64');
        const safe = filename.replace(/[^a-z0-9._\-]/gi, '_');
        const d = await blob().put(`images/${safe}`, buf, {
          access: 'public',
          contentType,
          addRandomSuffix: true,
          token: blobToken()
        });
        return json(res, 200, { url: d.url, ok: true });
      } catch(e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/admin/delete-image
    if (method === 'POST' && p === '/api/admin/delete-image') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      const b = await readBody(req, 2000);
      if (!b.url) return json(res, 400, { error: 'URL requis.' });
      try { await blobDelete(b.url); return json(res, 200, { ok: true }); }
      catch(e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/blog — public list of published posts
    if (method === 'GET' && p === '/api/blog') {
      try {
        const raw = blobToken() ? await blobGet('data/blog-posts.json') : null;
        const data = raw ? JSON.parse(raw) : { posts: [] };
        const country = url.searchParams.get('country') || '';
        const category = url.searchParams.get('category') || '';
        const q = (url.searchParams.get('q') || '').toLowerCase();
        let posts = (data.posts || []).filter(post => post.published);
        if (country) posts = posts.filter(post => (post.countries || []).includes(country));
        if (category) posts = posts.filter(post => post.category === category);
        if (q) posts = posts.filter(post =>
          post.title.toLowerCase().includes(q) ||
          (post.description || '').toLowerCase().includes(q) ||
          (post.tags || []).some(t => t.toLowerCase().includes(q))
        );
        posts.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
        return json(res, 200, {
          posts: posts.map(post => ({
            id: post.id, slug: post.slug, title: post.title,
            description: post.description, countries: post.countries,
            category: post.category, tags: post.tags, image: post.image,
            publishedAt: post.publishedAt, author: post.author, readingTime: post.readingTime
          }))
        });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/blog/:slug — SSR HTML for browsers, JSON for API calls
    const blogSlugMatch = p.match(/^\/api\/blog\/([^/]+)$/);
    if (method === 'GET' && blogSlugMatch) {
      const slug = blogSlugMatch[1];
      try {
        const raw = blobToken() ? await blobGet('data/blog-posts.json') : null;
        const data = raw ? JSON.parse(raw) : { posts: [] };
        const post = (data.posts || []).find(post => post.slug === slug && post.published);
        const accept = req.headers.accept || '';
        if (!post) {
          if (accept.includes('text/html')) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>Article introuvable | PVT Explorer</title><style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#f7f8f4;color:#102b36;text-align:center}</style></head><body><div><p style="font-size:3rem">📭</p><h1>Article introuvable</h1><p style="margin:1rem 0;color:#60737a">Cet article n'existe pas ou n'est plus disponible.</p><a href="/nos-astuces" style="color:#087e79;font-weight:700">← Voir tous les articles</a></div></body></html>`);
          }
          return json(res, 404, { error: 'Article introuvable.' });
        }
        if (accept.includes('text/html')) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
          return res.end(renderBlogPost(post));
        }
        return json(res, 200, post);
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/admin/blog — all posts including drafts
    if (method === 'GET' && p === '/api/admin/blog') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      try {
        const raw = blobToken() ? await blobGet('data/blog-posts.json') : null;
        return json(res, 200, raw ? JSON.parse(raw) : { posts: [] });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/admin/blog — save posts array
    if (method === 'POST' && p === '/api/admin/blog') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      const b = await readBody(req, 500000);
      try {
        if (blobToken()) await blobPut('data/blog-posts.json', JSON.stringify(b));
        return json(res, 200, { ok: true });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    return json(res, 404, { error: 'Route introuvable.' });
  } catch (e) {
    if (!res.headersSent) json(res, 400, { error: e.message || 'Erreur de requête.' });
  }
};
