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
    if (!matches.length) return null; // file genuinely doesn't exist
    matches.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
    // cache=0 : lecture directe depuis le stockage d'origine (comme get(..., { useCache: false })
    // du SDK). Sans ça, le CDN de Vercel Blob peut servir l'ancienne version jusqu'à ~1 min
    // après un enregistrement, et l'admin risque de réécrire des données périmées.
    const url = new URL(matches[0].url);
    url.searchParams.set('cache', '0');
    const r = await fetch(url, {
      headers: { authorization: `Bearer ${tk}` },
      cache: 'no-store',
    });
    if (!r.ok) throw new Error(`Lecture blob impossible (HTTP ${r.status})`);
    return r.text();
  } catch(e) {
    // Re-throw real fetch errors so callers return 500 instead of empty data
    if (e.message && e.message.startsWith('Lecture blob')) throw e;
    return null;
  }
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

// ---- Stockage : Vercel Blob en ligne ; fichiers locaux (data/stockage/) en développement ----
// En local, l'admin peut ainsi être testé sans jamais écrire dans les données du site en ligne.
const LOCAL_STORE = process.env.VERCEL ? '' : path.join(process.cwd(), 'data', 'stockage');
async function lireDonnees(chemin, defaut) {
  if (blobToken()) { const raw = await blobGet(chemin); return raw ? JSON.parse(raw) : defaut; }
  if (LOCAL_STORE) {
    try { return JSON.parse(fs.readFileSync(path.join(LOCAL_STORE, chemin), 'utf8')); } catch { return defaut; }
  }
  return defaut;
}
async function ecrireDonnees(chemin, obj) {
  if (blobToken()) return blobPut(chemin, JSON.stringify(obj));
  if (LOCAL_STORE) {
    const f = path.join(LOCAL_STORE, chemin);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(obj));
    return;
  }
  throw new Error('Stockage non configuré : BLOB_READ_WRITE_TOKEN manquant dans Vercel.');
}

// Un article est en ligne s'il est publié et que sa date de publication est passée (publication programmée)
function estVisible(post, maintenant = Date.now()) {
  if (!post || !post.published) return false;
  const t = post.publishedAt ? Date.parse(post.publishedAt) : NaN;
  return isNaN(t) || t <= maintenant;
}
function idPropre(v) { return String(v || '').replace(/[^a-z0-9_-]/gi, '').slice(0, 48); }

