// Diaporama de l'accueil : une grande photo par destination, qui change toute seule.
// Une barre de progression et deux petites flèches (au survol) ; pause au survol, quand le clavier
// y entre, hors de l'écran ; rien ne défile si l'on préfère moins d'animations.
// Les photos se chargent une à une, juste avant d'être montrées.
(function () {
  'use strict';
  var diapo = document.querySelector('[data-diapo]');
  if (!diapo) return;
  var vues = Array.prototype.slice.call(diapo.querySelectorAll('.diapo__vue'));
  var n = vues.length;
  if (n < 2) return;
  var piste = diapo.querySelector('[data-diapo-piste]');
  var barre = diapo.querySelector('.diapo__barre span');
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var DUREE = 6500;
  var courant = Math.max(0, vues.findIndex(function (v) { return v.classList.contains('is-active'); }));
  var minuterie = null;
  var arret = reduce, survol = false, focus = false, visible = true;

  diapo.style.setProperty('--duree', DUREE / 1000 + 's');
  diapo.classList.add('is-pret');

  function charger(k) {
    var img = vues[(k + n) % n].querySelector('img[data-src]');
    if (!img) return;
    if (img.dataset.srcset) img.srcset = img.dataset.srcset;
    img.src = img.dataset.src;
    img.removeAttribute('data-src');
    img.removeAttribute('data-srcset');
  }

  var LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function volets(vue) {
    if (reduce) return;
    Array.prototype.forEach.call(vue.querySelectorAll('.diapo__code span'), function (c, i) {
      var finale = c.textContent, tours = 3 + i * 2, k = 0;
      (function tour() {
        c.textContent = k++ < tours ? LETTRES.charAt(Math.floor(Math.random() * 26)) : finale;
        c.classList.remove('is-volet'); void c.offsetWidth; c.classList.add('is-volet');
        if (k <= tours) setTimeout(tour, 55);
      })();
    });
  }

  function lecture() { return !arret && !survol && !focus && visible; }
  function relancer() {
    clearTimeout(minuterie);
    diapo.classList.remove('is-lecture');
    if (barre) { barre.style.animation = 'none'; void barre.offsetWidth; barre.style.animation = ''; }
    if (!lecture()) return;
    diapo.classList.add('is-lecture');
    minuterie = setTimeout(function () { aller(courant + 1, false); }, DUREE);
  }

  function aller(k, manuel) {
    k = (k + n) % n;
    if (k === courant) return relancer();
    charger(k);
    charger(k + 1);
    vues[courant].classList.remove('is-active');
    courant = k;
    vues[courant].classList.add('is-active');
    piste.setAttribute('aria-live', manuel ? 'polite' : 'off');
    volets(vues[courant]);
    relancer();
  }

  diapo.querySelector('[data-diapo-prec]').addEventListener('click', function () { aller(courant - 1, true); });
  diapo.querySelector('[data-diapo-suiv]').addEventListener('click', function () { aller(courant + 1, true); });

  // Survol à la souris : pause et petites flèches visibles
  diapo.addEventListener('mouseenter', function () { survol = true; diapo.classList.add('is-survol'); relancer(); });
  diapo.addEventListener('mouseleave', function () { survol = false; diapo.classList.remove('is-survol'); relancer(); });
  diapo.addEventListener('focusin', function () { focus = true; relancer(); });
  diapo.addEventListener('focusout', function (e) { if (!diapo.contains(e.relatedTarget)) { focus = false; relancer(); } });
  diapo.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); aller(courant + 1, true); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); aller(courant - 1, true); }
  });

  // Glisser du doigt : au-delà de 40 px, on change de vue et le lien n'est pas suivi
  var depart = null, glisse = false;
  piste.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { depart = { x: e.clientX, y: e.clientY }; glisse = false; survol = true; relancer(); } });
  piste.addEventListener('pointercancel', function () { depart = null; survol = false; relancer(); });
  piste.addEventListener('pointerup', function (e) {
    if (!depart) return;
    var dx = e.clientX - depart.x, dy = e.clientY - depart.y;
    depart = null;
    survol = false;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { glisse = true; aller(courant + (dx < 0 ? 1 : -1), true); } else relancer();
  });
  piste.addEventListener('click', function (e) { if (glisse) { e.preventDefault(); glisse = false; } }, true);

  // Pas de défilement quand le diaporama est hors de l'écran ou l'onglet caché
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entrees) { visible = entrees[0].isIntersecting; relancer(); }, { threshold: 0.3 }).observe(diapo);
  }
  document.addEventListener('visibilitychange', function () { visible = !document.hidden; relancer(); });

  charger(courant + 1);
  relancer();
})();
