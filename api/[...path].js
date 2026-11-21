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
  const TOKEN = process.env.ADMIN_TOKEN || '';
  if (!TOKEN) return false;
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (token.length !== TOKEN.length) return false;
  return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(TOKEN));
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

module.exports = async function handler(req, res) {
  const { method } = req;
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const p = url.pathname;

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

    return json(res, 404, { error: 'Route introuvable.' });
  } catch (e) {
    if (!res.headersSent) json(res, 400, { error: e.message || 'Erreur de requête.' });
  }
};
