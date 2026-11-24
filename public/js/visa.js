// PVT Explorer — comportements communs : menu, rosaces guillochées, tampons, sommaire actif, messages.
(function () {
  'use strict';
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Menu de la couverture sur mobile
  var cover = document.querySelector('.cover');
  var toggle = cover && cover.querySelector('.cover__toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = !cover.hasAttribute('data-open');
      cover.toggleAttribute('data-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && cover.hasAttribute('data-open')) {
        cover.removeAttribute('data-open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.focus();
      }
    });
    cover.querySelectorAll('nav a').forEach(function (a) {
      a.addEventListener('click', function () {
        cover.removeAttribute('data-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Rosace propre à chaque pays : mêmes paramètres pour un même code, comme l'impression de sécurité d'un visa.
  function hash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rosettePath(seed) {
    var h = hash(seed), c = 64, n = 320;
    var petals = 10 + (h % 8), rings = 4 + ((h >>> 4) % 3), amp = 6 + ((h >>> 8) % 4);
    var inner = 6 + ((h >>> 12) % 4), R = 50, d = '', i, t, r, k;
    var f = function (v) { return Math.round(v * 10) / 10; };
    for (k = 0; k < rings; k++) {
      var ph = (k / rings) * (Math.PI * 2 / petals);
      for (i = 0; i <= n; i++) {
        t = (i / n) * Math.PI * 2;
        r = R + amp * Math.sin(petals * (t + ph));
        d += (i ? 'L' : 'M') + f(c + r * Math.cos(t)) + ' ' + f(c + r * Math.sin(t));
      }
    }
    var a = 26, b = a / inner, hh = 14;
    for (i = 0; i <= n; i++) {
      t = (i / n) * Math.PI * 2;
      d += (i ? 'L' : 'M') + f(c + (a - b) * Math.cos(t * inner) + hh * Math.cos(((a - b) / b) * t * inner)) + ' ' +
        f(c + (a - b) * Math.sin(t * inner) - hh * Math.sin(((a - b) / b) * t * inner));
    }
    return d;
  }
  document.querySelectorAll('[data-rosette]').forEach(function (el) {
    el.innerHTML = '<svg viewBox="0 0 128 128" aria-hidden="true" focusable="false"><path d="' + rosettePath(el.getAttribute('data-rosette')) + '"/></svg>';
  });

  // Tampon : l'encre se pose
  function press(el) {
    if (!el || reduce) return;
    el.classList.remove('is-pressed');
    void el.offsetWidth;
    el.classList.add('is-pressed');
  }

  // Message éphémère
  var toastEl;
  function toast(msg) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { toastEl.classList.remove('is-on'); }, 3600);
  }

  // Sommaire : la section lue est signalée dans la marge
  var toc = document.querySelector('[data-toc]');
  if (toc && window.matchMedia) {
    var wide = matchMedia('(min-width: 1100px)');
    var sync = function () { if (wide.matches) toc.open = true; };
    sync();
    if (wide.addEventListener) wide.addEventListener('change', sync);
  }
  if (toc) {
    var pairs = [];
    toc.querySelectorAll('a[href^="#"]').forEach(function (a) {
      var h = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (h) pairs.push([h, a]);
    });
    var current, ticking = false;
    var spy = function () {
      ticking = false;
      var line = window.innerHeight * 0.3, next = null;
      for (var i = 0; i < pairs.length; i++) {
        if (pairs[i][0].getBoundingClientRect().top <= line) next = pairs[i][1]; else break;
      }
      if (next === current) return;
      if (current) current.removeAttribute('aria-current');
      current = next;
      if (current) current.setAttribute('aria-current', 'true');
    };
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(spy); }
    }, { passive: true });
    spy();
  }

  // Formulaire générique en JSON (contact, newsletter) avec message d'état dans la page
  document.querySelectorAll('form[data-api]').forEach(function (form) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var status = form.querySelector('.form-status');
      var btn = form.querySelector('button[type=submit]');
      var data = {};
      new FormData(form).forEach(function (v, k) { data[k] = v; });
      form.querySelectorAll('input[type=checkbox]').forEach(function (c) { data[c.name] = c.checked; });
      if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Envoi…'; }
      if (status) { status.removeAttribute('data-state'); status.textContent = ''; }
      try {
        var r = await fetch(form.getAttribute('data-api'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        var d = await r.json().catch(function () { return {}; });
        if (!r.ok) throw new Error(d.error || 'Envoi impossible pour le moment.');
        form.reset();
        if (status) { status.dataset.state = 'ok'; status.textContent = d.message || 'C’est envoyé.'; }
        var s = form.querySelector('[data-success-stamp]');
        if (s) { s.hidden = false; press(s); }
      } catch (err) {
        if (status) { status.dataset.state = 'error'; status.textContent = err.message; }
      } finally {
        if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label; }
      }
    });
  });

  // Menu « Nos astuces | Blog » : tri par pays et par thème
  document.querySelectorAll('.cover__deroulant').forEach(function (li) {
    var btn = li.querySelector('.cover__ouvrir');
    if (!btn) return;
    var fermer = function () { li.removeAttribute('data-open'); btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = !li.hasAttribute('data-open');
      li.toggleAttribute('data-open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
    document.addEventListener('click', function (e) { if (!li.contains(e.target)) fermer(); });
    li.addEventListener('keydown', function (e) { if (e.key === 'Escape') { fermer(); btn.focus(); } });
  });

  // Fiches pays : une fiche par destination, ouverte depuis sa vignette (ou par un lien #pvt-XX)
  function ouvrirFiche(id) {
    var d = document.getElementById(id);
    if (!d || typeof d.showModal !== 'function' || d.open) return;
    d.showModal();
    var p = d.querySelector('.fiche__page');
    if (p && !reduce) { p.classList.remove('is-open'); void p.offsetWidth; p.classList.add('is-open'); }
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('[data-fiche]');
    if (b) { ouvrirFiche(b.getAttribute('data-fiche')); return; }
    var f = e.target.closest && e.target.closest('[data-fermer]');
    if (f) { f.closest('dialog').close(); return; }
    if (e.target.tagName === 'DIALOG' && e.target.classList.contains('fiche')) e.target.close();
  });
  // Sous-menu Destinations et recherche : #pvt-XX ouvre la fiche, même si l'adresse porte déjà ce lien
  function ficheDuLien() {
    var h = location.hash.match(/^#pvt-([A-Z]{2})$/);
    if (h) ouvrirFiche('fiche-' + h[1]);
  }
  ficheDuLien();
  window.addEventListener('hashchange', ficheDuLien);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-destination]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    var li = a.closest('.cover__deroulant');
    if (li) { li.removeAttribute('data-open'); var b = li.querySelector('.cover__ouvrir'); if (b) b.setAttribute('aria-expanded', 'false'); }
    a.blur();
    if (a.hash === location.hash && a.pathname === location.pathname) ficheDuLien();
  });

  // Carrousel : défilement natif au doigt, glisser à la souris, flèches et jauge
  document.querySelectorAll('.carrousel').forEach(function (c) {
    var piste = c.querySelector('.carrousel__piste');
    var section = c.closest('section') || document;
    var jauge = c.id ? document.querySelector('.carrousel__jauge[data-pour="' + c.id + '"] span') : section.querySelector('.carrousel__jauge span');
    var boutons = c.id ? document.querySelectorAll('[data-defiler][aria-controls="' + c.id + '"]') : section.querySelectorAll('[data-defiler]');
    var pas = function () {
      var carte = piste && piste.firstElementChild;
      return carte ? carte.getBoundingClientRect().width + 20 : c.clientWidth * 0.8;
    };
    var majJauge = function () {
      if (!jauge) return;
      var max = c.scrollWidth - c.clientWidth;
      var part = c.clientWidth / c.scrollWidth;
      jauge.style.width = (part * 100) + '%';
      jauge.style.transform = 'translateX(' + (max > 0 ? (c.scrollLeft / max) * ((1 - part) / part) * 100 : 0) + '%)';
    };
    boutons.forEach(function (b) {
      b.addEventListener('click', function () {
        var depart = c.scrollLeft, delta = pas() * +b.getAttribute('data-defiler');
        c.scrollBy({ left: delta, behavior: reduce ? 'auto' : 'smooth' });
        setTimeout(function () { if (c.scrollLeft === depart) c.scrollLeft = depart + delta; }, 450);
      });
    });
    c.addEventListener('scroll', function () { requestAnimationFrame(majJauge); }, { passive: true });
    window.addEventListener('resize', majJauge);
    majJauge();

    var debut = null, glisse = false;
    c.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      debut = { x: e.clientX, gauche: c.scrollLeft };
      glisse = false;
    });
    window.addEventListener('pointermove', function (e) {
      if (!debut) return;
      var dx = e.clientX - debut.x;
      if (!glisse && Math.abs(dx) > 6) { glisse = true; c.classList.add('is-glisse'); }
      if (glisse) c.scrollLeft = debut.gauche - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!debut) return;
      debut = null;
      c.classList.remove('is-glisse');
      if (glisse) setTimeout(function () { glisse = false; }, 0);
    });
    c.addEventListener('click', function (e) { if (glisse) { e.preventDefault(); e.stopPropagation(); } }, true);
  });

  window.PVT = { press: press, toast: toast, rosettePath: rosettePath, ouvrirFiche: ouvrirFiche };
})();
