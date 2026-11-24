'use strict';
// Serveur de développement : reproduit le routage Vercel de build.sh (static public/ + api/).
// Sans BLOB_READ_WRITE_TOKEN, les articles rédigés du plan éditorial servent d'articles publiés.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT || 4321);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm'
};

// Rechargé à chaque requête : une modification du gabarit ou du plan est visible sans redémarrer.
function fresh(mod) {
  const p = require.resolve(mod);
  delete require.cache[p];
  return require(p);
}

function localPosts() {
  const plan = JSON.parse(fs.readFileSync(path.join(ROOT, 'api/blog-plan.json'), 'utf8'));
  return (plan.posts || []).filter(p => p.written).map(p => ({
    ...p, published: true, publishedAt: p.publishedAt || '2026-11-02T08:00:00.000Z'
  }));
}

function sendFile(res, file) {
  fs.readFile(file, (err, buf) => {
    if (err) {
      const page = path.join(PUBLIC, '404.html');
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(fs.existsSync(page) ? fs.readFileSync(page) : '404');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const p = url.pathname;
  const useBlob = !!process.env.BLOB_READ_WRITE_TOKEN;

  try {
    if (p.startsWith('/go/')) {
      req.query = { slug: decodeURIComponent(p.slice(4)), q: url.searchParams.get('q') || '' };
      return fresh('../api/go.js')(req, res);
    }

    if (!useBlob && req.method === 'GET' && p === '/api/blog') {
      const posts = localPosts().map(x => ({
        id: x.id, slug: x.slug, title: x.title, description: x.description, countries: x.countries,
        category: x.category, tags: x.tags, image: x.image, publishedAt: x.publishedAt, author: x.author, readingTime: x.readingTime
      }));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ posts }));
    }

    if (!useBlob && req.method === 'GET' && /^\/nos-astuces\/?$/.test(p)) {
      const { renderBlogIndex } = fresh('../api/blog-render.js');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      return res.end(renderBlogIndex(localPosts(), req.headers.host, {
        country: url.searchParams.get('pays') || '', category: url.searchParams.get('categorie') || ''
      }));
    }
    if (p === '/blog.html') {
      res.writeHead(308, { Location: '/nos-astuces' });
      return res.end();
    }

    const blogMatch = p.match(/^\/blog\/([^/]+)\/?$/);
    if (blogMatch && !useBlob && req.method === 'GET') {
      const posts = localPosts();
      const slug = decodeURIComponent(blogMatch[1]);
      const post = posts.find(x => x.slug === slug);
      if (post) {
        const { renderBlogPost } = fresh('../api/blog-render.js');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(renderBlogPost(post, req.headers.host, { publishedSlugs: new Set(posts.map(x => x.slug)), relatedPool: posts }));
      }
    }

    const apiPath = blogMatch ? 'blog/' + blogMatch[1]
      : p === '/sitemap.xml' ? 'sitemap.xml'
      : /^\/nos-astuces\/?$/.test(p) ? 'nos-astuces'
      : p.startsWith('/api/') ? p.slice(5) : null;
    if (apiPath !== null) {
      const qs = new URLSearchParams(url.search);
      qs.set('__p', apiPath);
      if (blogMatch) qs.set('__html', '1');
      req.url = '/api/catchall?' + qs.toString();
      return fresh('../api/[...path].js')(req, res);
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Méthode non autorisée');
    }

    const routes = { '/': '/index.html', '/admin': '/admin.html', '/a-propos': '/a-propos.html', '/a-propos/': '/a-propos.html' };
    let rel = routes[p] || decodeURIComponent(p);
    const file = path.resolve(PUBLIC, '.' + rel);
    if (!file.startsWith(PUBLIC + path.sep)) {
      res.writeHead(403);
      return res.end();
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) return sendFile(res, path.join(file, 'index.html'));
    return sendFile(res, file);
  } catch (e) {
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Erreur serveur de dev : ' + e.message);
  }
});

server.listen(PORT, () => console.log(`PVT Explorer (dev) : http://localhost:${PORT}`));
