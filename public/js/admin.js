// PVT Explorer — Espace auteur : tableau de bord, articles, actualités, médias, messages, newsletter, SEO, réglages.
(function () {
  'use strict';

  // ---------------------------------------------------------------------------------------------
  // Outils
  // ---------------------------------------------------------------------------------------------
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function icone(id) { return '<svg aria-hidden="true"><use href="#i-' + id + '"/></svg>'; }
  function norm(s) { return String(s || '').toLocaleLowerCase('fr').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim(); }
  function pluriel(n, un, plusieurs) { return n + ' ' + (n > 1 ? (plusieurs || un + 's') : un); }
  function slugifier(s) { return norm(s).replace(/ /g, '-').replace(/-+/g, '-').slice(0, 80).replace(/-+$/, ''); }
  function nouvelId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function aujourdhui() { return new Date().toISOString().slice(0, 10); }
  function dateFr(iso, court) {
    var t = Date.parse(iso || '');
    if (isNaN(t)) return '—';
    return new Date(t).toLocaleDateString('fr-FR', court ? { day: '2-digit', month: '2-digit', year: 'numeric' } : { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function heureFr(iso) { var t = Date.parse(iso || ''); return isNaN(t) ? '' : new Date(t).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }); }
  function versLocal(iso) {
    var d = new Date(Date.parse(iso || '') || Date.now() + 86400000);
    var z = function (n) { return String(n).padStart(2, '0'); };
    return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) + 'T' + z(d.getHours()) + ':' + z(d.getMinutes());
  }
  var differer = function (fn, ms) { var t; return function () { var a = arguments, self = this; clearTimeout(t); t = setTimeout(function () { fn.apply(self, a); }, ms); }; };
  function stocker(cle, valeur) { try { if (valeur == null) localStorage.removeItem(cle); else localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { /* stockage indisponible */ } }
  function relire(cle) { try { return JSON.parse(localStorage.getItem(cle) || 'null'); } catch (e) { return null; } }

  var toastEl = $('#toast');
  function toast(msg, ton) {
    toastEl.textContent = msg;
    toastEl.style.background = ton === 'alerte' ? 'var(--red)' : '';
    toastEl.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { toastEl.classList.remove('is-on'); }, ton === 'alerte' ? 6000 : 3200);
  }

  var PAYS = [
    ['australie', 'AUS', 'Australie'], ['nouvelle-zélande', 'NZL', 'Nouvelle-Zélande'], ['japon', 'JPN', 'Japon'], ['corée-du-sud', 'KOR', 'Corée du Sud'],
    ['hong-kong', 'HKG', 'Hong Kong'], ['taïwan', 'TWN', 'Taïwan'], ['canada', 'CAN', 'Canada'], ['argentine', 'ARG', 'Argentine'], ['brésil', 'BRA', 'Brésil'],
    ['chili', 'CHL', 'Chili'], ['colombie', 'COL', 'Colombie'], ['équateur', 'ECU', 'Équateur'], ['mexique', 'MEX', 'Mexique'], ['pérou', 'PER', 'Pérou'], ['uruguay', 'URY', 'Uruguay']
  ];
  function canonPays(k) { var n = norm(k); var p = PAYS.find(function (x) { return norm(x[0]) === n || norm(x[2]) === n || norm(x[1]) === n; }); return p ? p[0] : String(k || '').trim(); }
  function isoDe(k) { var p = PAYS.find(function (x) { return x[0] === canonPays(k); }); return p ? p[1] : String(k || '').slice(0, 3).toUpperCase(); }
  function nomDe(k) { var p = PAYS.find(function (x) { return x[0] === canonPays(k); }); return p ? p[2] : k; }
  function codes(liste) { return '<span class="codes">' + (liste || []).map(function (k) { return '<abbr class="code" title="' + esc(nomDe(k)) + '">' + esc(isoDe(k)) + '</abbr>'; }).join('') + '</span>'; }
  var CATEGORIES = { visa: 'Visa', budget: 'Budget', assurance: 'Assurance', travail: 'Travail', 'vie-pratique': 'Vie pratique', vols: 'Vols', 'hébergement': 'Hébergement', 'activités': 'Activités', actualites: 'Actualités' };

  // ---------------------------------------------------------------------------------------------
  // Session
  // ---------------------------------------------------------------------------------------------
  var S = { jeton: relire('pvt-admin-jeton') || (function () { try { return localStorage.getItem('pvt_admin_token'); } catch (e) { return null; } })(), cache: {} };
  function charge(jeton) { try { return JSON.parse(atob(jeton.split('.')[0].replace(/-/g, '+').replace(/_/g, '/'))); } catch (e) { return null; } }
  function sessionValide() { var c = S.jeton && charge(S.jeton); return !!(c && c.exp > Date.now()); }

  function afficherPorte(message) {
    $('#app').hidden = true;
    $('#porte').hidden = false;
    var err = $('#porte-erreur');
    err.hidden = !message;
    err.textContent = message || '';
    setTimeout(function () { $('#porte-user').focus(); }, 30);
  }
  function deconnecter(message) {
    S.jeton = null; S.cache = {};
    stocker('pvt-admin-jeton', null);
    try { localStorage.removeItem('pvt_admin_token'); } catch (e) { /* rien */ }
    afficherPorte(message);
  }
  $('#porte-form').addEventListener('submit', async function (e) {
    e.preventDefault();
    var b = this.querySelector('button[type=submit]');
    b.disabled = true; b.textContent = 'Connexion…';
    try {
      var r = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: $('#porte-user').value.trim(), pass: $('#porte-pass').value }) });
      var d = await r.json().catch(function () { return {}; });
      if (!r.ok || !d.token) throw new Error(d.error || 'Connexion impossible.');
      S.jeton = d.token;
      stocker('pvt-admin-jeton', d.token);
      $('#porte-pass').value = '';
      demarrer();
    } catch (err) {
      $('#porte-erreur').hidden = false;
      $('#porte-erreur').textContent = err.message;
    } finally { b.disabled = false; b.textContent = 'Se connecter'; }
  });
  $('#deconnexion').addEventListener('click', function () {
    if (E && E.sale && !confirm('Des modifications ne sont pas enregistrées. Se déconnecter quand même ?')) return;
    if (E) E.sale = false;
    deconnecter('Vous êtes déconnecté.');
  });

  async function api(methode, chemin, corps, opts) {
    opts = opts || {};
    var r = await fetch(chemin, { method: methode, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + S.jeton }, body: corps === undefined ? undefined : JSON.stringify(corps) });
    if (r.status === 401) { deconnecter('Votre session a expiré : reconnectez-vous.'); throw new Error('Session expirée.'); }
    if (opts.texte) { if (!r.ok) throw new Error('Erreur du serveur (' + r.status + ').'); return r.text(); }
    if (opts.blob) { if (!r.ok) throw new Error('Erreur du serveur (' + r.status + ').'); return r.blob(); }
    var d = await r.json().catch(function () { return {}; });
    if (!r.ok) { var e = new Error(d.error || 'Erreur du serveur (' + r.status + ').'); e.donnees = d; throw e; }
    return d;
  }

  // Données chargées une fois, rechargées à la demande
  var SOURCES = {
    articles: function () { return api('GET', '/api/admin/blog').then(function (d) { return (d.posts || []).map(function (p) { p.countries = (p.countries || []).map(canonPays); return p; }); }); },
    actus: function () { return api('GET', '/api/admin/actualites'); },
    messages: function () { return api('GET', '/api/admin/contacts').then(function (d) { return d.messages || []; }); },
    abonnes: function () { return api('GET', '/api/admin/newsletter').then(function (d) { return d.subscribers || []; }); },
    images: function () { return api('GET', '/api/admin/images').then(function (d) { return d.images || []; }); },
    redirections: function () { return api('GET', '/api/admin/redirections').then(function (d) { return d.redirections || []; }); },
    liens: function () { return api('GET', '/api/admin/affiliates').then(function (d) { return d.affiliates || []; }); },
    etat: function () { return api('GET', '/api/admin/etat'); },
    corbeille: function () { return api('GET', '/api/admin/corbeille').then(function (d) { return d.articles || []; }); }
  };
  async function donnees(nom, forcer) {
    if (!forcer && S.cache[nom] !== undefined) return S.cache[nom];
    S.cache[nom] = await SOURCES[nom]();
    majCompteurs();
    return S.cache[nom];
  }

  // ---------------------------------------------------------------------------------------------
  // Articles : état et analyse SEO
  // ---------------------------------------------------------------------------------------------
  function statut(p) {
    if (!p.published) return estPlan(p) ? 'plan' : 'brouillon';
    var t = Date.parse(p.publishedAt || '');
    return !isNaN(t) && t > Date.now() ? 'programme' : 'enligne';
  }
  function estPlan(p) { return !p.published && /Brouillon — plan SEO/.test(p.content || ''); }
  var TAMPONS = { enligne: ['En ligne', 'green'], programme: ['Programmé', 'violet'], brouillon: ['Brouillon', 'ink'], plan: ['À écrire', 'ink'] };
  function tampon(cle, texte) { var t = TAMPONS[cle] || [texte || cle, 'ink']; return '<span class="stamp stamp--' + t[1] + '" style="--rot:-2deg">' + esc(texte || t[0]) + '</span>'; }
  function doc(html) { return new DOMParser().parseFromString(html || '', 'text/html'); }
  function compterMots(texte) { return (texte.match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu) || []).length; }

  function analyser(p, tous) {
    var res = [];
    var ajout = function (ok, niveau, texte) { res.push({ ok: !!ok, niveau: niveau, texte: texte }); };
    var actu = p.category === 'actualites';
    var titre = (p.title || '').trim(), desc = (p.description || '').trim(), kw = norm(p.focusKeyword);
    var d = doc(p.content), texte = d.body.textContent || '', mots = compterMots(texte);
    ajout(titre.length >= 30 && titre.length <= 65, titre ? 'conseil' : 'erreur', titre ? 'Titre de ' + titre.length + ' caractères (idéal : 30 à 65)' : 'Titre manquant');
    ajout(desc.length >= 110 && desc.length <= 160, desc ? 'conseil' : 'erreur', desc ? 'Description de ' + desc.length + ' caractères (idéal : 110 à 160)' : 'Description pour Google manquante');
    ajout(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug || ''), 'erreur', /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug || '') ? 'Adresse propre' : 'Adresse invalide (minuscules, chiffres et tirets)');
    if (!kw) ajout(false, 'conseil', 'Mot-clé principal non renseigné');
    else {
      ajout(norm(titre).indexOf(kw) !== -1, 'conseil', 'Mot-clé dans le titre');
      ajout(norm(desc).indexOf(kw) !== -1, 'conseil', 'Mot-clé dans la description');
      ajout(norm((p.slug || '').replace(/-/g, ' ')).indexOf(kw) !== -1, 'conseil', 'Mot-clé dans l’adresse');
      var premier = d.querySelector('p');
      ajout(premier && norm(premier.textContent).indexOf(kw) !== -1, 'conseil', 'Mot-clé dans le premier paragraphe');
      var rival = (tous || []).find(function (x) { return x.id !== p.id && norm(x.focusKeyword) === kw; });
      ajout(!rival, 'conseil', rival ? 'Mot-clé déjà visé par « ' + rival.title + ' » : risque de concurrence entre vos pages' : 'Mot-clé visé par ce seul article');
    }
    if (!actu) {
      var h2 = d.querySelectorAll('h2').length;
      ajout(h2 >= 2, 'conseil', pluriel(h2, 'intertitre') + ' H2 (au moins 2)');
      ajout(mots >= 800, mots < 300 ? 'erreur' : 'conseil', pluriel(mots, 'mot') + ' (au moins 800 pour un guide)');
    }
    ajout(!!p.image, 'conseil', p.image ? 'Image à la une' : 'Pas d’image à la une (partages et Google Images)');
    if (p.image) ajout(!!(p.imageAlt || '').trim(), 'erreur', (p.imageAlt || '').trim() ? 'Texte alternatif de l’image à la une' : 'Texte alternatif de l’image à la une manquant');
    var imgs = $$('img', d.body), sansAlt = imgs.filter(function (i) { return !(i.getAttribute('alt') || '').trim(); }).length;
    if (imgs.length) ajout(!sansAlt, 'conseil', sansAlt ? pluriel(sansAlt, 'image') + ' de l’article sans texte alternatif' : 'Images de l’article décrites');
    var internes = $$('a[href]', d.body).map(function (a) { return a.getAttribute('href') || ''; }).filter(function (h) { return /^\/(?!\/)/.test(h) || /^https?:\/\/(www\.)?pvt-explorer\.fr/.test(h); });
    if (!actu) ajout(internes.length >= 2, 'conseil', pluriel(internes.length, 'lien interne', 'liens internes') + ' (au moins 2)');
    var enLigne = new Set((tous || []).filter(function (x) { return statut(x) === 'enligne'; }).map(function (x) { return x.slug; }));
    var absents = internes.map(function (h) { var m = h.match(/\/blog\/([^/?#]+)/); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return m ? m[1] : ''; } })
      .filter(function (s) { return s && !enLigne.has(s); });
    if (absents.length) ajout(false, 'conseil', pluriel(absents.length, 'lien') + ' vers un article pas encore en ligne (affiché sans lien) : ' + absents.slice(0, 2).join(', '));
    var memeTitre = titre && (tous || []).find(function (x) { return x.id !== p.id && (x.title || '').trim() === titre; });
    if (memeTitre) ajout(false, 'erreur', 'Titre identique à celui de « ' + memeTitre.slug + ' »');
    var memeDesc = desc && (tous || []).find(function (x) { return x.id !== p.id && (x.description || '').trim() === desc; });
    if (memeDesc) ajout(false, 'erreur', 'Description identique à celle de « ' + memeDesc.slug + ' »');
    if (statut(p) === 'enligne') {
      var maj = Date.parse(p.updatedAt || p.publishedAt || '');
      if (!isNaN(maj)) ajout(Date.now() - maj < 365 * 864e5, 'conseil', Date.now() - maj < 365 * 864e5 ? 'Mis à jour il y a moins d’un an' : 'À rafraîchir : pas de mise à jour depuis plus d’un an');
    }
    var ok = res.filter(function (r) { return r.ok; }).length;
    var erreurs = res.filter(function (r) { return !r.ok && r.niveau === 'erreur'; }).length;
    var note = Math.max(0, Math.min(100, Math.round(100 * ok / res.length) - erreurs * 8));
    return { controles: res, note: note, erreurs: erreurs, conseils: res.filter(function (r) { return !r.ok && r.niveau === 'conseil'; }).length, mots: mots };
  }
  function tonNote(n) { return n >= 75 ? 'bon' : n >= 50 ? 'moyen' : 'faible'; }
  function noteSeo(n) { return '<span class="note-seo" data-ton="' + tonNote(n) + '">' + n + '</span>'; }

  function majCompteurs() {
    var a = S.cache.articles, m = S.cache.messages;
    var ca = $('[data-compte=articles]'), cm = $('[data-compte=messages]'), cs = $('[data-compte=seo]');
    if (a && ca) ca.textContent = a.length;
    if (m && cm) { var n = m.filter(function (x) { return !x.traite && !x.replied; }).length; cm.textContent = n || ''; }
    if (a && cs) {
      var err = a.filter(function (p) { return statut(p) === 'enligne'; }).reduce(function (s, p) { return s + analyser(p, a).erreurs; }, 0);
      cs.textContent = err || '';
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Fenêtres
  // ---------------------------------------------------------------------------------------------
  var fen = $('#fenetre');
  function ouvrirFenetre(titre, html) {
    $('#fenetre-titre').textContent = titre;
    $('#fenetre-corps').innerHTML = html;
    if (!fen.open) fen.showModal();
    return $('#fenetre-corps');
  }
  function fermerFenetre() { if (fen.open) fen.close(); }
  function demander(titre, texte, bouton, danger) {
    return new Promise(function (resolve) {
      var corps = ouvrirFenetre(titre, '<p>' + texte + '</p><div class="fenetre__pied"><button class="btn btn--doux" type="button" data-non>Annuler</button><button class="btn' + (danger ? ' btn--danger' : '') + '" type="button" data-oui>' + esc(bouton) + '</button></div>');
      var fini = false;
      var fin = function (v) { if (fini) return; fini = true; fermerFenetre(); resolve(v); };
      $('[data-oui]', corps).addEventListener('click', function () { fin(true); });
      $('[data-non]', corps).addEventListener('click', function () { fin(false); });
      fen.addEventListener('close', function () { fin(false); }, { once: true });
      $('[data-oui]', corps).focus();
    });
  }
  document.addEventListener('click', function (e) {
    var f = e.target.closest && e.target.closest('[data-fermer]');
    if (f) f.closest('dialog').close();
    if (e.target.tagName === 'DIALOG') e.target.close();
  });

  // ---------------------------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------------------------
  var VUES = {};
  var vue = $('#vue');
  var E = null; // éditeur ouvert
  var hashCourant = '';
  function entete(titre, info, actions) {
    $('#titre-vue').textContent = titre;
    $('#info-vue').textContent = info || '';
    $('#actions-vue').innerHTML = actions || '';
    document.title = titre + ' | Espace auteur PVT Explorer';
  }
  function info(texte) { $('#info-vue').textContent = texte || ''; }
  function chargement() { vue.innerHTML = '<div class="panneau panneau__vide">Chargement…</div>'; }
  function erreurVue(e) { vue.innerHTML = '<div class="avis avis--alerte">' + esc(e.message) + ' <button class="lien-action" type="button" data-recharger>Réessayer</button></div>'; }

  async function router() {
    if (!sessionValide()) { deconnecter(S.jeton ? 'Votre session a expiré : reconnectez-vous.' : ''); return; }
    var h = location.hash.replace(/^#\/?/, '').split('?')[0] || 'tableau';
    if (E && E.sale && location.hash !== hashCourant) {
      if (!confirm('Des modifications ne sont pas enregistrées. Quitter l’article quand même ?')) { history.replaceState(null, '', hashCourant); return; }
      E.sale = false;
    }
    hashCourant = location.hash || '#/tableau';
    var parts = h.split('/');
    var nom = parts[0], arg = parts.slice(1).join('/');
    if (nom === 'articles' && arg) nom = 'article';
    if (!VUES[nom]) nom = 'tableau';
    if (nom !== 'article') E = null;
    $$('.flanc__nav a').forEach(function (a) {
      var v = a.getAttribute('data-vue');
      if (v === nom || (nom === 'article' && v === 'articles')) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    fermerFlanc();
    // Une vue neuve à chaque navigation : les écouteurs de la vue précédente partent avec elle
    var neuve = vue.cloneNode(false);
    vue.replaceWith(neuve);
    vue = neuve;
    vue.addEventListener('click', function (e) { if (e.target.closest('[data-recharger]')) { S.cache = {}; router(); } });
    chargement();
    window.scrollTo(0, 0);
    try { await VUES[nom](arg ? decodeURIComponent(arg) : ''); }
    catch (e) { if (S.jeton) erreurVue(e); }
  }
  window.addEventListener('hashchange', router);
  window.addEventListener('beforeunload', function (e) { if (E && E.sale) { e.preventDefault(); e.returnValue = ''; } });

  var flanc = $('#flanc'), boutonFlanc = $('#ouvrir-flanc');
  function fermerFlanc() { flanc.removeAttribute('data-ouvert'); boutonFlanc.setAttribute('aria-expanded', 'false'); }
  boutonFlanc.addEventListener('click', function () {
    var o = !flanc.hasAttribute('data-ouvert');
    flanc.toggleAttribute('data-ouvert', o);
    boutonFlanc.setAttribute('aria-expanded', String(o));
    if (o) $('a', flanc).focus();
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && flanc.hasAttribute('data-ouvert')) { fermerFlanc(); boutonFlanc.focus(); } });

  function majSession() {
    var c = charge(S.jeton || '');
    if (!c) return;
    var fin = new Date(c.exp), memeJour = fin.toDateString() === new Date().toDateString();
    $('#session').textContent = (c.user || 'auteur') + ' · session jusqu’à ' + (memeJour ? '' : 'demain ') + heureFr(fin.toISOString());
  }

  function demarrer() {
    if (!sessionValide()) { afficherPorte(''); return; }
    $('#porte').hidden = true;
    $('#app').hidden = false;
    majSession();
    if (!location.hash) history.replaceState(null, '', '#/tableau');
    router();
    // Comptes du menu en arrière-plan
    donnees('articles').catch(function () {});
    donnees('messages').catch(function () {});
  }

  // ---------------------------------------------------------------------------------------------
  // Tableau de bord
  // ---------------------------------------------------------------------------------------------
  VUES.tableau = async function () {
    var jour = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    entete('Tableau de bord', jour.charAt(0).toUpperCase() + jour.slice(1),
      '<a class="btn btn--doux" href="#/actualites/nouvelle">' + icone('plus') + 'Actualité</a><a class="btn" href="#/articles/nouveau">' + icone('plus') + 'Nouvel article</a>');
    var r = await Promise.all(['articles', 'messages', 'abonnes', 'actus'].map(function (n) { return donnees(n).catch(function () { return null; }); }));
    var articles = r[0] || [], messages = r[1] || [], abonnes = r[2] || [], actus = r[3] || { actualites: [] };
    var parStatut = { enligne: [], programme: [], brouillon: [], plan: [] };
    articles.forEach(function (p) { parStatut[statut(p)].push(p); });
    var aTraiter = messages.filter(function (m) { return !m.traite && !m.replied; });
    var analyses = parStatut.enligne.map(function (p) { return { p: p, a: analyser(p, articles) }; });
    var erreurs = analyses.filter(function (x) { return x.a.erreurs; });
    var rafraichir = parStatut.enligne.filter(function (p) { var t = Date.parse(p.updatedAt || p.publishedAt || ''); return !isNaN(t) && Date.now() - t > 365 * 864e5; });
    var plan = articles.filter(function (p) { return p.planRank; });
    var planFait = plan.filter(function (p) { return !estPlan(p); }).length;
    var aEcrire = parStatut.plan.slice().sort(function (a, b) { return (a.planRank || 999) - (b.planRank || 999); }).slice(0, 6);
    var recents = articles.slice().sort(function (a, b) { return Date.parse(b.modifieLe || b.updatedAt || 0) - Date.parse(a.modifieLe || a.updatedAt || 0); }).slice(0, 6);
    var actusVisibles = (actus.actualites || []).filter(function (a) { return !a.masque; }).length + (actus.depuisArticles || []).filter(function (a) { return a.enLigne; }).length;

    var chiffre = function (href, n, label, sous, alerte) {
      return '<a class="panneau chiffre" href="' + href + '"><span class="label">' + label + '</span><span class="chiffre__n' + (alerte ? ' chiffre__n--alerte' : '') + '">' + n + '</span><span class="chiffre__sous">' + sous + '</span></a>';
    };
    var tache = function (href, texte, droite, tamp) { return '<li>' + (tamp || '') + '<a href="' + href + '">' + esc(texte) + '</a>' + (droite ? '<span class="data">' + esc(droite) + '</span>' : '') + '</li>'; };
    var taches = []
      .concat(aTraiter.slice(0, 3).map(function (m) { return tache('#/messages', 'Message de ' + m.firstname, dateFr(m.createdAt, true), tampon('x', 'À traiter').replace('stamp--ink', 'stamp--red')); }))
      .concat(parStatut.programme.map(function (p) { return tache('#/articles/' + encodeURIComponent(p.id), p.title, dateFr(p.publishedAt, true) + ' ' + heureFr(p.publishedAt), tampon('programme')); }))
      .concat(erreurs.slice(0, 4).map(function (x) { return tache('#/articles/' + encodeURIComponent(x.p.id), x.p.title, pluriel(x.a.erreurs, 'erreur') + ' SEO', tampon('x', 'SEO').replace('stamp--ink', 'stamp--red')); }))
      .concat(rafraichir.slice(0, 3).map(function (p) { return tache('#/articles/' + encodeURIComponent(p.id), p.title, 'mis à jour le ' + dateFr(p.updatedAt || p.publishedAt, true), tampon('x', 'À rafraîchir')); }));

    vue.innerHTML =
      '<div class="chiffres">' +
        chiffre('#/articles', parStatut.enligne.length, 'Articles en ligne', parStatut.programme.length ? '+ ' + pluriel(parStatut.programme.length, 'programmé') : 'publiés sur le site') +
        chiffre('#/articles', parStatut.brouillon.length + parStatut.plan.length, 'Brouillons', parStatut.plan.length ? 'dont ' + parStatut.plan.length + ' à écrire (plan)' : 'en cours d’écriture') +
        chiffre('#/actualites', actusVisibles, 'Actualités', 'sur la page et le bandeau') +
        chiffre('#/messages', aTraiter.length, 'Messages à traiter', pluriel(messages.length, 'message') + ' au total', aTraiter.length > 0) +
        chiffre('#/newsletter', abonnes.length, 'Abonnés newsletter', 'inscrits depuis le site') +
        chiffre('#/seo', erreurs.length, 'Articles à corriger', 'erreurs SEO sur des pages en ligne', erreurs.length > 0) +
      '</div>' +
      '<div class="grille-2">' +
        '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">À faire</h2></div>' +
          (taches.length ? '<ul class="taches">' + taches.join('') + '</ul>' : '<p class="panneau__vide">Rien d’urgent : messages traités, aucune erreur SEO sur les pages en ligne.</p>') + '</section>' +
        '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Plan éditorial</h2><a class="lien-action" href="#/articles?plan">Tout le plan</a></div>' +
          '<div class="panneau__corps"><div class="score"><span class="score__n">' + planFait + '<span class="data" style="font-size:1rem;color:var(--ink-3)">/' + plan.length + '</span></span><div class="jauge"><span style="width:' + (plan.length ? Math.round(100 * planFait / plan.length) : 0) + '%"></span></div></div>' +
          '<p class="aide">Articles du plan SEO déjà rédigés. Les prochains à écrire, dans l’ordre du plan :</p></div>' +
          (aEcrire.length ? '<ul class="taches">' + aEcrire.map(function (p) { return tache('#/articles/' + encodeURIComponent(p.id), p.title, '#' + (p.planRank || '—')); }).join('') + '</ul>' : '<p class="panneau__vide">Tout le plan est rédigé.</p>') + '</section>' +
      '</div>' +
      '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Dernières modifications</h2><a class="lien-action" href="#/articles">Tous les articles</a></div>' +
        (recents.length ? '<ul class="taches">' + recents.map(function (p) { return tache('#/articles/' + encodeURIComponent(p.id), p.title, dateFr(p.modifieLe || p.updatedAt, true), tampon(statut(p))); }).join('') + '</ul>' : '<p class="panneau__vide">Aucun article pour l’instant. <a href="#/articles">Importer le plan éditorial</a></p>') +
      '</section>';
  };

  // ---------------------------------------------------------------------------------------------
  // Articles : liste, filtres, corbeille, import du plan
  // ---------------------------------------------------------------------------------------------
  var F = { statut: '', q: '', cat: '', pays: '', tri: 'date' };
  VUES.articles = async function () {
    if (/\?plan/.test(location.hash)) F.statut = 'plan';
    entete('Articles', '', '<button class="btn btn--doux" type="button" id="importer-plan">Importer le plan</button><a class="btn" href="#/articles/nouveau">' + icone('plus') + 'Nouvel article</a>');
    var articles = await donnees('articles');
    $('#importer-plan').addEventListener('click', importerPlan);
    var corbeille = null;

    var compte = function (s) { return articles.filter(function (p) { return !s || statut(p) === s; }).length; };
    vue.innerHTML =
      '<div class="barre">' +
        '<div class="onglets" role="group" aria-label="État">' + [['', 'Tous'], ['enligne', 'En ligne'], ['programme', 'Programmés'], ['brouillon', 'Brouillons'], ['plan', 'À écrire'], ['corbeille', 'Corbeille']].map(function (o) {
          return '<button class="chip" type="button" data-statut="' + o[0] + '" aria-pressed="' + (F.statut === o[0]) + '">' + o[1] + (o[0] !== 'corbeille' ? '<span class="chip__n">' + compte(o[0]) + '</span>' : '') + '</button>';
        }).join('') + '</div></div>' +
      '<div class="barre"><input class="champ champ--recherche" type="search" id="f-q" placeholder="Rechercher un titre, une adresse, un mot-clé" value="' + esc(F.q) + '" aria-label="Rechercher un article">' +
        '<select class="champ" id="f-cat" aria-label="Catégorie"><option value="">Toutes les catégories</option>' + Object.keys(CATEGORIES).map(function (k) { return '<option value="' + esc(k) + '"' + (F.cat === k ? ' selected' : '') + '>' + CATEGORIES[k] + '</option>'; }).join('') + '</select>' +
        '<select class="champ" id="f-pays" aria-label="Pays"><option value="">Tous les pays</option><option value="-"' + (F.pays === '-' ? ' selected' : '') + '>Sans pays</option>' + PAYS.map(function (p) { return '<option value="' + esc(p[0]) + '"' + (F.pays === p[0] ? ' selected' : '') + '>' + p[2] + '</option>'; }).join('') + '</select>' +
        '<select class="champ" id="f-tri" aria-label="Trier"><option value="date">Plus récents</option><option value="titre">Titre</option><option value="seo">Note SEO la plus basse</option><option value="plan">Ordre du plan</option></select></div>' +
      '<section class="panneau"><div class="liste-wrap" id="liste-articles"></div></section>';
    $('#f-tri').value = F.tri;

    async function dessiner() {
      var cible = $('#liste-articles');
      if (F.statut === 'corbeille') {
        if (!corbeille) { cible.innerHTML = '<p class="panneau__vide">Chargement…</p>'; corbeille = await donnees('corbeille', true); }
        info(pluriel(corbeille.length, 'article') + ' dans la corbeille');
        cible.innerHTML = corbeille.length ? '<table class="liste"><thead><tr><th>Article</th><th>Supprimé le</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + corbeille.map(function (c) {
          return '<tr><td><span class="liste__titre">' + esc(c.post.title) + '</span><span class="liste__sous">/blog/' + esc(c.post.slug) + '</span></td><td class="data">' + dateFr(c.supprimeLe, true) + '</td><td><div class="liste__actions"><button class="btn btn--doux" type="button" data-restaurer="' + esc(c.post.id) + '">Restaurer</button></div></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="panneau__vide">La corbeille est vide. Les articles supprimés y restent, restaurables (les 50 derniers).</p>';
        return;
      }
      var q = norm(F.q);
      var liste = articles.filter(function (p) {
        return (!F.statut || statut(p) === F.statut) && (!F.cat || p.category === F.cat) &&
          (!F.pays || (F.pays === '-' ? !(p.countries || []).length : (p.countries || []).indexOf(F.pays) !== -1)) &&
          (!q || norm(p.title + ' ' + p.slug + ' ' + (p.focusKeyword || '') + ' ' + (p.description || '')).indexOf(q) !== -1);
      }).map(function (p) { return { p: p, a: analyser(p, articles) }; });
      liste.sort(function (x, y) {
        if (F.tri === 'titre') return x.p.title.localeCompare(y.p.title, 'fr');
        if (F.tri === 'seo') return x.a.note - y.a.note;
        if (F.tri === 'plan') return (x.p.planRank || 999) - (y.p.planRank || 999);
        return Date.parse(y.p.modifieLe || y.p.updatedAt || y.p.publishedAt || 0) - Date.parse(x.p.modifieLe || x.p.updatedAt || x.p.publishedAt || 0);
      });
      info(pluriel(liste.length, 'article') + (liste.length !== articles.length ? ' sur ' + articles.length : ''));
      cible.innerHTML = liste.length ? '<table class="liste"><thead><tr><th>Article</th><th>État</th><th>Catégorie</th><th>Pays</th><th>Date</th><th>SEO</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + liste.map(function (x) {
        var p = x.p, st = statut(p);
        return '<tr><td><a class="liste__titre" href="#/articles/' + encodeURIComponent(p.id) + '">' + esc(p.title || 'Sans titre') + '</a><span class="liste__sous">/blog/' + esc(p.slug) + '</span></td>' +
          '<td>' + tampon(st) + '</td><td>' + esc(CATEGORIES[p.category] || p.category || '—') + '</td><td>' + codes(p.countries) + '</td>' +
          '<td class="data">' + (st === 'programme' ? dateFr(p.publishedAt, true) + ' ' + heureFr(p.publishedAt) : dateFr(p.publishedAt || p.updatedAt, true)) + '</td><td>' + noteSeo(x.a.note) + '</td>' +
          '<td><div class="liste__actions">' + (st === 'enligne' ? '<a class="icone" href="/blog/' + esc(p.slug) + '" target="_blank" rel="noopener" title="Voir en ligne">' + icone('oeil') + '<span class="visually-hidden">Voir « ' + esc(p.title) + ' » en ligne</span></a>' : '') +
          '<a class="icone" href="#/articles/' + encodeURIComponent(p.id) + '" title="Modifier">' + icone('crayon') + '<span class="visually-hidden">Modifier « ' + esc(p.title) + ' »</span></a>' +
          '<button class="icone icone--danger" type="button" data-supprimer="' + esc(p.id) + '" title="Mettre à la corbeille">' + icone('poubelle') + '<span class="visually-hidden">Mettre « ' + esc(p.title) + ' » à la corbeille</span></button></div></td></tr>';
      }).join('') + '</tbody></table>' : '<p class="panneau__vide">Aucun article ne correspond.' + (articles.length ? '' : ' Commencez par <button class="lien-action" type="button" data-importer>importer le plan éditorial</button>.') + '</p>';
    }
    vue.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-statut]');
      if (b) { F.statut = b.getAttribute('data-statut'); $$('[data-statut]', vue).forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); return dessiner(); }
      var s = e.target.closest('[data-supprimer]');
      if (s) {
        var p = articles.find(function (x) { return x.id === s.getAttribute('data-supprimer'); });
        if (!p || !(await demander('Mettre à la corbeille ?', '« ' + esc(p.title) + ' » quitte le site' + (statut(p) === 'enligne' ? ' (il est en ligne)' : '') + '. Vous pourrez le restaurer depuis la corbeille.', 'Mettre à la corbeille', true))) return;
        try { await api('POST', '/api/admin/article/supprimer', { id: p.id }); articles.splice(articles.indexOf(p), 1); corbeille = null; majCompteurs(); toast('Article mis à la corbeille.'); dessiner(); }
        catch (err) { toast(err.message, 'alerte'); }
      }
      var r = e.target.closest('[data-restaurer]');
      if (r) {
        try { await api('POST', '/api/admin/corbeille/restaurer', { id: r.getAttribute('data-restaurer') }); S.cache.articles = undefined; articles = await donnees('articles'); corbeille = null; toast('Article restauré en brouillon.'); dessiner(); }
        catch (err) { toast(err.message, 'alerte'); }
      }
      if (e.target.closest('[data-importer]')) importerPlan();
    });
    var surSaisie = differer(function () { F.q = $('#f-q').value; dessiner(); }, 150);
    $('#f-q').addEventListener('input', surSaisie);
    $('#f-cat').addEventListener('change', function () { F.cat = this.value; dessiner(); });
    $('#f-pays').addEventListener('change', function () { F.pays = this.value; dessiner(); });
    $('#f-tri').addEventListener('change', function () { F.tri = this.value; dessiner(); });
    dessiner();
  };

  async function importerPlan() {
    try {
      var articles = await donnees('articles', true);
      var plan = await api('GET', '/api/admin/blog-plan');
      var parId = new Map(articles.map(function (p) { return [p.id, p]; }));
      var slugs = new Set(articles.map(function (p) { return p.slug; }));
      var nouveaux = [], remplis = new Map(), reecrits = new Map();
      (plan.posts || []).forEach(function (p) {
        var cur = parId.get(p.id);
        if (!cur) { if (!slugs.has(p.slug)) nouveaux.push(p); return; }
        if (estPlan(cur)) { if (JSON.stringify(Object.assign({}, cur, { id: 0, countries: 0 })) !== JSON.stringify(Object.assign({}, p, { id: 0, countries: 0 }))) remplis.set(p.id, p); }
        else if (p.written && (p.contentVersion || 1) > (cur.contentVersion || 1)) reecrits.set(p.id, Object.assign({}, p, { published: !!cur.published, publishedAt: cur.publishedAt || p.publishedAt }));
      });
      if (!nouveaux.length && !remplis.size && !reecrits.size) { toast('Le plan éditorial est déjà à jour.'); return; }
      var lignes = [];
      if (nouveaux.length) lignes.push(pluriel(nouveaux.length, 'brouillon') + ' à ajouter');
      if (remplis.size) lignes.push(pluriel(remplis.size, 'brouillon') + ' encore vide' + (remplis.size > 1 ? 's' : '') + ' à mettre à jour');
      var reecrire = false;
      if (reecrits.size) {
        reecrire = await demander('Nouvelle version d’articles rédigés', 'Une version plus récente existe pour : <br>' + Array.from(reecrits.values()).map(function (p) { return '· ' + esc(p.title); }).join('<br>') + '<br><br>La remplacer ? Vos modifications faites ici sur ces articles seront perdues (une copie est gardée dans l’historique des versions). Leur état, publié ou brouillon, est conservé.', 'Remplacer');
      }
      if (lignes.length && !(await demander('Importer le plan éditorial', lignes.join(' et ') + '. Rien n’est publié, et les articles que vous avez modifiés ne sont pas touchés.', 'Importer'))) { nouveaux = []; remplis.clear(); }
      if (!nouveaux.length && !remplis.size && !reecrire) return;
      var maj = articles.map(function (p) { return remplis.get(p.id) || (reecrire && reecrits.get(p.id)) || p; }).concat(nouveaux);
      await api('POST', '/api/admin/blog', { posts: maj });
      S.cache.articles = undefined;
      await donnees('articles');
      toast('Plan importé : ' + nouveaux.length + ' ajouté(s), ' + remplis.size + ' mis à jour' + (reecrire ? ', ' + reecrits.size + ' remplacé(s)' : '') + '.');
      router();
    } catch (e) { toast(e.message, 'alerte'); }
  }

  // ---------------------------------------------------------------------------------------------
  // Éditeur d'article
  // ---------------------------------------------------------------------------------------------
  var calloutPret = false;
  function preparerQuill() {
    if (calloutPret || !window.Quill) return;
    calloutPret = true;
    var Block = Quill.import('blots/block');
    class Callout extends Block {
      static create(v) { var n = super.create(); if (v) n.setAttribute('data-callout', v); return n; }
      static formats(n) { return n.getAttribute('data-callout') || undefined; }
      format(nom, v) { if (nom === 'callout') { if (v) this.domNode.setAttribute('data-callout', v); else this.domNode.removeAttribute('data-callout'); } else super.format(nom, v); }
    }
    Callout.blotName = 'callout';
    Callout.tagName = 'blockquote';
    Quill.register({ 'formats/callout': Callout }, true);
  }

  VUES.article = async function (id) {
    var articles = await donnees('articles');
    var nouveau = id === 'nouveau';
    var p = nouveau ? { id: nouvelId(), title: '', slug: '', description: '', category: 'visa', countries: [], tags: [], content: '', published: false, author: 'PVT Explorer' } : articles.find(function (x) { return x.id === id; });
    if (!p) { entete('Article introuvable'); vue.innerHTML = '<div class="avis avis--alerte">Cet article n’existe pas ou a été supprimé. <a class="lien-action" href="#/articles">Retour aux articles</a></div>'; return; }
    p = JSON.parse(JSON.stringify(p));
    E = { post: p, nouveau: nouveau, sale: false, versionLue: p.modifieLe || '', slugManuel: !nouveau && !!p.slug, quill: null };
    var st = statut(p) === 'plan' ? 'brouillon' : statut(p);
    entete(nouveau ? 'Nouvel article' : 'Modifier l’article', nouveau ? '' : '/blog/' + p.slug,
      '<a class="btn btn--doux" href="#/articles">' + icone('retour') + 'Articles</a><button class="btn" type="button" id="e-enregistrer-haut">Enregistrer</button>');

    var chipsPays = PAYS.map(function (x) { return '<button class="chip" type="button" data-pays="' + esc(x[0]) + '" aria-pressed="' + ((p.countries || []).indexOf(x[0]) !== -1) + '"><span class="data">' + x[1] + '</span>' + esc(x[2]) + '</button>'; }).join('') +
      (p.countries || []).filter(function (k) { return !PAYS.some(function (x) { return x[0] === k; }); }).map(function (k) { return '<button class="chip" type="button" data-pays="' + esc(k) + '" aria-pressed="true">' + esc(k) + '</button>'; }).join('');

    vue.innerHTML =
      '<div class="avis" id="brouillon-local" hidden></div>' +
      '<div class="editeur">' +
        '<div class="editeur__principal">' +
          '<label class="visually-hidden" for="e-titre">Titre de l’article</label><textarea class="editeur__titre" id="e-titre" rows="1" placeholder="Titre de l’article">' + esc(p.title) + '</textarea>' +
          '<div id="e-quill"></div>' +
        '</div>' +
        '<aside class="editeur__cote" aria-label="Réglages de l’article">' +
          '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Publication</h2><span class="editeur__etat" id="e-etat">' + (nouveau ? 'Nouveau' : 'Enregistré le ' + dateFr(p.modifieLe || p.updatedAt, true)) + '</span></div><div class="panneau__corps">' +
            '<div class="segments" role="radiogroup" aria-label="État de l’article">' + [['brouillon', 'Brouillon'], ['enligne', 'En ligne'], ['programme', 'Programmé']].map(function (o) { return '<label><input type="radio" name="e-statut" value="' + o[0] + '"' + (st === o[0] ? ' checked' : '') + '>' + o[1] + '</label>'; }).join('') + '</div>' +
            '<div class="field" id="e-quand"' + (st === 'programme' ? '' : ' hidden') + '><label class="label" for="e-date">Mise en ligne le</label><input type="datetime-local" id="e-date" value="' + versLocal(st === 'programme' ? p.publishedAt : '') + '"><p class="aide">L’article apparaît tout seul sur le site, dans les guides, le sitemap et le bandeau, à cette heure-là.</p></div>' +
            '<div class="boutons-ligne"><button class="btn" type="button" id="e-enregistrer">Enregistrer</button><button class="btn btn--doux" type="button" id="e-apercu">' + icone('oeil') + 'Aperçu</button></div>' +
            '<p class="aide">Raccourci : Ctrl ou ⌘ + S. ' + (nouveau ? '' : '<button class="lien-action" type="button" id="e-versions">Versions précédentes</button>') + (statut(p) === 'enligne' ? ' · <a class="lien-action" href="/blog/' + esc(p.slug) + '" target="_blank" rel="noopener">Voir en ligne</a>' : '') + '</p>' +
          '</div></section>' +
          '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Référencement</h2><span class="note-seo" id="e-note"></span></div><div class="panneau__corps">' +
            '<div class="google" aria-label="Aperçu dans Google"><span class="google__site"><svg><use href="#i-avion"/></svg><span>PVT Explorer<span class="google__url" id="g-url"></span></span></span><span class="google__titre" id="g-titre"></span><span class="google__desc" id="g-desc"></span></div>' +
            '<div class="field"><div class="field__ligne"><label class="label" for="e-slug">Adresse</label><span class="compteur data">/blog/…</span></div><input id="e-slug" value="' + esc(p.slug) + '" spellcheck="false" autocomplete="off"><p class="avis" id="e-slug-avis" hidden>Cet article est en ligne : l’ancienne adresse redirigera automatiquement vers la nouvelle (redirection 301), sans perdre son référencement.</p></div>' +
            '<div class="field"><div class="field__ligne"><label class="label" for="e-desc">Description pour Google</label><span class="compteur" id="c-desc"></span></div><textarea id="e-desc" rows="3" maxlength="200">' + esc(p.description) + '</textarea></div>' +
            '<div class="field"><label class="label" for="e-kw">Mot-clé principal</label><input id="e-kw" value="' + esc(p.focusKeyword || '') + '" placeholder="ex. pvt australie" autocomplete="off"></div>' +
            '<ul class="controles" id="e-controles"></ul>' +
          '</div></section>' +
          '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Classement</h2></div><div class="panneau__corps">' +
            '<div class="field"><label class="label" for="e-cat">Catégorie</label><select id="e-cat">' + Object.keys(CATEGORIES).map(function (k) { return '<option value="' + esc(k) + '"' + (p.category === k ? ' selected' : '') + '>' + CATEGORIES[k] + '</option>'; }).join('') + '</select><p class="aide" id="e-cat-aide"' + (p.category === 'actualites' ? '' : ' hidden') + '>Catégorie « Actualités » : l’article remonte aussi sur la page Actualités et dans le bandeau de l’accueil, sous ses pays.</p></div>' +
            '<div class="field"><span class="label" id="e-pays-titre">Pays</span><div class="puces" role="group" aria-labelledby="e-pays-titre" id="e-pays">' + chipsPays + '</div></div>' +
            '<div class="field"><label class="label" for="e-tags">Mots-clés secondaires</label><input id="e-tags" value="' + esc((p.tags || []).join(', ')) + '" placeholder="séparés par des virgules"></div>' +
          '</div></section>' +
          '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Image à la une</h2></div><div class="panneau__corps image-une">' +
            '<img id="e-img-voir" alt="" ' + (p.image ? 'src="' + esc(p.image) + '"' : 'hidden') + '>' +
            '<div class="boutons-ligne"><button class="btn btn--doux" type="button" id="e-img-choisir">' + icone('image') + 'Choisir</button><button class="btn btn--doux" type="button" id="e-img-retirer"' + (p.image ? '' : ' hidden') + '>Retirer</button></div>' +
            '<div class="field"><label class="label" for="e-img">Adresse de l’image</label><input id="e-img" value="' + esc(p.image || '') + '" placeholder="/images/… ou https://…"></div>' +
            '<div class="field"><div class="field__ligne"><label class="label" for="e-alt">Texte alternatif</label><span class="compteur" id="c-alt"></span></div><input id="e-alt" maxlength="160" value="' + esc(p.imageAlt || '') + '" placeholder="Ce que montre la photo, avec le mot-clé"></div>' +
          '</div></section>' +
          '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Lecture</h2><span class="data" id="e-mots"></span></div><div class="panneau__corps">' +
            '<div class="field"><label class="label" for="e-lecture">Temps de lecture (minutes)</label><input type="number" id="e-lecture" min="1" max="90" value="' + (p.readingTime || '') + '" placeholder="calculé"></div>' +
          '</div></section>' +
          (nouveau ? '' : '<button class="btn btn--danger" type="button" id="e-corbeille">' + icone('poubelle') + 'Mettre à la corbeille</button>') +
        '</aside>' +
      '</div>';

    // Éditeur de texte
    preparerQuill();
    var q = new Quill('#e-quill', {
      theme: 'snow',
      placeholder: 'Écrivez votre article…',
      modules: { toolbar: [[{ header: [2, 3, false] }], ['bold', 'italic', 'underline'], [{ list: 'ordered' }, { list: 'bullet' }], ['link'], ['clean']] }
    });
    E.quill = q;
    if (p.content) q.clipboard.dangerouslyPasteHTML(p.content, 'silent');
    var barre = document.createElement('div');
    barre.className = 'inserer';
    barre.innerHTML = '<span class="inserer__titre">Insérer</span><button type="button" data-ins="image">Photo</button><button type="button" data-ins="tableau">Tableau</button>' +
      [['tip', 'Astuce'], ['warning', 'Attention'], ['danger', 'À éviter'], ['info', 'Info'], ['key', 'Chiffre clé']].map(function (c) { return '<button type="button" data-callout="' + c[0] + '">' + c[1] + '</button>'; }).join('') +
      '<button type="button" data-ins="lien">Lien vers un article</button>';
    var tb = vue.querySelector('.ql-toolbar');
    tb.parentNode.insertBefore(barre, tb.nextSibling);
    barre.addEventListener('click', function (e) {
      var b = e.target.closest('button');
      if (!b) return;
      var sel = q.getSelection(true);
      if (b.hasAttribute('data-callout')) { var t = b.getAttribute('data-callout'); q.format('callout', q.getFormat(sel).callout === t ? false : t, 'user'); return; }
      var ins = b.getAttribute('data-ins');
      if (ins === 'image') choisirImage(function (url, alt) { var i = (sel || {}).index || q.getLength() - 1; q.insertEmbed(i, 'image', url, 'user'); q.setSelection(i + 1, 0); setTimeout(function () { var img = $$('img[src="' + CSS.escape(url) + '"]', q.root).pop(); if (img && alt) img.setAttribute('alt', alt); marquerSale(); }, 30); });
      if (ins === 'tableau') {
        var html = '<table><thead><tr><th>Colonne 1</th><th>Colonne 2</th><th>Colonne 3</th></tr></thead><tbody><tr><td>…</td><td>…</td><td>…</td></tr><tr><td>…</td><td>…</td><td>…</td></tr></tbody></table><p><br></p>';
        q.clipboard.dangerouslyPasteHTML(sel ? sel.index : q.getLength(), html, 'user');
      }
      if (ins === 'lien') choisirArticle(function (a) {
        var s2 = sel || { index: q.getLength() - 1, length: 0 };
        if (s2.length) q.formatText(s2.index, s2.length, 'link', '/blog/' + a.slug, 'user');
        else { q.insertText(s2.index, a.title, 'link', '/blog/' + a.slug, 'user'); }
      });
    });

    // Champs
    var champs = ['#e-titre', '#e-slug', '#e-desc', '#e-kw', '#e-cat', '#e-tags', '#e-img', '#e-alt', '#e-lecture', '#e-date'];
    var analyse = differer(majAnalyse, 250);
    champs.forEach(function (s) { $(s).addEventListener('input', function () { marquerSale(); analyse(); }); });
    q.on('text-change', function (d, old, source) { if (source === 'user') { marquerSale(); analyse(); } });
    var titreEl = $('#e-titre');
    var ajusterTitre = function () { titreEl.style.height = 'auto'; titreEl.style.height = titreEl.scrollHeight + 'px'; };
    titreEl.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); q.focus(); } });
    titreEl.addEventListener('input', function () { this.value = this.value.replace(/\s*\n\s*/g, ' '); ajusterTitre(); if (!E.slugManuel) $('#e-slug').value = slugifier(this.value); });
    requestAnimationFrame(ajusterTitre);
    $('#e-slug').addEventListener('input', function () {
      E.slugManuel = true;
      var propre = slugifier(this.value.replace(/-/g, ' '));
      if (this.value !== propre && !/-$/.test(this.value)) this.value = propre;
      $('#e-slug-avis').hidden = !(statut(E.post) === 'enligne' && E.post.slug && this.value !== E.post.slug);
    });
    $('#e-cat').addEventListener('change', function () { $('#e-cat-aide').hidden = this.value !== 'actualites'; marquerSale(); analyse(); });
    $('#e-pays').addEventListener('click', function (e) { var c = e.target.closest('[data-pays]'); if (!c) return; c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); marquerSale(); });
    $$('input[name=e-statut]').forEach(function (r) { r.addEventListener('change', function () { $('#e-quand').hidden = this.value !== 'programme'; marquerSale(); }); });
    $('#e-img').addEventListener('change', majImage);
    $('#e-img-choisir').addEventListener('click', function () { choisirImage(function (url) { $('#e-img').value = url; majImage(); marquerSale(); analyse(); }); });
    $('#e-img-retirer').addEventListener('click', function () { $('#e-img').value = ''; majImage(); marquerSale(); analyse(); });
    $('#e-enregistrer').addEventListener('click', enregistrer);
    $('#e-enregistrer-haut').addEventListener('click', enregistrer);
    $('#e-apercu').addEventListener('click', apercu);
    if ($('#e-versions')) $('#e-versions').addEventListener('click', versions);
    if ($('#e-corbeille')) $('#e-corbeille').addEventListener('click', async function () {
      if (!(await demander('Mettre à la corbeille ?', '« ' + esc(E.post.title) + ' » quitte le site. Vous pourrez le restaurer depuis la corbeille.', 'Mettre à la corbeille', true))) return;
      try { await api('POST', '/api/admin/article/supprimer', { id: E.post.id }); S.cache.articles = undefined; E.sale = false; toast('Article mis à la corbeille.'); location.hash = '#/articles'; }
      catch (err) { toast(err.message, 'alerte'); }
    });
    majAnalyse();

    // Brouillon gardé sur cet appareil
    var local = relire('pvt-admin-brouillon:' + p.id);
    if (local && local.post && local.t > (Date.parse(p.modifieLe || p.updatedAt || 0) || 0) && JSON.stringify(local.post.content) !== JSON.stringify(p.content)) {
      var avis = $('#brouillon-local');
      avis.hidden = false;
      avis.innerHTML = 'Une version non enregistrée de cet article existe sur cet appareil (' + dateFr(new Date(local.t).toISOString(), true) + ' à ' + heureFr(new Date(local.t).toISOString()) + ').<button class="lien-action" type="button" data-local="oui">La reprendre</button><button class="lien-action" type="button" data-local="non">L’ignorer</button>';
      avis.addEventListener('click', function (e) {
        var b = e.target.closest('[data-local]');
        if (!b) return;
        if (b.getAttribute('data-local') === 'oui') { remplir(local.post); marquerSale(); }
        else stocker('pvt-admin-brouillon:' + p.id, null);
        avis.hidden = true;
      });
    }
    $('#e-titre').focus();
  };

  function marquerSale() {
    if (!E) return;
    E.sale = true;
    var etat = $('#e-etat');
    if (etat) { etat.textContent = 'Modifications non enregistrées'; etat.setAttribute('data-sale', 'true'); }
    gardeLocale();
  }
  var gardeLocale = differer(function () { if (E && E.sale) stocker('pvt-admin-brouillon:' + E.post.id, { t: Date.now(), post: lireFormulaire() }); }, 1200);

  function majImage() {
    var u = $('#e-img').value.trim(), img = $('#e-img-voir');
    img.hidden = !u;
    if (u) img.src = u; else img.removeAttribute('src');
    $('#e-img-retirer').hidden = !u;
  }

  function contenuHtml() {
    var q = E.quill;
    if (!q) return E.post.content || '';
    var vide = !q.getText().trim() && !q.root.querySelector('img,table');
    return vide ? '' : q.root.innerHTML;
  }
  function lireFormulaire() {
    var p = Object.assign({}, E.post);
    var st = ($('input[name=e-statut]:checked') || {}).value || 'brouillon';
    p.title = $('#e-titre').value.trim();
    p.slug = $('#e-slug').value.trim().replace(/-+$/, '');
    p.description = $('#e-desc').value.trim();
    p.focusKeyword = $('#e-kw').value.trim();
    p.category = $('#e-cat').value;
    p.countries = $$('#e-pays [aria-pressed=true]').map(function (c) { return c.getAttribute('data-pays'); });
    p.tags = $('#e-tags').value.split(',').map(function (t) { return t.trim(); }).filter(Boolean);
    p.image = $('#e-img').value.trim();
    p.imageAlt = $('#e-alt').value.trim();
    p.content = contenuHtml();
    var mots = compterMots(doc(p.content).body.textContent || '');
    p.readingTime = parseInt($('#e-lecture').value, 10) || Math.max(1, Math.round(mots / 220));
    if (st === 'brouillon') p.published = false;
    else if (st === 'enligne') { p.published = true; if (statut(E.post) !== 'enligne') p.publishedAt = aujourdhui(); }
    else { p.published = true; var d = Date.parse($('#e-date').value); p.publishedAt = isNaN(d) ? p.publishedAt : new Date(d).toISOString(); }
    p.updatedAt = aujourdhui();
    p.author = p.author || 'PVT Explorer';
    return p;
  }
  function remplir(p) {
    $('#e-titre').value = p.title || '';
    $('#e-slug').value = p.slug || '';
    $('#e-desc').value = p.description || '';
    $('#e-kw').value = p.focusKeyword || '';
    $('#e-cat').value = p.category || 'visa';
    $('#e-tags').value = (p.tags || []).join(', ');
    $('#e-img').value = p.image || '';
    $('#e-alt').value = p.imageAlt || '';
    $('#e-lecture').value = p.readingTime || '';
    $$('#e-pays [data-pays]').forEach(function (c) { c.setAttribute('aria-pressed', String((p.countries || []).indexOf(c.getAttribute('data-pays')) !== -1)); });
    E.quill.setContents([], 'silent');
    if (p.content) E.quill.clipboard.dangerouslyPasteHTML(p.content, 'silent');
    majImage();
    majAnalyse();
  }

  function majAnalyse() {
    if (!E) return;
    var p = lireFormulaire();
    var a = analyser(p, S.cache.articles || []);
    var titre = p.title || 'Titre de l’article';
    $('#g-url').textContent = ' › blog › ' + (p.slug || 'adresse');
    $('#g-titre').textContent = (titre.length > 60 ? titre.slice(0, 58) + '…' : titre) + ' | PVT Explorer';
    $('#g-desc').textContent = p.description ? (p.description.length > 158 ? p.description.slice(0, 156) + '…' : p.description) : 'Ajoutez une description : Google en fabriquera une sinon, souvent moins engageante.';
    var cd = $('#c-desc'), n = p.description.length;
    cd.textContent = n + ' / 160';
    cd.setAttribute('data-etat', n > 160 ? 'trop' : n >= 110 ? 'bien' : '');
    var ca = $('#c-alt'), na = p.imageAlt.length;
    ca.textContent = na + ' / 125';
    ca.setAttribute('data-etat', na > 125 ? 'trop' : na >= 10 ? 'bien' : '');
    var note = $('#e-note');
    note.textContent = a.note + ' / 100';
    note.setAttribute('data-ton', tonNote(a.note));
    $('#e-controles').innerHTML = a.controles.slice().sort(function (x, y) { return (x.ok - y.ok) || ((y.niveau === 'erreur') - (x.niveau === 'erreur')); })
      .map(function (c) { return '<li data-ok="' + c.ok + '" data-niveau="' + (c.ok ? 'ok' : c.niveau) + '"><span class="visually-hidden">' + (c.ok ? 'Validé : ' : c.niveau === 'erreur' ? 'À corriger : ' : 'Conseil : ') + '</span>' + esc(c.texte) + '</li>'; }).join('');
    $('#e-mots').textContent = pluriel(a.mots, 'mot') + ' · ' + Math.max(1, Math.round(a.mots / 220)) + ' min';
    $('#e-lecture').placeholder = 'calculé : ' + Math.max(1, Math.round(a.mots / 220));
  }

  async function enregistrer(forcer) {
    if (!E) return;
    var p = lireFormulaire();
    if (!p.title) { toast('Donnez un titre à l’article.', 'alerte'); $('#e-titre').focus(); return; }
    if (!p.slug) { p.slug = slugifier(p.title); $('#e-slug').value = p.slug; }
    var st = ($('input[name=e-statut]:checked') || {}).value;
    if (st === 'programme' && !(Date.parse(p.publishedAt) > Date.now())) { toast('Choisissez une date de mise en ligne dans le futur.', 'alerte'); $('#e-date').focus(); return; }
    var b = $('#e-enregistrer');
    b.disabled = true; b.textContent = 'Enregistrement…';
    try {
      var d = await api('POST', '/api/admin/article', { post: p, versionLue: E.versionLue, forcer: forcer === true });
      var articles = S.cache.articles || [];
      var i = articles.findIndex(function (x) { return x.id === d.post.id; });
      if (i >= 0) articles[i] = d.post; else articles.unshift(d.post);
      E.post = d.post; E.versionLue = d.post.modifieLe; E.sale = false;
      stocker('pvt-admin-brouillon:' + d.post.id, null);
      majCompteurs();
      var etat = $('#e-etat');
      etat.textContent = 'Enregistré à ' + heureFr(d.post.modifieLe);
      etat.removeAttribute('data-sale');
      $('#e-slug-avis').hidden = true;
      var msg = statut(d.post) === 'enligne' ? 'Article enregistré et en ligne.' : statut(d.post) === 'programme' ? 'Article programmé pour le ' + dateFr(d.post.publishedAt) + ' à ' + heureFr(d.post.publishedAt) + '.' : 'Brouillon enregistré.';
      if (d.redirection) msg += ' L’ancienne adresse redirige vers la nouvelle.';
      toast(msg);
      if (E.nouveau) { E.nouveau = false; hashCourant = '#/articles/' + encodeURIComponent(d.post.id); history.replaceState(null, '', hashCourant); $('#titre-vue').textContent = 'Modifier l’article'; document.title = 'Modifier l’article | Espace auteur PVT Explorer'; info('/blog/' + d.post.slug); }
      else info('/blog/' + d.post.slug);
    } catch (e) {
      if (e.donnees && e.donnees.conflit) {
        if (await demander('Conflit de version', 'Cet article a été enregistré ailleurs (autre onglet ou autre appareil) le ' + dateFr(e.donnees.modifieLe) + ' à ' + heureFr(e.donnees.modifieLe) + '. Écraser cette version par la vôtre ? L’autre version reste récupérable dans les versions précédentes.', 'Écraser', true)) return enregistrer(true);
      } else toast(e.message, 'alerte');
    } finally { b.disabled = false; b.textContent = 'Enregistrer'; }
  }
  document.addEventListener('keydown', function (e) {
    if (E && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); enregistrer(); }
  });

  async function apercu() {
    try {
      var html = await api('POST', '/api/admin/apercu', { post: lireFormulaire() }, { texte: true });
      var cadre = $('#apercu-cadre');
      cadre.srcdoc = html;
      cadre.style.maxWidth = '100%';
      $$('#apercu [data-largeur]').forEach(function (b, i) { b.setAttribute('aria-pressed', String(i === 0)); });
      $('#apercu').showModal();
    } catch (e) { toast(e.message, 'alerte'); }
  }
  $('#apercu').addEventListener('click', function (e) {
    var b = e.target.closest('[data-largeur]');
    if (!b) return;
    $('#apercu-cadre').style.maxWidth = b.getAttribute('data-largeur');
    $$('#apercu [data-largeur]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
  });

  async function versions() {
    var corps = ouvrirFenetre('Versions précédentes', '<p class="aide">Chargement…</p>');
    try {
      var d = await api('GET', '/api/admin/revisions/' + encodeURIComponent(E.post.id));
      var v = d.versions || [];
      corps.innerHTML = v.length ? '<p class="aide">Les 12 dernières versions sont gardées à chaque enregistrement. Charger une version la place dans l’éditeur : rien n’est modifié tant que vous n’enregistrez pas.</p><ul class="versions">' + v.map(function (x, i) {
        return '<li><span><strong>' + esc(x.post.title) + '</strong><br><span class="data">' + dateFr(x.enregistreLe, true) + ' à ' + heureFr(x.enregistreLe) + ' · ' + pluriel(compterMots(doc(x.post.content).body.textContent || ''), 'mot') + ' · ' + (TAMPONS[statut(x.post)] || ['—'])[0] + '</span></span><button class="btn btn--doux" type="button" data-version="' + i + '">Charger</button></li>';
      }).join('') + '</ul>' : '<p class="panneau__vide">Pas encore de version précédente : elles apparaissent à partir du deuxième enregistrement.</p>';
      corps.addEventListener('click', function (e) {
        var b = e.target.closest('[data-version]');
        if (!b) return;
        remplir(v[+b.getAttribute('data-version')].post);
        marquerSale();
        fermerFenetre();
        toast('Version chargée : enregistrez pour la rétablir.');
      });
    } catch (e) { corps.innerHTML = '<div class="avis avis--alerte">' + esc(e.message) + '</div>'; }
  }

  function choisirArticle(rappel) {
    var articles = (S.cache.articles || []).filter(function (x) { return !E || x.id !== E.post.id; });
    var corps = ouvrirFenetre('Lien vers un article', '<input class="champ champ--recherche" type="search" placeholder="Rechercher un article" aria-label="Rechercher un article" id="choix-q"><ul class="taches" id="choix-liste" style="max-height:50vh;overflow:auto"></ul><p class="aide">Un lien vers un article pas encore en ligne s’affiche comme du texte simple jusqu’à sa publication.</p>');
    var dessiner = function () {
      var q = norm($('#choix-q').value);
      $('#choix-liste').innerHTML = articles.filter(function (x) { return !q || norm(x.title + ' ' + x.slug).indexOf(q) !== -1; }).slice(0, 40)
        .map(function (x) { return '<li>' + tampon(statut(x)) + '<a href="#" data-choix="' + esc(x.id) + '">' + esc(x.title) + '</a></li>'; }).join('');
    };
    dessiner();
    $('#choix-q').addEventListener('input', dessiner);
    $('#choix-q').focus();
    corps.addEventListener('click', function (e) {
      var a = e.target.closest('[data-choix]');
      if (!a) return;
      e.preventDefault();
      fermerFenetre();
      rappel(articles.find(function (x) { return x.id === a.getAttribute('data-choix'); }));
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Images : envoi compressé, bibliothèque, usage
  // ---------------------------------------------------------------------------------------------
  async function compresser(fichier) {
    if (!/^image\/(jpeg|png|webp)$/.test(fichier.type) || !window.createImageBitmap) return fichier;
    try {
      var bmp = await createImageBitmap(fichier);
      var max = 1800, ratio = Math.min(1, max / Math.max(bmp.width, bmp.height));
      if (ratio === 1 && fichier.size < 450000) return fichier;
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * ratio); c.height = Math.round(bmp.height * ratio);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      var blob = await new Promise(function (r) { c.toBlob(r, 'image/webp', 0.82); });
      if (!blob || blob.size >= fichier.size) return fichier;
      return new File([blob], fichier.name.replace(/\.[a-z0-9]+$/i, '') + '.webp', { type: 'image/webp' });
    } catch (e) { return fichier; }
  }
  async function envoyerImages(fichiers, suivi) {
    var envoyees = [];
    for (var i = 0; i < fichiers.length; i++) {
      var f = fichiers[i];
      if (!/^image\//.test(f.type)) { toast(f.name + ' : ce n’est pas une image.', 'alerte'); continue; }
      if (suivi) suivi('Préparation de ' + f.name + '…');
      var c = await compresser(f);
      if (c.size > 3.5 * 1024 * 1024) { toast(f.name + ' : trop lourde, même compressée (3,5 Mo au plus).', 'alerte'); continue; }
      if (suivi) suivi('Envoi de ' + c.name + ' (' + Math.round(c.size / 1024) + ' Ko)…');
      var data = await new Promise(function (res) { var r = new FileReader(); r.onload = function () { res(String(r.result).split(',')[1]); }; r.readAsDataURL(c); });
      try {
        var d = await api('POST', '/api/admin/upload', { filename: c.name, contentType: c.type, data: data });
        envoyees.push(d.url);
      } catch (e) { toast(f.name + ' : ' + e.message, 'alerte'); }
    }
    if (envoyees.length) { S.cache.images = undefined; toast(pluriel(envoyees.length, 'image envoyée', 'images envoyées') + '.'); }
    return envoyees;
  }
  function usageImages() {
    var u = {};
    (S.cache.articles || []).forEach(function (p) {
      var texte = (p.image || '') + ' ' + (p.content || '');
      (S.cache.images || []).forEach(function (img) { if (texte.indexOf(img.url) !== -1) (u[img.url] = u[img.url] || []).push(p); });
    });
    return u;
  }
  function depotHtml(id) { return '<label class="depot" id="' + id + '">' + icone('image') + '<span><strong>Glissez des photos ici</strong> ou cliquez pour choisir</span><span class="aide">JPG, PNG ou WebP. Les grandes photos sont réduites à 1 800 px et converties en WebP avant l’envoi.</span><input type="file" accept="image/*" multiple hidden></label>'; }
  function brancherDepot(zone, apres) {
    var input = $('input', zone), texte = $('span', zone);
    var depart = texte.innerHTML;
    var envoyer = async function (fichiers) {
      var urls = await envoyerImages(Array.prototype.slice.call(fichiers), function (t) { texte.textContent = t; });
      texte.innerHTML = depart; input.value = '';
      if (apres) apres(urls);
    };
    input.addEventListener('change', function () { envoyer(this.files); });
    zone.addEventListener('dragover', function (e) { e.preventDefault(); zone.classList.add('is-dessus'); });
    zone.addEventListener('dragleave', function () { zone.classList.remove('is-dessus'); });
    zone.addEventListener('drop', function (e) { e.preventDefault(); zone.classList.remove('is-dessus'); envoyer(e.dataTransfer.files); });
  }
  function nomImage(img) { return decodeURIComponent((img.pathname || img.url).split('/').pop()); }

  VUES.images = async function () {
    entete('Images', '');
    var r = await Promise.all([donnees('images'), donnees('articles').catch(function () { return []; })]);
    var images = r[0];
    vue.innerHTML = depotHtml('depot') + '<div class="barre"><input class="champ champ--recherche" type="search" id="img-q" placeholder="Rechercher par nom de fichier" aria-label="Rechercher une image"><div class="onglets" role="group" aria-label="Filtre"><button class="chip" type="button" data-usage="" aria-pressed="true">Toutes</button><button class="chip" type="button" data-usage="non" aria-pressed="false">Inutilisées</button></div></div><div class="galerie" id="galerie"></div>';
    var filtre = '';
    var dessiner = function () {
      var usage = usageImages(), q = norm($('#img-q').value);
      var liste = images.filter(function (i) { return (!q || norm(nomImage(i)).indexOf(q) !== -1) && (filtre !== 'non' || !usage[i.url]); });
      info(pluriel(images.length, 'image') + ' · ' + Math.round(images.reduce(function (s, i) { return s + (i.size || 0); }, 0) / 1048576 * 10) / 10 + ' Mo');
      $('#galerie').innerHTML = liste.length ? liste.map(function (img) {
        var u = usage[img.url] || [];
        return '<figure class="panneau vignette-img"><img src="' + esc(img.url) + '" alt="" loading="lazy"><figcaption class="vignette-img__info"><span class="vignette-img__nom" title="' + esc(nomImage(img)) + '">' + esc(nomImage(img)) + '</span>' +
          '<span class="vignette-img__ligne"><span class="data" title="' + esc(u.map(function (p) { return p.title; }).join(' · ')) + '">' + (u.length ? 'Utilisée · ' + u.length : 'Inutilisée') + ' · ' + Math.round((img.size || 0) / 1024) + ' Ko</span>' +
          '<button class="icone" type="button" data-copier="' + esc(img.url) + '" title="Copier l’adresse">' + icone('copier') + '<span class="visually-hidden">Copier l’adresse de ' + esc(nomImage(img)) + '</span></button>' +
          '<button class="icone icone--danger" type="button" data-supprimer-img="' + esc(img.url) + '" title="Supprimer">' + icone('poubelle') + '<span class="visually-hidden">Supprimer ' + esc(nomImage(img)) + '</span></button></span></figcaption></figure>';
      }).join('') : '<p class="panneau panneau__vide" style="grid-column:1/-1">' + (images.length ? 'Aucune image ne correspond.' : 'Aucune image pour l’instant : glissez vos premières photos ci-dessus.') + '</p>';
    };
    brancherDepot($('#depot'), async function (urls) { if (urls.length) { images = await donnees('images', true); dessiner(); } });
    $('#img-q').addEventListener('input', dessiner);
    vue.addEventListener('click', async function (e) {
      var f = e.target.closest('[data-usage]');
      if (f) { filtre = f.getAttribute('data-usage'); $$('[data-usage]', vue).forEach(function (x) { x.setAttribute('aria-pressed', String(x === f)); }); dessiner(); }
      var c = e.target.closest('[data-copier]');
      if (c) { try { await navigator.clipboard.writeText(c.getAttribute('data-copier')); toast('Adresse copiée.'); } catch (err) { toast('Copie impossible : sélectionnez l’adresse à la main.', 'alerte'); } }
      var s = e.target.closest('[data-supprimer-img]');
      if (s) {
        var url = s.getAttribute('data-supprimer-img'), u = usageImages()[url] || [];
        var txt = u.length ? 'Attention : elle est utilisée dans ' + pluriel(u.length, 'article') + ' (' + u.map(function (p) { return '« ' + esc(p.title) + ' »'; }).join(', ') + ') et y disparaîtra.' : 'Elle n’est utilisée dans aucun article.';
        if (!(await demander('Supprimer cette image ?', txt + ' La suppression est définitive.', 'Supprimer', true))) return;
        try { await api('POST', '/api/admin/delete-image', { url: url }); images = images.filter(function (i) { return i.url !== url; }); S.cache.images = images; toast('Image supprimée.'); dessiner(); }
        catch (err) { toast(err.message, 'alerte'); }
      }
    });
    dessiner();
  };

  async function choisirImage(rappel) {
    var corps = ouvrirFenetre('Choisir une image', depotHtml('depot-choix') + '<div class="field"><label class="label" for="choix-alt">Texte alternatif (pour une photo insérée dans l’article)</label><input id="choix-alt" placeholder="Ce que montre la photo"></div><div class="galerie" id="choix-galerie"><p class="aide">Chargement…</p></div>');
    var dessiner = function (images) {
      $('#choix-galerie', corps).innerHTML = images.length ? images.map(function (img) { return '<button class="panneau vignette-img" type="button" data-choisir="' + esc(img.url) + '"><img src="' + esc(img.url) + '" alt="" loading="lazy"><span class="vignette-img__info"><span class="vignette-img__nom">' + esc(nomImage(img)) + '</span></span></button>'; }).join('') : '<p class="aide">Aucune image : envoyez-en une ci-dessus.</p>';
    };
    brancherDepot($('#depot-choix', corps), async function (urls) { if (urls.length) { fermerFenetre(); rappel(urls[0], $('#choix-alt') ? $('#choix-alt').value.trim() : ''); } });
    corps.addEventListener('click', function (e) {
      var b = e.target.closest('[data-choisir]');
      if (!b) return;
      var alt = $('#choix-alt').value.trim();
      fermerFenetre();
      rappel(b.getAttribute('data-choisir'), alt);
    });
    try { dessiner(await donnees('images')); } catch (e) { $('#choix-galerie', corps).innerHTML = '<div class="avis avis--alerte">' + esc(e.message) + '</div>'; }
  }

  // ---------------------------------------------------------------------------------------------
  // Actualités
  // ---------------------------------------------------------------------------------------------
  VUES.actualites = async function (arg) {
    entete('Actualités', '', '<a class="btn btn--doux" href="/actualites" target="_blank" rel="noopener">' + icone('externe') + 'Voir la page</a><button class="btn" type="button" id="actu-nouvelle">' + icone('plus') + 'Nouvelle actualité</button>');
    var d = await donnees('actus', true);
    var liste = (d.actualites || []).slice();
    var dessiner = function () {
      liste.sort(function (a, b) { return Date.parse(b.date || 0) - Date.parse(a.date || 0); });
      info(pluriel(liste.filter(function (a) { return !a.masque; }).length, 'actualité visible', 'actualités visibles') + ' · ' + liste.length + ' au total');
      vue.innerHTML = (d.depuisDepot ? '<div class="avis">Ces actualités viennent du fichier de départ du site. Dès votre premier enregistrement, elles sont gérées ici.</div>' : '') +
        '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Actualités datées</h2><span class="aide">Elles remontent sur la page Actualités sous leurs pays, dans le bandeau défilant de l’accueil (les 8 plus récentes) et dans la recherche.</span></div>' +
        (liste.length ? '<div class="liste-wrap"><table class="liste"><thead><tr><th>Date</th><th>Actualité</th><th>Pays</th><th>État</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + liste.map(function (a, i) {
          return '<tr><td class="data">' + dateFr(a.date, true) + '</td><td><button class="liste__titre lien-action" style="text-decoration:none;text-align:left" type="button" data-modifier="' + i + '">' + esc(a.titre) + '</button>' + (a.lien ? '<span class="liste__sous">' + esc(a.lien) + '</span>' : '') + '</td><td>' + codes(a.pays) + '</td>' +
            '<td>' + (a.masque ? tampon('x', 'Masquée') : tampon('enligne', 'Visible')) + '</td><td><div class="liste__actions"><button class="icone" type="button" data-modifier="' + i + '" title="Modifier">' + icone('crayon') + '<span class="visually-hidden">Modifier</span></button><button class="icone icone--danger" type="button" data-suppr="' + i + '" title="Supprimer">' + icone('poubelle') + '<span class="visually-hidden">Supprimer</span></button></div></td></tr>';
        }).join('') + '</tbody></table></div>' : '<p class="panneau__vide">Aucune actualité. Ajoutez la première : ouverture d’un tirage, nouveau quota, changement de prix…</p>') + '</section>' +
        '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Publiées depuis Articles</h2><span class="aide">Les articles de la catégorie « Actualités » s’ajoutent automatiquement.</span></div>' +
        ((d.depuisArticles || []).length ? '<ul class="taches">' + d.depuisArticles.map(function (a) { return '<li>' + tampon(a.enLigne ? 'enligne' : 'brouillon') + '<a href="#/articles/' + encodeURIComponent(a.id) + '">' + esc(a.titre) + '</a><span class="data">' + dateFr(a.date, true) + '</span></li>'; }).join('') + '</ul>' : '<p class="panneau__vide">Aucun article dans la catégorie « Actualités ».</p>') + '</section>';
    };
    async function sauver(message) {
      try { var r = await api('POST', '/api/admin/actualites', { actualites: liste }); liste = r.actualites; d.actualites = liste; d.depuisDepot = false; S.cache.actus = d; dessiner(); toast(message); }
      catch (e) { toast(e.message, 'alerte'); }
    }
    function formulaire(i) {
      var a = i == null ? { id: '', date: aujourdhui(), pays: [], titre: '', texte: '', lien: '', lienTexte: '', source: '', masque: false } : Object.assign({}, liste[i]);
      var corps = ouvrirFenetre(i == null ? 'Nouvelle actualité' : 'Modifier l’actualité',
        '<form class="fenetre__corps" style="padding:0" id="f-actu">' +
        '<div class="field"><div class="field__ligne"><label class="label" for="a-titre">Titre</label><span class="compteur" id="c-atitre"></span></div><input id="a-titre" required maxlength="160" value="' + esc(a.titre) + '" placeholder="PVT Canada 2027 : ouverture des bassins le…"><p class="aide">Court et daté : c’est lui qui défile dans le bandeau (110 caractères au plus conseillés).</p></div>' +
        '<div class="field"><label class="label" for="a-date">Date</label><input type="date" id="a-date" value="' + esc((a.date || '').slice(0, 10)) + '" required></div>' +
        '<div class="field"><span class="label" id="a-pays-t">Pays concernés</span><div class="puces" role="group" aria-labelledby="a-pays-t" id="a-pays">' + PAYS.map(function (x) { return '<button class="chip" type="button" data-pays="' + esc(x[0]) + '" aria-pressed="' + ((a.pays || []).map(canonPays).indexOf(x[0]) !== -1) + '"><span class="data">' + x[1] + '</span>' + esc(x[2]) + '</button>'; }).join('') + '</div></div>' +
        '<div class="field"><label class="label" for="a-texte">Texte</label><textarea id="a-texte" maxlength="600" placeholder="Ce qui change, pour qui, à partir de quand.">' + esc(a.texte) + '</textarea></div>' +
        '<div class="field"><label class="label" for="a-lien">Lien vers un guide ou une page</label><input id="a-lien" value="' + esc(a.lien) + '" placeholder="/blog/pvt-canada-2027"></div>' +
        '<div class="field"><label class="label" for="a-lientexte">Texte de ce lien</label><input id="a-lientexte" maxlength="80" value="' + esc(a.lienTexte) + '" placeholder="Comment s’inscrire dès l’ouverture"></div>' +
        '<div class="field"><label class="label" for="a-source">Source officielle</label><input id="a-source" type="url" value="' + esc(a.source) + '" placeholder="https://…"><p class="aide">Indispensable pour une information administrative : elle s’affiche sous l’actualité.</p></div>' +
        '<label class="case"><input type="checkbox" id="a-masque"' + (a.masque ? ' checked' : '') + '>Masquer cette actualité du site</label>' +
        '<div class="fenetre__pied"><button class="btn btn--doux" type="button" data-fermer>Annuler</button><button class="btn" type="submit">Enregistrer</button></div></form>');
      var ct = function () { var n = $('#a-titre').value.length; $('#c-atitre').textContent = n + ' / 110'; $('#c-atitre').setAttribute('data-etat', n > 110 ? 'trop' : n >= 30 ? 'bien' : ''); };
      ct(); $('#a-titre').addEventListener('input', ct);
      $('#a-pays').addEventListener('click', function (e) { var c = e.target.closest('[data-pays]'); if (c) c.setAttribute('aria-pressed', String(c.getAttribute('aria-pressed') !== 'true')); });
      $('#a-titre').focus();
      $('#f-actu', corps).addEventListener('submit', function (e) {
        e.preventDefault();
        var src = $('#a-source').value.trim(), lien = $('#a-lien').value.trim();
        if (lien && !/^(\/|https:\/\/)/.test(lien)) { toast('Le lien doit commencer par / (page du site) ou https://', 'alerte'); return; }
        var n = {
          id: a.id || slugifier($('#a-titre').value).slice(0, 40) + '-' + Math.random().toString(36).slice(2, 5),
          date: $('#a-date').value || aujourdhui(), pays: $$('#a-pays [aria-pressed=true]').map(function (c) { return c.getAttribute('data-pays'); }),
          titre: $('#a-titre').value.trim(), texte: $('#a-texte').value.trim(), lien: lien, lienTexte: $('#a-lientexte').value.trim(), source: src, masque: $('#a-masque').checked
        };
        if (!n.titre) return;
        if (i == null) liste.unshift(n); else liste[i] = n;
        fermerFenetre();
        sauver(i == null ? 'Actualité ajoutée : elle est en ligne.' : 'Actualité enregistrée.');
      });
    }
    $('#actu-nouvelle').addEventListener('click', function () { formulaire(null); });
    vue.addEventListener('click', async function (e) {
      var m = e.target.closest('[data-modifier]');
      if (m) formulaire(+m.getAttribute('data-modifier'));
      var s = e.target.closest('[data-suppr]');
      if (s) {
        var a = liste[+s.getAttribute('data-suppr')];
        if (!(await demander('Supprimer l’actualité ?', '« ' + esc(a.titre) + ' » disparaît de la page Actualités et du bandeau. Pour la retirer sans la perdre, masquez-la plutôt.', 'Supprimer', true))) return;
        liste.splice(liste.indexOf(a), 1);
        sauver('Actualité supprimée.');
      }
    });
    dessiner();
    if (arg === 'nouvelle') { history.replaceState(null, '', '#/actualites'); hashCourant = '#/actualites'; formulaire(null); }
  };

  // ---------------------------------------------------------------------------------------------
  // Messages
  // ---------------------------------------------------------------------------------------------
  var filtreMsg = 'atraiter';
  VUES.messages = async function () {
    entete('Messages', '');
    var r = await Promise.all([donnees('messages', true), donnees('etat').catch(function () { return {}; })]);
    var messages = r[0], etat = r[1] || {};
    var dessiner = function () {
      var aTraiter = function (m) { return !m.traite && !m.replied; };
      var liste = messages.filter(function (m) { return filtreMsg === 'tous' || (filtreMsg === 'atraiter' ? aTraiter(m) : !aTraiter(m)); });
      info(pluriel(messages.filter(aTraiter).length, 'message') + ' à traiter · ' + messages.length + ' au total');
      vue.innerHTML = (etat.emails === false ? '<div class="avis">Les réponses ne partent pas depuis l’admin : le service d’e-mails (Resend) n’est pas configuré. Utilisez « Répondre depuis ma messagerie », puis marquez le message comme traité.</div>' : '') +
        '<div class="onglets" role="group" aria-label="Filtre">' + [['atraiter', 'À traiter'], ['traites', 'Traités'], ['tous', 'Tous']].map(function (o) { return '<button class="chip" type="button" data-filtre-msg="' + o[0] + '" aria-pressed="' + (filtreMsg === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        '<div class="lettres">' + (liste.length ? liste.map(function (m) {
          var etiquette = m.replied ? tampon('enligne', 'Répondu') : m.traite ? tampon('enligne', 'Traité') : '<span class="stamp stamp--red" style="--rot:-2deg">À traiter</span>';
          var mailto = 'mailto:' + encodeURIComponent(m.email) + '?subject=' + encodeURIComponent('Re : votre message à PVT Explorer') + '&body=' + encodeURIComponent('Bonjour ' + m.firstname + ',\n\n\n\n> ' + String(m.message).split('\n').join('\n> '));
          return '<article class="panneau lettre" data-id="' + esc(m.id) + '"><header class="lettre__tete"><span class="lettre__nom">' + esc(m.firstname) + '</span><a class="data" href="mailto:' + esc(m.email) + '">' + esc(m.email) + '</a><span class="data">' + dateFr(m.createdAt, true) + ' à ' + heureFr(m.createdAt) + '</span>' + etiquette + '</header>' +
            '<p class="lettre__texte">' + esc(m.message) + '</p>' +
            (m.replied && m.replyText ? '<p class="lettre__reponse"><strong>Votre réponse du ' + dateFr(m.repliedAt, true) + ' :</strong>\n' + esc(m.replyText) + '</p>' : '') +
            '<div class="lettre__actions">' + (etat.emails !== false ? '<button class="btn" type="button" data-repondre>Répondre</button>' : '') +
            '<a class="btn btn--doux" href="' + esc(mailto) + '">Répondre depuis ma messagerie</a>' +
            '<button class="btn btn--doux" type="button" data-traite="' + (aTraiter(m) ? '1' : '0') + '">' + (aTraiter(m) ? 'Marquer comme traité' : 'Remettre à traiter') + '</button>' +
            '<button class="icone icone--danger" type="button" data-suppr-msg title="Supprimer">' + icone('poubelle') + '<span class="visually-hidden">Supprimer le message de ' + esc(m.firstname) + '</span></button></div></article>';
        }).join('') : '<p class="panneau panneau__vide">' + (filtreMsg === 'atraiter' ? 'Aucun message à traiter.' : 'Aucun message.') + '</p>') + '</div>';
    };
    vue.addEventListener('click', async function (e) {
      var f = e.target.closest('[data-filtre-msg]');
      if (f) { filtreMsg = f.getAttribute('data-filtre-msg'); return dessiner(); }
      var carte = e.target.closest('.lettre');
      if (!carte) return;
      var m = messages.find(function (x) { return x.id === carte.getAttribute('data-id'); });
      if (e.target.closest('[data-repondre]')) {
        if ($('form', carte)) return $('textarea', carte).focus();
        var form = document.createElement('form');
        form.innerHTML = '<div class="field"><label class="label" for="rep-' + esc(m.id) + '">Votre réponse à ' + esc(m.firstname) + '</label><textarea id="rep-' + esc(m.id) + '" required minlength="5" placeholder="Bonjour ' + esc(m.firstname) + ', …"></textarea><p class="aide">Envoyée depuis PVT Explorer à ' + esc(m.email) + ', précédée de « Bonjour ' + esc(m.firstname) + ', ».</p></div><div class="boutons-ligne"><button class="btn" type="submit">Envoyer la réponse</button><button class="btn btn--doux" type="button" data-annuler>Annuler</button></div>';
        carte.appendChild(form);
        $('textarea', form).focus();
        form.addEventListener('click', function (ev) { if (ev.target.closest('[data-annuler]')) form.remove(); });
        form.addEventListener('submit', async function (ev) {
          ev.preventDefault();
          var b = $('button[type=submit]', form);
          b.disabled = true; b.textContent = 'Envoi…';
          try { await api('POST', '/api/admin/contacts/' + m.id + '/reply', { reply: $('textarea', form).value }); m.replied = true; m.traite = true; m.repliedAt = new Date().toISOString(); m.replyText = $('textarea', form).value; majCompteurs(); toast('Réponse envoyée à ' + m.email + '.'); dessiner(); }
          catch (err) { toast(err.message, 'alerte'); b.disabled = false; b.textContent = 'Envoyer la réponse'; }
        });
      }
      var t = e.target.closest('[data-traite]');
      if (t) {
        var v = t.getAttribute('data-traite') === '1';
        try { await api('POST', '/api/admin/contacts/' + m.id + '/etat', { traite: v }); m.traite = v; if (!v) m.replied = false; majCompteurs(); dessiner(); }
        catch (err) { toast(err.message, 'alerte'); }
      }
      if (e.target.closest('[data-suppr-msg]')) {
        if (!(await demander('Supprimer le message ?', 'Le message de ' + esc(m.firstname) + ' sera supprimé définitivement.', 'Supprimer', true))) return;
        try { await api('POST', '/api/admin/contacts/' + m.id + '/supprimer', {}); messages.splice(messages.indexOf(m), 1); majCompteurs(); toast('Message supprimé.'); dessiner(); }
        catch (err) { toast(err.message, 'alerte'); }
      }
    });
    dessiner();
  };

  // ---------------------------------------------------------------------------------------------
  // Newsletter
  // ---------------------------------------------------------------------------------------------
  VUES.newsletter = async function () {
    entete('Newsletter', '', '<button class="btn btn--doux" type="button" id="exporter">' + icone('telecharger') + 'Exporter en CSV</button>');
    var r = await Promise.all([donnees('abonnes', true), donnees('etat').catch(function () { return {}; })]);
    var abonnes = r[0], etat = r[1] || {};
    var dessiner = function () {
      var q = norm(($('#n-q') || {}).value);
      var liste = abonnes.filter(function (a) { return !q || norm(a.email).indexOf(q) !== -1; });
      var mois = abonnes.filter(function (a) { return Date.now() - Date.parse(a.subscribedAt || 0) < 30 * 864e5; }).length;
      info(pluriel(abonnes.length, 'abonné') + ' · ' + mois + ' ces 30 derniers jours');
      $('#n-liste').innerHTML = liste.length ? '<table class="liste"><thead><tr><th>Adresse</th><th>Inscription</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + liste.map(function (a) {
        return '<tr><td>' + esc(a.email) + '</td><td class="data">' + dateFr(a.subscribedAt, true) + '</td><td><div class="liste__actions"><button class="icone icone--danger" type="button" data-retirer="' + esc(a.email) + '" title="Retirer de la liste">' + icone('poubelle') + '<span class="visually-hidden">Retirer ' + esc(a.email) + '</span></button></div></td></tr>';
      }).join('') + '</tbody></table>' : '<p class="panneau__vide">' + (abonnes.length ? 'Aucune adresse ne correspond.' : 'Pas encore d’abonné.') + '</p>';
    };
    vue.innerHTML = (etat.newsletter === false ? '<div class="avis avis--alerte">Inscriptions désactivées sur le site : Brevo n’est pas configuré (variables BREVO_… dans Vercel). Le formulaire affiche un message d’indisponibilité.</div>' : '') +
      '<div class="avis">La liste de référence est dans Brevo, avec la double confirmation. Ici : les inscriptions reçues par le site. Retirer une adresse ici ne la désinscrit pas de Brevo.</div>' +
      '<div class="barre"><input class="champ champ--recherche" type="search" id="n-q" placeholder="Rechercher une adresse" aria-label="Rechercher une adresse"></div><section class="panneau"><div class="liste-wrap" id="n-liste"></div></section>';
    $('#n-q').addEventListener('input', dessiner);
    $('#exporter').addEventListener('click', function () {
      var csv = 'email;inscription\n' + abonnes.map(function (a) { return '"' + String(a.email).replace(/"/g, '""') + '";' + (a.subscribedAt || ''); }).join('\n');
      var lien = document.createElement('a');
      lien.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
      lien.download = 'newsletter-pvt-explorer-' + aujourdhui() + '.csv';
      lien.click();
      setTimeout(function () { URL.revokeObjectURL(lien.href); }, 1000);
    });
    vue.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-retirer]');
      if (!b) return;
      var email = b.getAttribute('data-retirer');
      if (!(await demander('Retirer cette adresse ?', esc(email) + ' sera retirée de la liste du site (pas de Brevo).', 'Retirer', true))) return;
      try { await api('POST', '/api/admin/newsletter/supprimer', { email: email }); abonnes = abonnes.filter(function (a) { return a.email !== email; }); S.cache.abonnes = abonnes; toast('Adresse retirée.'); dessiner(); }
      catch (err) { toast(err.message, 'alerte'); }
    });
    dessiner();
  };

  // ---------------------------------------------------------------------------------------------
  // Santé SEO
  // ---------------------------------------------------------------------------------------------
  var filtreSeo = 'enligne';
  VUES.seo = async function () {
    entete('Santé SEO', '');
    var articles = await donnees('articles');
    var dessiner = function () {
      var liste = articles.filter(function (p) { return filtreSeo === 'tous' || (filtreSeo === 'enligne' ? statut(p) === 'enligne' : statut(p) !== 'enligne'); })
        .map(function (p) { return { p: p, a: analyser(p, articles) }; }).sort(function (x, y) { return (y.a.erreurs - x.a.erreurs) || (x.a.note - y.a.note); });
      var moyenne = liste.length ? Math.round(liste.reduce(function (s, x) { return s + x.a.note; }, 0) / liste.length) : 0;
      var avecErreurs = liste.filter(function (x) { return x.a.erreurs; }).length;
      var kws = {};
      liste.forEach(function (x) { var k = norm(x.p.focusKeyword); if (k) (kws[k] = kws[k] || []).push(x.p); });
      var doublons = Object.keys(kws).filter(function (k) { return kws[k].length > 1; });
      var sansDesc = liste.filter(function (x) { return !(x.p.description || '').trim(); }).length;
      info(pluriel(liste.length, 'article') + ' analysé' + (liste.length > 1 ? 's' : ''));
      vue.innerHTML = '<div class="onglets" role="group" aria-label="Articles analysés">' + [['enligne', 'En ligne'], ['autres', 'Brouillons et programmés'], ['tous', 'Tous']].map(function (o) { return '<button class="chip" type="button" data-filtre-seo="' + o[0] + '" aria-pressed="' + (filtreSeo === o[0]) + '">' + o[1] + '</button>'; }).join('') + '</div>' +
        '<div class="chiffres">' +
          '<div class="panneau chiffre"><span class="label">Note moyenne</span><span class="chiffre__n">' + moyenne + '</span><span class="chiffre__sous">sur 100</span></div>' +
          '<div class="panneau chiffre"><span class="label">Avec des erreurs</span><span class="chiffre__n' + (avecErreurs ? ' chiffre__n--alerte' : '') + '">' + avecErreurs + '</span><span class="chiffre__sous">à corriger en priorité</span></div>' +
          '<div class="panneau chiffre"><span class="label">Mots-clés en double</span><span class="chiffre__n' + (doublons.length ? ' chiffre__n--alerte' : '') + '">' + doublons.length + '</span><span class="chiffre__sous">pages qui se concurrencent</span></div>' +
          '<div class="panneau chiffre"><span class="label">Sans description</span><span class="chiffre__n' + (sansDesc ? ' chiffre__n--alerte' : '') + '">' + sansDesc + '</span><span class="chiffre__sous">Google en invente une</span></div>' +
        '</div>' +
        (doublons.length ? '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Mots-clés visés par plusieurs articles</h2></div><ul class="taches">' + doublons.map(function (k) { return '<li><strong>' + esc(k) + '</strong><span class="data">' + kws[k].map(function (p) { return p.slug; }).join(' · ') + '</span></li>'; }).join('') + '</ul></section>' : '') +
        '<section class="panneau"><div class="liste-wrap">' + (liste.length ? '<table class="liste"><thead><tr><th>Article</th><th>Note</th><th>À corriger</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + liste.map(function (x) {
          var pb = x.a.controles.filter(function (c) { return !c.ok; }).sort(function (a, b) { return (b.niveau === 'erreur') - (a.niveau === 'erreur'); });
          return '<tr><td><a class="liste__titre" href="#/articles/' + encodeURIComponent(x.p.id) + '">' + esc(x.p.title) + '</a><span class="liste__sous">' + (TAMPONS[statut(x.p)] || [''])[0] + ' · /blog/' + esc(x.p.slug) + '</span></td><td>' + noteSeo(x.a.note) + '</td>' +
            '<td><ul class="controles">' + (pb.length ? pb.slice(0, 3).map(function (c) { return '<li data-niveau="' + c.niveau + '">' + esc(c.texte) + '</li>'; }).join('') + (pb.length > 3 ? '<li data-niveau="conseil">et ' + (pb.length - 3) + ' autre(s)</li>' : '') : '<li data-niveau="ok" data-ok="true">Rien à signaler</li>') + '</ul></td>' +
            '<td><div class="liste__actions"><a class="btn btn--doux" href="#/articles/' + encodeURIComponent(x.p.id) + '">Corriger</a></div></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="panneau__vide">Aucun article dans cette sélection.</p>') + '</div></section>';
    };
    vue.addEventListener('click', function (e) { var f = e.target.closest('[data-filtre-seo]'); if (f) { filtreSeo = f.getAttribute('data-filtre-seo'); dessiner(); } });
    dessiner();
  };

  // ---------------------------------------------------------------------------------------------
  // Redirections
  // ---------------------------------------------------------------------------------------------
  VUES.redirections = async function () {
    entete('Redirections', '');
    var liste = (await donnees('redirections', true)).slice();
    var dessiner = function () {
      info(pluriel(liste.length, 'redirection'));
      vue.innerHTML = '<div class="avis">Quand vous changez l’adresse d’un article en ligne, son ancienne adresse redirige automatiquement vers la nouvelle (redirection permanente 301) : les liens existants et le référencement sont conservés. Vous pouvez aussi en ajouter à la main.</div>' +
        '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Ajouter une redirection</h2></div><form class="panneau__corps barre" id="f-red">' +
          '<input class="champ" style="flex:1 1 220px" id="r-de" placeholder="/blog/ancienne-adresse" aria-label="Ancienne adresse" required>' +
          '<span aria-hidden="true">' + '→' + '</span>' +
          '<input class="champ" style="flex:1 1 220px" id="r-vers" placeholder="/blog/nouvelle-adresse" aria-label="Nouvelle adresse" required>' +
          '<button class="btn" type="submit">Ajouter</button></form></section>' +
        '<section class="panneau"><div class="liste-wrap">' + (liste.length ? '<table class="liste"><thead><tr><th>Ancienne adresse</th><th>Redirige vers</th><th>Origine</th><th>Créée le</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + liste.map(function (r, i) {
          return '<tr><td class="data">' + esc(r.de) + '</td><td class="data">' + esc(r.vers) + '</td><td>' + tampon(r.origine === 'auto' ? 'programme' : 'x', r.origine === 'auto' ? 'Automatique' : 'Manuelle') + '</td><td class="data">' + dateFr(r.creeLe, true) + '</td>' +
            '<td><div class="liste__actions"><a class="icone" href="' + esc(r.de) + '" target="_blank" rel="noopener" title="Tester">' + icone('externe') + '<span class="visually-hidden">Tester ' + esc(r.de) + '</span></a><button class="icone icone--danger" type="button" data-suppr-red="' + i + '" title="Supprimer">' + icone('poubelle') + '<span class="visually-hidden">Supprimer</span></button></div></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="panneau__vide">Aucune redirection pour l’instant.</p>') + '</div></section>';
      $('#f-red').addEventListener('submit', async function (e) {
        e.preventDefault();
        var de = $('#r-de').value.trim(), vers = $('#r-vers').value.trim();
        if (!/^\/blog\/[^/\s]+$/.test(de)) { toast('L’ancienne adresse doit être de la forme /blog/adresse.', 'alerte'); return; }
        if (!/^(\/|https:\/\/)/.test(vers)) { toast('La nouvelle adresse doit commencer par / ou https://', 'alerte'); return; }
        liste = liste.filter(function (r) { return r.de !== de; });
        liste.unshift({ de: de, vers: vers, origine: 'manuelle', creeLe: new Date().toISOString() });
        await sauver('Redirection ajoutée.');
      });
    };
    async function sauver(msg) {
      try { liste = (await api('POST', '/api/admin/redirections', { redirections: liste })).redirections; S.cache.redirections = liste; toast(msg); dessiner(); }
      catch (e) { toast(e.message, 'alerte'); }
    }
    vue.addEventListener('click', async function (e) {
      var s = e.target.closest('[data-suppr-red]');
      if (!s) return;
      var r = liste[+s.getAttribute('data-suppr-red')];
      if (!(await demander('Supprimer la redirection ?', esc(r.de) + ' ne redirigera plus : les visiteurs qui l’ouvrent verront la page introuvable.', 'Supprimer', true))) return;
      liste.splice(liste.indexOf(r), 1);
      sauver('Redirection supprimée.');
    });
    dessiner();
  };

  // ---------------------------------------------------------------------------------------------
  // Liens partenaires
  // ---------------------------------------------------------------------------------------------
  VUES.liens = async function () {
    entete('Liens partenaires', '', '<button class="btn" type="button" id="lien-nouveau">' + icone('plus') + 'Ajouter un lien</button>');
    var r = await Promise.all([donnees('liens', true), donnees('etat').catch(function () { return {}; })]);
    var liens = r[0].slice(), etat = r[1] || {};
    var GO = [['flights', 'Vols', 'PARTNER_FLIGHTS_URL'], ['stay', 'Logement', 'PARTNER_STAYS_URL'], ['insurance', 'Assurance', 'PARTNER_INSURANCE_URL'], ['esim', 'eSIM', 'PARTNER_ESIM_URL'], ['activities', 'Activités', 'PARTNER_ACTIVITIES_URL'], ['car', 'Location de voiture', 'PARTNER_CAR_URL'], ['amazon', 'Amazon (« Dans le sac »)', 'AMAZON_PARTNER_TAG']];
    var dessiner = function () {
      info(pluriel(liens.length, 'lien') + ' enregistré' + (liens.length > 1 ? 's' : ''));
      vue.innerHTML = '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Boutons du site (/go/…)</h2><span class="aide">Les boutons « Services à comparer » et « Dans le sac » passent par ces adresses. Sans lien partenaire configuré, ils mènent à une recherche générique, sans commission.</span></div>' +
        '<div class="liste-wrap"><table class="liste"><thead><tr><th>Adresse</th><th>Service</th><th>État</th><th>Variable Vercel</th></tr></thead><tbody>' + GO.map(function (g) {
          var ok = g[0] === 'amazon' ? etat.amazon : (etat.partenaires || {})[g[0]];
          return '<tr><td class="data">/go/' + g[0] + '</td><td>' + g[1] + '</td><td>' + (ok ? tampon('enligne', 'Partenaire actif') : '<span class="stamp stamp--red" style="--rot:-2deg">Lien de secours</span>') + '</td><td class="data">' + g[2] + '</td></tr>';
        }).join('') + '</tbody></table></div></section>' +
        '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Carnet de liens affiliés</h2><span class="aide">Vos liens de programmes partenaires, à copier dans les articles.</span></div><div class="liste-wrap">' +
        (liens.length ? '<table class="liste"><thead><tr><th>Nom</th><th>Catégorie</th><th>Adresse</th><th><span class="visually-hidden">Actions</span></th></tr></thead><tbody>' + liens.map(function (l, i) {
          return '<tr><td><strong>' + esc(l.name) + '</strong>' + (l.notes ? '<span class="liste__sous">' + esc(l.notes) + '</span>' : '') + '</td><td>' + esc(l.category || '—') + '</td><td class="data" style="max-width:280px;overflow:hidden;text-overflow:ellipsis">' + esc(l.url) + '</td>' +
            '<td><div class="liste__actions"><button class="icone" type="button" data-copier-lien="' + i + '" title="Copier">' + icone('copier') + '<span class="visually-hidden">Copier le lien ' + esc(l.name) + '</span></button><button class="icone" type="button" data-modifier-lien="' + i + '" title="Modifier">' + icone('crayon') + '<span class="visually-hidden">Modifier</span></button><button class="icone icone--danger" type="button" data-suppr-lien="' + i + '" title="Supprimer">' + icone('poubelle') + '<span class="visually-hidden">Supprimer</span></button></div></td></tr>';
        }).join('') + '</tbody></table>' : '<p class="panneau__vide">Aucun lien enregistré.</p>') + '</div></section>';
    };
    async function sauver(msg) {
      try { await api('POST', '/api/admin/affiliates', { affiliates: liens }); S.cache.liens = liens; toast(msg); dessiner(); }
      catch (e) { toast(e.message, 'alerte'); }
    }
    function formulaire(i) {
      var l = i == null ? { name: '', url: '', category: 'assurance', notes: '' } : liens[i];
      var corps = ouvrirFenetre(i == null ? 'Ajouter un lien' : 'Modifier le lien', '<form class="fenetre__corps" style="padding:0" id="f-lien">' +
        '<div class="field"><label class="label" for="l-nom">Nom</label><input id="l-nom" required value="' + esc(l.name) + '" placeholder="Chapka · assurance PVT"></div>' +
        '<div class="field"><label class="label" for="l-url">Adresse</label><input id="l-url" type="url" required value="' + esc(l.url) + '" placeholder="https://…"></div>' +
        '<div class="field"><label class="label" for="l-cat">Catégorie</label><select id="l-cat">' + ['vols', 'hébergement', 'assurance', 'esim', 'activités', 'amazon', 'autre'].map(function (c) { return '<option' + (l.category === c ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
        '<div class="field"><label class="label" for="l-notes">Notes</label><textarea id="l-notes" placeholder="Commission, code promo, conditions…">' + esc(l.notes) + '</textarea></div>' +
        '<div class="fenetre__pied"><button class="btn btn--doux" type="button" data-fermer>Annuler</button><button class="btn" type="submit">Enregistrer</button></div></form>');
      $('#l-nom').focus();
      $('#f-lien', corps).addEventListener('submit', function (e) {
        e.preventDefault();
        var n = Object.assign({}, l, { name: $('#l-nom').value.trim(), url: $('#l-url').value.trim(), category: $('#l-cat').value, notes: $('#l-notes').value.trim() });
        if (!n.id) { n.id = nouvelId(); n.createdAt = new Date().toISOString(); }
        if (i == null) liens.unshift(n); else liens[i] = n;
        fermerFenetre();
        sauver(i == null ? 'Lien ajouté.' : 'Lien modifié.');
      });
    }
    $('#lien-nouveau').addEventListener('click', function () { formulaire(null); });
    vue.addEventListener('click', async function (e) {
      var c = e.target.closest('[data-copier-lien]');
      if (c) { try { await navigator.clipboard.writeText(liens[+c.getAttribute('data-copier-lien')].url); toast('Lien copié.'); } catch (err) { toast('Copie impossible.', 'alerte'); } }
      var m = e.target.closest('[data-modifier-lien]');
      if (m) formulaire(+m.getAttribute('data-modifier-lien'));
      var s = e.target.closest('[data-suppr-lien]');
      if (s) {
        var l = liens[+s.getAttribute('data-suppr-lien')];
        if (!(await demander('Supprimer ce lien ?', esc(l.name) + ' sera retiré du carnet.', 'Supprimer', true))) return;
        liens.splice(liens.indexOf(l), 1);
        sauver('Lien supprimé.');
      }
    });
    dessiner();
  };

  // ---------------------------------------------------------------------------------------------
  // Réglages et sauvegarde
  // ---------------------------------------------------------------------------------------------
  VUES.reglages = async function () {
    entete('Réglages et sauvegarde', '');
    var etat = await donnees('etat', true);
    var ligne = function (ok, nom, role, variable) {
      return '<tr><td><strong>' + nom + '</strong><span class="liste__sous" style="font-family:var(--font);font-size:.84rem">' + role + '</span></td><td>' + (ok ? tampon('enligne', 'Actif') : '<span class="stamp stamp--red" style="--rot:-2deg">À configurer</span>') + '</td><td class="data">' + variable + '</td></tr>';
    };
    var c = charge(S.jeton) || {};
    vue.innerHTML =
      '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Services branchés au site</h2><span class="aide">Les clés se règlent dans Vercel, rubrique Settings › Environment Variables, puis il faut redéployer.</span></div><div class="liste-wrap"><table class="liste"><thead><tr><th>Service</th><th>État</th><th>Variable</th></tr></thead><tbody>' +
        ligne(etat.stockage === 'blob', 'Stockage des données', 'Articles, actualités, messages, images. ' + (etat.stockage === 'local' ? 'Fichiers locaux (développement).' : ''), 'BLOB_READ_WRITE_TOKEN') +
        ligne(etat.emails, 'Envoi d’e-mails (Resend)', 'Réponses aux messages depuis l’admin, alertes de nouveaux messages.', 'RESEND_API_KEY') +
        ligne(etat.emailAdmin, 'Votre adresse d’alerte', 'Reçoit une alerte à chaque message et nouvel abonné.', 'ADMIN_EMAIL') +
        ligne(etat.newsletter, 'Newsletter (Brevo)', 'Inscription avec double confirmation.', 'BREVO_API_KEY, BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID, BREVO_REDIRECT_URL') +
        ligne(etat.amazon, 'Partenaire Amazon', 'Commission sur les liens « Dans le sac ».', 'AMAZON_PARTNER_TAG') +
        ligne(etat.assistant, 'Assistant IA', 'Réponses automatiques aux questions (non affiché sur le site actuellement).', 'ANTHROPIC_API_KEY') +
      '</tbody></table></div></section>' +
      '<div class="grille-2">' +
        '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Sauvegarde</h2></div><div class="panneau__corps"><p>Un seul fichier avec tout le contenu géré ici : articles, actualités, redirections, liens partenaires, abonnés, messages et corbeille. À télécharger avant un gros changement, et une fois par mois.</p><div><button class="btn" type="button" id="sauvegarde">' + icone('telecharger') + 'Télécharger la sauvegarde</button></div><p class="aide">Les images restent dans le stockage Vercel ; la sauvegarde garde leurs adresses.</p></div></section>' +
        '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Session</h2></div><div class="panneau__corps"><p>Connecté en tant que <strong>' + esc(c.user || '—') + '</strong> jusqu’au ' + dateFr(new Date(c.exp || Date.now()).toISOString()) + ' à ' + heureFr(new Date(c.exp || Date.now()).toISOString()) + '.</p><p class="aide">Le mot de passe se change dans Vercel (ADMIN_PASS) : toutes les sessions ouvertes sont alors fermées.</p><div><button class="btn btn--doux" type="button" id="sortir">' + icone('sortie') + 'Se déconnecter</button></div></div></section>' +
      '</div>' +
      '<section class="panneau"><div class="panneau__tete"><h2 class="panneau__titre">Outils externes</h2></div><ul class="taches">' +
        [['https://search.google.com/search-console', 'Google Search Console', 'positions, clics, indexation, envoi du sitemap'], ['https://vercel.com/dashboard', 'Vercel', 'déploiements, variables, statistiques de visite'], ['https://app.brevo.com', 'Brevo', 'liste et envoi de la newsletter'], ['https://resend.com/emails', 'Resend', 'e-mails envoyés par le site'], ['/sitemap.xml', 'Sitemap du site', 'la liste des pages envoyée à Google']].map(function (o) {
          return '<li><a href="' + o[0] + '" target="_blank" rel="noopener">' + o[1] + '</a><span class="data">' + o[2] + '</span></li>';
        }).join('') + '</ul></section>';
    $('#sortir').addEventListener('click', function () { $('#deconnexion').click(); });
    $('#sauvegarde').addEventListener('click', async function () {
      var b = this;
      b.disabled = true;
      try {
        var blob = await api('GET', '/api/admin/sauvegarde', undefined, { blob: true });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'pvt-explorer-sauvegarde-' + aujourdhui() + '.json';
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        toast('Sauvegarde téléchargée.');
      } catch (e) { toast(e.message, 'alerte'); }
      finally { b.disabled = false; }
    });
  };

  // ---------------------------------------------------------------------------------------------
  if (sessionValide()) demarrer(); else afficherPorte(S.jeton ? 'Votre session a expiré : reconnectez-vous.' : '');
  setInterval(function () { if (S.jeton && !sessionValide() && !$('#app').hidden) deconnecter('Votre session a expiré : reconnectez-vous.'); }, 60000);
})();