async function ajouterRevision(id, ancien) {
  const chemin = `data/revisions/${idPropre(id)}.json`;
  const d = await lireDonnees(chemin, { versions: [] });
  d.versions = [{ enregistreLe: ancien.modifieLe || ancien.updatedAt || new Date().toISOString(), post: ancien }, ...(d.versions || [])].slice(0, 12);
  await ecrireDonnees(chemin, d);
}
// Quand l'adresse d'un article publié change : l'ancienne redirige (301) vers la nouvelle, sans chaîne
async function ajouterRedirection(de, vers, origine) {
  if (!de || !vers || de === vers) return null;
  const d = await lireDonnees('data/redirections.json', { redirections: [] });
  let liste = (d.redirections || []).filter(r => r.de !== de && r.de !== vers);
  liste = liste.map(r => (r.vers === de ? { ...r, vers } : r));
  const r = { de, vers, origine, creeLe: new Date().toISOString() };
  liste.unshift(r);
  await ecrireDonnees('data/redirections.json', { redirections: liste });
  return r;
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

function htmlEscape(v) { return String(v || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

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

const { renderBlogPost, renderBlogIndex, renderActualitesIndex, renderNotFound } = require('./blog-render.js');

async function lireArticles() {
  const data = await lireDonnees('data/blog-posts.json', { posts: [] });
  return data && Array.isArray(data.posts) ? data : { posts: [] };
}
async function postsPublies() {
  const now = Date.now();
  return (await lireArticles()).posts.filter(x => estVisible(x, now));
}

// Actualités : la base du dépôt (api/actualites.json) + les articles publiés dans la catégorie « actualites »,
// du plus récent au plus ancien. Chaque actualité porte ses pays : elle remonte d'elle-même sous chacun d'eux.
function actualitesDeDepart() {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, 'actualites.json'), 'utf8')).actualites || []; } catch (e) { return []; }
}
// Les actualités gérées dans l'admin (data/actualites.json) remplacent la base du dépôt dès le premier enregistrement
async function chargerActualites(posts) {
  let base = null;
  try { const d = await lireDonnees('data/actualites.json', null); if (d && Array.isArray(d.actualites)) base = d.actualites; } catch (e) { base = null; }
  if (!base) base = actualitesDeDepart();
  base = base.filter(a => a && !a.masque);
  const depuisAdmin = (posts || []).filter(x => x.category === 'actualites').map(x => ({
    id: x.slug, date: x.publishedAt || x.updatedAt || '', pays: x.countries || [], titre: x.title,
    texte: x.description || '', lien: '/blog/' + x.slug, lienTexte: 'Lire la suite', source: ''
  }));
  const vus = new Set();
  return [...depuisAdmin, ...base]
    .filter(a => a && a.titre && !vus.has(a.id) && vus.add(a.id))
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
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
        assistantEnabled: !!process.env.ANTHROPIC_API_KEY,
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
      const API_KEY = process.env.ANTHROPIC_API_KEY || '';
      if (!API_KEY) return json(res, 503, { error: 'Assistant IA non configuré : ajoute ANTHROPIC_API_KEY dans les variables Vercel.' });
      const b = await readBody(req, 6000);
      const question = clean(b.question, 1500), country = clean(b.country, 80) || 'non précisée';
      if (question.length < 4) return json(res, 400, { error: 'La question est trop courte.' });
      const systemPrompt = `Tu es l'assistant de préparation PVT de PVT Explorer, destiné aux Français. Réponds en français, clairement et concrètement, en 3 à 5 paragraphes maximum. Destination mentionnée : ${country}. N'invente jamais les conditions de visa, quotas, prix, salaires, droits au travail ou URL officielles. Pour toute information administrative évolutive, invite à vérifier le site officiel de l'immigration du pays. Ne fournis pas de conseil médical, juridique ou financier personnalisé.`;
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': API_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-haiku-5-5',
          max_tokens: 800,
          system: systemPrompt,
          messages: [{ role: 'user', content: question }]
        })
      });
      const data = await r.json();
      if (!r.ok) return json(res, 502, { error: data.error?.message || 'Erreur du fournisseur IA.' });
      const answer = (data.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
      return json(res, 200, { answer: answer || 'Je ne peux pas répondre pour le moment.' });
    }

    // POST /api/newsletter
    if (method === 'POST' && p === '/api/newsletter') {
      if (!limited(req, 'newsletter', 3, 3600000)) return json(res, 429, { error: 'Trop de tentatives. Réessayez plus tard.' });
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
      // Fire-and-forget admin notification via Resend
      const RESEND_KEY = process.env.RESEND_API_KEY || '';
      const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
      if (RESEND_KEY && ADMIN_EMAIL) {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PVT Explorer <onboarding@resend.dev>',
            to: [ADMIN_EMAIL],
            subject: '🎉 Nouvel abonné newsletter PVT Explorer',
            html: `<p>Un nouvel utilisateur s'est inscrit à la newsletter :</p><p><strong>${email}</strong></p><p>Date : ${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p>`
          })
        }).catch(() => {});
      }
      // Store subscriber in blob for admin panel
      if (blobToken()) {
        blobGet('data/newsletter-subscribers.json').then(raw => {
          const data = raw ? JSON.parse(raw) : { subscribers: [] };
          if (!data.subscribers.find(s => s.email === email)) {
            data.subscribers.unshift({ email, subscribedAt: new Date().toISOString() });
            return blobPut('data/newsletter-subscribers.json', JSON.stringify(data));
          }
        }).catch(() => {});
      }
      return json(res, 200, { ok: true, message: 'Un e-mail de confirmation vient de vous être envoyé. Confirmez votre inscription pour recevoir la newsletter.' });
    }

    // POST /api/admin/login
    if (method === 'POST' && p === '/api/admin/login') {
      if (!limited(req, 'login', 5)) return json(res, 429, { error: 'Trop de tentatives. Réessayez dans une minute.' });
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
      try { return json(res, 200, await lireDonnees('data/affiliates.json', { affiliates: [] })); }
      catch(e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/admin/affiliates
    if (method === 'POST' && p === '/api/admin/affiliates') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      const b = await readBody(req, 100000);
      try {
        if (!Array.isArray(b.affiliates)) return json(res, 400, { error: 'Liste de liens attendue.' });
        await ecrireDonnees('data/affiliates.json', { affiliates: b.affiliates });
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
        const data = await lireArticles();
        const country = url.searchParams.get('country') || '';
        const category = url.searchParams.get('category') || '';
        const q = (url.searchParams.get('q') || '').toLowerCase();
        let posts = (data.posts || []).filter(post => estVisible(post));
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

    // GET /nos-astuces (via rewrite) — index des articles rendu côté serveur
    if (method === 'GET' && p === '/api/nos-astuces') {
      try {
        const published = (await postsPublies()).filter(x => x.category !== 'actualites');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
        return res.end(renderBlogIndex(published, req.headers.host || 'pvt-explorer.fr', {
          country: url.searchParams.get('pays') || '',
          category: url.searchParams.get('categorie') || ''
        }));
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /actualites (via réécriture) — actualités rangées par pays ; ?pays= filtre au premier affichage
    if (method === 'GET' && p === '/api/actualites') {
      try {
        const posts = await postsPublies();
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=600' });
        return res.end(renderActualitesIndex(await chargerActualites(posts), req.headers.host || 'pvt-explorer.fr', { pays: url.searchParams.get('pays') || '' }));
      } catch (e) { return json(res, 500, { error: e.message }); }
    }
    // GET /api/actualites/feed — bandeau défilant et recherche : actualités + derniers guides
    if (method === 'GET' && p === '/api/actualites/feed') {
      try {
        const posts = await postsPublies();
        const guides = posts.filter(x => x.category !== 'actualites')
          .sort((a, b) => new Date(b.publishedAt || 0) - new Date(a.publishedAt || 0)).slice(0, 4)
          .map(x => ({ titre: x.title, lien: '/blog/' + x.slug, pays: x.countries || [], date: x.publishedAt || '' }));
        res.setHeader('Cache-Control', 'public, max-age=300');
        return json(res, 200, { actualites: await chargerActualites(posts), guides });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/blog/:slug — SSR HTML for browsers, JSON for API calls
    const blogSlugMatch = p.match(/^\/api\/blog\/([^/]+)$/);
    if (method === 'GET' && blogSlugMatch) {
      const slug = blogSlugMatch[1];
      try {
        const data = await lireArticles();
        const post = (data.posts || []).find(post => post.slug === slug && estVisible(post));
        // /blog/:slug (réécrit avec __html=1) sert toujours la page ; /api/blog/:slug suit l'en-tête Accept.
        const html = url.searchParams.get('__html') === '1' || (req.headers.accept || '').includes('text/html');
        if (!post) {
          // Ancienne adresse d'un article renommé : redirection permanente
          let cible = null;
          try {
            let de = '/blog/' + slug;
            try { de = '/blog/' + decodeURIComponent(slug); } catch (_) {}
            const r = (await lireDonnees('data/redirections.json', { redirections: [] })).redirections || [];
            cible = (r.find(x => x.de === de) || {}).vers || null;
          } catch (_) { cible = null; }
          if (cible) {
            res.writeHead(301, { Location: cible, 'Cache-Control': 'public, max-age=3600' });
            return res.end();
          }
          if (html) {
            res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
            return res.end(renderNotFound());
          }
          return json(res, 404, { error: 'Article introuvable.' });
        }
        if (html) {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
          const host = req.headers.host || 'pvt-explorer.vercel.app';
          const published = (data.posts || []).filter(x => estVisible(x));
          const publishedSlugs = new Set(published.map(x => x.slug));
          return res.end(renderBlogPost(post, host, { publishedSlugs, relatedPool: published }));
        }
        return json(res, 200, post);
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/admin/blog — all posts including drafts
    if (method === 'GET' && p === '/api/admin/blog') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      try {
        return json(res, 200, await lireArticles());
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/admin/blog-plan — plan éditorial (100 brouillons SEO) à importer
    if (method === 'GET' && p === '/api/admin/blog-plan') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      try {
        const plan = JSON.parse(fs.readFileSync(path.join(__dirname, 'blog-plan.json'), 'utf8'));
        return json(res, 200, plan);
      } catch (e) { return json(res, 500, { error: 'Plan éditorial introuvable : ' + e.message }); }
    }

    // POST /api/admin/blog — save posts array
    if (method === 'POST' && p === '/api/admin/blog') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      const b = await readBody(req, 4000000);
      try {
        if (!Array.isArray(b.posts)) return json(res, 400, { error: 'Liste d\'articles attendue.' });
        await ecrireDonnees('data/blog-posts.json', { ...b, posts: b.posts });
        return json(res, 200, { ok: true });
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /sitemap.xml (via rewrite) or /api/sitemap.xml
    if (method === 'GET' && (p === '/api/sitemap.xml' || p === '/sitemap.xml')) {
      try {
        const host = `https://${req.headers.host || 'pvt-explorer.vercel.app'}`;
        const today = new Date().toISOString().split('T')[0];
        const xmlEsc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        let blogUrls = [];
        {
          try {
            const bdata = await lireArticles();
            {
              blogUrls = (bdata.posts || [])
                .filter(post => estVisible(post) && post.slug)
                .map(post => ({
                  loc: `${host}/blog/${encodeURIComponent(post.slug)}`,
                  changefreq: 'monthly',
                  priority: '0.7',
                  lastmod: (post.updatedAt || post.publishedAt || today).split('T')[0],
                  image: post.image ? (/^https?:\/\//.test(post.image) ? post.image : host + post.image) : ''
                }));
            }
          } catch {}
        }
        const newest = blogUrls.map(u => u.lastmod).sort().pop() || today;
        const staticUrls = [
          { loc: `${host}/`, changefreq: 'weekly', priority: '1.0', lastmod: newest },
          { loc: `${host}/nos-astuces`, changefreq: 'weekly', priority: '0.8', lastmod: newest },
          { loc: `${host}/actualites`, changefreq: 'daily', priority: '0.8', lastmod: newest },
          { loc: `${host}/a-propos`, changefreq: 'yearly', priority: '0.4', lastmod: '2026-11-23' },
        ];
        const allUrls = [...staticUrls, ...blogUrls];
        const urlsXml = allUrls.map(u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>${u.image ? `
    <image:image><image:loc>${xmlEsc(u.image)}</image:loc></image:image>` : ''}
  </url>`).join('\n');
        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urlsXml}\n</urlset>`;
        res.writeHead(200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
        return res.end(xml);
      } catch (e) { return json(res, 500, { error: e.message }); }
    }

    // GET /api/admin/newsletter
    if (method === 'GET' && p === '/api/admin/newsletter') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      try {
        return json(res, 200, await lireDonnees('data/newsletter-subscribers.json', { subscribers: [] }));
      } catch(e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/contact
    if (method === 'POST' && p === '/api/contact') {
      if (!limited(req, 'contact', 3, 3600000)) return json(res, 429, { error: 'Trop de messages envoyés. Réessayez plus tard.' });
      const b = await readBody(req, 5000);
      const firstname = clean(b.firstname, 60);
      const email = clean(b.email, 254).toLowerCase();
      const message = clean(b.message, 2000);
      if (firstname.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || message.length < 10) {
        return json(res, 400, { error: 'Indiquez votre prénom, une adresse e-mail valide et un message d\'au moins 10 caractères.' });
      }
      const id = newId();
      const msg = { id, firstname, email, message, createdAt: new Date().toISOString(), replied: false };
      if (blobToken() || LOCAL_STORE) {
        try {
          const data = await lireDonnees('data/contact-messages.json', { messages: [] });
          data.messages = [msg, ...(data.messages || [])];
          await ecrireDonnees('data/contact-messages.json', data);
        } catch(e) { return json(res, 500, { error: e.message }); }
      }
      const RESEND_KEY2 = process.env.RESEND_API_KEY || '';
      const ADMIN_EMAIL2 = process.env.ADMIN_EMAIL || '';
      if (RESEND_KEY2 && ADMIN_EMAIL2) {
        fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY2}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PVT Explorer <onboarding@resend.dev>',
            to: [ADMIN_EMAIL2],
            subject: `\u{1F4AC} Nouveau message de ${firstname} — PVT Explorer`,
            html: `<p><strong>Nouveau message de contact :</strong></p><p><strong>Pr\xe9nom :</strong> ${firstname}</p><p><strong>Email :</strong> ${email}</p><p><strong>Message :</strong></p><blockquote style="border-left:3px solid #087e79;padding-left:1rem">${message.replace(/\n/g, '<br>')}</blockquote>`
          })
        }).catch(() => {});
      }
      return json(res, 200, { ok: true, message: 'Votre message est bien parti. Je vous réponds dès que possible.' });
    }

    // GET /api/admin/contacts
    if (method === 'GET' && p === '/api/admin/contacts') {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      try {
        return json(res, 200, await lireDonnees('data/contact-messages.json', { messages: [] }));
      } catch(e) { return json(res, 500, { error: e.message }); }
    }

    // POST /api/admin/contacts/:id/reply
    const replyContactMatch = p.match(/^\/api\/admin\/contacts\/([a-f0-9]+)\/reply$/);
    if (method === 'POST' && replyContactMatch) {
      if (!verifyToken(adminToken(req))) return json(res, 401, { error: 'Non autorisé.' });
      const msgId = replyContactMatch[1];
      const b = await readBody(req, 5000);
      const replyText = clean(b.reply, 3000);
      if (replyText.length < 5) return json(res, 400, { error: 'Réponse trop courte.' });
      try {
        const data = await lireDonnees('data/contact-messages.json', { messages: [] });
        const msg = (data.messages || []).find(m => m.id === msgId);
        if (!msg) return json(res, 404, { error: 'Message introuvable.' });
        const RESEND_KEY3 = process.env.RESEND_API_KEY || '';
        if (!RESEND_KEY3) return json(res, 503, { error: 'RESEND_API_KEY non configuré.' });
        const rr = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_KEY3}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PVT Explorer <onboarding@resend.dev>',
            to: [msg.email],
            subject: 'Re : votre message à PVT Explorer',
            html: `<p>Bonjour ${htmlEscape(msg.firstname)},</p><p>${htmlEscape(replyText).replace(/\n/g, '<br>')}</p><p style="font-size:12px;color:#666">— PVT Explorer, pvt-explorer.fr</p>`
          })
        });
        if (!rr.ok) {
          const err = await rr.json().catch(() => ({}));
          return json(res, 502, { error: err.message || 'Erreur Resend.' });
        }
        msg.replied = true;
        msg.repliedAt = new Date().toISOString();
        msg.replyText = replyText;
        msg.traite = true;
        await ecrireDonnees('data/contact-messages.json', data);
        return json(res, 200, { ok: true });
      } catch(e) { return json(res, 500, { error: e.message }); }
    }

    // ===================== Espace auteur (nouvelle administration) =====================
    const session = p.startsWith('/api/admin/') ? verifyToken(adminToken(req)) : null;
    const refus = () => json(res, 401, { error: 'Session expirée : reconnectez-vous.' });

    // État des services branchés au site
    if (method === 'GET' && p === '/api/admin/etat') {
      if (!session) return refus();
      const env = process.env;
      return json(res, 200, {
        stockage: blobToken() ? 'blob' : (LOCAL_STORE ? 'local' : 'aucun'),
        emails: !!env.RESEND_API_KEY, emailAdmin: !!env.ADMIN_EMAIL,
        newsletter: !!(env.BREVO_API_KEY && env.BREVO_LIST_ID && env.BREVO_DOI_TEMPLATE_ID && env.BREVO_REDIRECT_URL),
        assistant: !!env.ANTHROPIC_API_KEY, amazon: !!env.AMAZON_PARTNER_TAG,
        partenaires: { flights: !!env.PARTNER_FLIGHTS_URL, stay: !!env.PARTNER_STAYS_URL, insurance: !!env.PARTNER_INSURANCE_URL, esim: !!env.PARTNER_ESIM_URL, activities: !!env.PARTNER_ACTIVITIES_URL, car: !!env.PARTNER_CAR_URL },
        session: { user: session.user, expire: session.exp }
      });
    }

    // Enregistrer un seul article : contrôle d'adresse, conflit de version, révision, redirection automatique
    if (method === 'POST' && p === '/api/admin/article') {
      if (!session) return refus();
      const b = await readBody(req, 2500000);
      const post = b.post || {};
      const id = idPropre(post.id);
      const slug = String(post.slug || '');
      if (!id || !String(post.title || '').trim()) return json(res, 400, { error: 'Un titre est nécessaire.' });
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return json(res, 400, { error: 'Adresse invalide : lettres minuscules sans accents, chiffres et tirets uniquement.' });
      const data = await lireArticles();
      const posts = data.posts;
      if (posts.some(x => x.slug === slug && x.id !== id)) return json(res, 409, { error: 'Cette adresse est déjà utilisée par un autre article.' });
      const i = posts.findIndex(x => x.id === id);
      const prev = i >= 0 ? posts[i] : null;
      if (prev && b.versionLue && prev.modifieLe && prev.modifieLe !== b.versionLue && !b.forcer) {
        return json(res, 409, { error: 'Cet article a été modifié ailleurs depuis son ouverture.', conflit: true, modifieLe: prev.modifieLe });
      }
      const merged = { ...(prev || {}), ...post, id, slug, modifieLe: new Date().toISOString() };
      if (prev) {
        const sans = o => JSON.stringify({ ...o, modifieLe: 0, updatedAt: 0 });
        if (sans(prev) !== sans(merged)) await ajouterRevision(id, prev);
      }
      let redirection = null;
      if (prev && estVisible(prev) && prev.slug && prev.slug !== slug) {
        redirection = await ajouterRedirection('/blog/' + prev.slug, '/blog/' + slug, 'auto');
      }
      if (i >= 0) posts[i] = merged; else posts.unshift(merged);
      await ecrireDonnees('data/blog-posts.json', { ...data, posts });
      return json(res, 200, { ok: true, post: merged, redirection });
    }

    // Supprimer un article : il part à la corbeille (50 derniers), restaurable
    if (method === 'POST' && p === '/api/admin/article/supprimer') {
      if (!session) return refus();
      const b = await readBody(req, 2000);
      const id = idPropre(b.id);
      const data = await lireArticles();
      const post = data.posts.find(x => x.id === id);
      if (!post) return json(res, 404, { error: 'Article introuvable.' });
      const corbeille = await lireDonnees('data/corbeille.json', { articles: [] });
      corbeille.articles = [{ supprimeLe: new Date().toISOString(), post }, ...(corbeille.articles || []).filter(x => x.post && x.post.id !== id)].slice(0, 50);
      await ecrireDonnees('data/corbeille.json', corbeille);
      await ecrireDonnees('data/blog-posts.json', { ...data, posts: data.posts.filter(x => x.id !== id) });
      return json(res, 200, { ok: true });
    }
    if (method === 'GET' && p === '/api/admin/corbeille') {
      if (!session) return refus();
      return json(res, 200, await lireDonnees('data/corbeille.json', { articles: [] }));
    }
    if (method === 'POST' && p === '/api/admin/corbeille/restaurer') {
      if (!session) return refus();
      const b = await readBody(req, 2000);
      const id = idPropre(b.id);
      const corbeille = await lireDonnees('data/corbeille.json', { articles: [] });
      const item = (corbeille.articles || []).find(x => x.post && x.post.id === id);
      if (!item) return json(res, 404, { error: 'Article introuvable dans la corbeille.' });
      const data = await lireArticles();
      if (data.posts.some(x => x.id === id)) return json(res, 409, { error: 'Un article avec cet identifiant existe déjà.' });
      if (data.posts.some(x => x.slug === item.post.slug)) return json(res, 409, { error: 'Son adresse est reprise par un autre article : changez-la avant de restaurer.' });
      data.posts.unshift({ ...item.post, published: false, modifieLe: new Date().toISOString() });
      await ecrireDonnees('data/blog-posts.json', data);
      corbeille.articles = corbeille.articles.filter(x => x !== item);
      await ecrireDonnees('data/corbeille.json', corbeille);
      return json(res, 200, { ok: true });
    }

    // Versions précédentes d'un article (12 dernières)
    const revMatch = p.match(/^\/api\/admin\/revisions\/([a-z0-9_-]+)$/i);
    if (method === 'GET' && revMatch) {
      if (!session) return refus();
      return json(res, 200, await lireDonnees(`data/revisions/${idPropre(revMatch[1])}.json`, { versions: [] }));
    }

    // Aperçu : l'article tel qu'il paraîtra, avec le vrai gabarit du site
    if (method === 'POST' && p === '/api/admin/apercu') {
      if (!session) return refus();
      const b = await readBody(req, 2500000);
      const post = { ...(b.post || {}), slug: String((b.post || {}).slug || 'apercu') };
      const published = await postsPublies();
      const html = renderBlogPost(post, req.headers.host || 'pvt-explorer.fr', { publishedSlugs: new Set(published.map(x => x.slug)), relatedPool: published })
        .replace('<head>', '<head>\n<meta name="robots" content="noindex,nofollow">');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(html);
    }

    // Actualités (page /actualites et bandeau de l'accueil)
    if (method === 'GET' && p === '/api/admin/actualites') {
      if (!session) return refus();
      const d = await lireDonnees('data/actualites.json', null);
      const posts = (await lireArticles()).posts.filter(x => x.category === 'actualites');
      return json(res, 200, {
        actualites: d && Array.isArray(d.actualites) ? d.actualites : actualitesDeDepart(),
        depuisDepot: !(d && Array.isArray(d.actualites)),
        depuisArticles: posts.map(x => ({ id: x.id, titre: x.title, slug: x.slug, date: x.publishedAt || '', pays: x.countries || [], enLigne: estVisible(x) }))
      });
    }
    if (method === 'POST' && p === '/api/admin/actualites') {
      if (!session) return refus();
      const b = await readBody(req, 400000);
      if (!Array.isArray(b.actualites)) return json(res, 400, { error: 'Liste d\'actualités attendue.' });
      const lien = v => { const u = clean(v, 500); return /^(\/|https:\/\/)/.test(u) ? u : ''; };
      const liste = b.actualites.slice(0, 300).map(a => ({
        id: idPropre(a.id) || newId(),
        date: /^\d{4}-\d{2}-\d{2}/.test(a.date || '') ? String(a.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
        pays: (Array.isArray(a.pays) ? a.pays : []).map(x => clean(x, 40)).filter(Boolean).slice(0, 15),
        titre: clean(a.titre, 160), texte: clean(a.texte, 600),
        lien: lien(a.lien), lienTexte: clean(a.lienTexte, 80), source: lien(a.source),
        masque: !!a.masque
      })).filter(a => a.titre);
      await ecrireDonnees('data/actualites.json', { actualites: liste, modifieLe: new Date().toISOString() });
      return json(res, 200, { ok: true, actualites: liste });
    }

    // Redirections 301 des anciennes adresses d'articles
    if (method === 'GET' && p === '/api/admin/redirections') {
      if (!session) return refus();
      return json(res, 200, await lireDonnees('data/redirections.json', { redirections: [] }));
    }
    if (method === 'POST' && p === '/api/admin/redirections') {
      if (!session) return refus();
      const b = await readBody(req, 200000);
      if (!Array.isArray(b.redirections)) return json(res, 400, { error: 'Liste attendue.' });
      const liste = b.redirections.slice(0, 500).map(r => ({
        de: clean(r.de, 300), vers: clean(r.vers, 500), origine: r.origine === 'auto' ? 'auto' : 'manuelle', creeLe: clean(r.creeLe, 40) || new Date().toISOString()
      })).filter(r => /^\/blog\/[^/\s]+$/.test(r.de) && /^(\/|https:\/\/)/.test(r.vers) && r.de !== r.vers);
      await ecrireDonnees('data/redirections.json', { redirections: liste });
      return json(res, 200, { ok: true, redirections: liste });
    }

    // Messages : traité / à traiter, suppression
    const etatMsg = p.match(/^\/api\/admin\/contacts\/([a-f0-9]+)\/(etat|supprimer)$/);
    if (method === 'POST' && etatMsg) {
      if (!session) return refus();
      const b = await readBody(req, 1000);
      const data = await lireDonnees('data/contact-messages.json', { messages: [] });
      const msgs = data.messages || [];
      const m = msgs.find(x => x.id === etatMsg[1]);
      if (!m) return json(res, 404, { error: 'Message introuvable.' });
      if (etatMsg[2] === 'supprimer') data.messages = msgs.filter(x => x !== m);
      else m.traite = !!b.traite;
      await ecrireDonnees('data/contact-messages.json', data);
      return json(res, 200, { ok: true });
    }

    // Newsletter : retirer une adresse de la liste du site (la liste Brevo reste la référence)
    if (method === 'POST' && p === '/api/admin/newsletter/supprimer') {
      if (!session) return refus();
      const b = await readBody(req, 1000);
      const email = clean(b.email, 254).toLowerCase();
      const data = await lireDonnees('data/newsletter-subscribers.json', { subscribers: [] });
      data.subscribers = (data.subscribers || []).filter(x => x.email !== email);
      await ecrireDonnees('data/newsletter-subscribers.json', data);
      return json(res, 200, { ok: true });
    }

    // Sauvegarde complète en un fichier
    if (method === 'GET' && p === '/api/admin/sauvegarde') {
      if (!session) return refus();
      const [articles, actualites, redirections, liens, abonnes, messages, corbeille] = await Promise.all([
        lireArticles(), lireDonnees('data/actualites.json', null), lireDonnees('data/redirections.json', { redirections: [] }),
        lireDonnees('data/affiliates.json', { affiliates: [] }), lireDonnees('data/newsletter-subscribers.json', { subscribers: [] }),
        lireDonnees('data/contact-messages.json', { messages: [] }), lireDonnees('data/corbeille.json', { articles: [] })
      ]);
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Disposition': `attachment; filename="pvt-explorer-sauvegarde-${new Date().toISOString().slice(0, 10)}.json"`
      });
      return res.end(JSON.stringify({ site: 'pvt-explorer.fr', exporteLe: new Date().toISOString(), articles, actualites: actualites || { actualites: actualitesDeDepart() }, redirections, liens, abonnes, messages, corbeille }, null, 1));
    }

    return json(res, 404, { error: 'Route introuvable.' });
  } catch (e) {
    if (!res.headersSent) json(res, 400, { error: e.message || 'Erreur de requête.' });
  }
};
