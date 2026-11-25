// Tableau des départs : heure de Paris, et codes pays qui défilent comme des volets
// la première fois que le tableau apparaît à l'écran. Rien ne bouge si l'on préfère moins d'animations.
(function () {
  'use strict';
  var tableau = document.querySelector('[data-departs]');
  if (!tableau) return;

  var heure = tableau.querySelector('[data-heure]');
  if (heure && window.Intl) {
    var format = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
    var majHeure = function () { heure.querySelector('b').textContent = format.format(new Date()); };
    majHeure();
    heure.hidden = false;
    setInterval(majHeure, 20000);
  }

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) return;

  var LETTRES = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  function poser(caseVolet, lettre) {
    caseVolet.textContent = lettre;
    caseVolet.classList.remove('is-volet');
    void caseVolet.offsetWidth;
    caseVolet.classList.add('is-volet');
  }
  function derouler(volets, depart) {
    Array.prototype.forEach.call(volets.children, function (c, i) {
      var finale = c.textContent, tours = 4 + i * 2 + Math.floor(Math.random() * 3), n = 0;
      setTimeout(function tour() {
        if (n++ < tours) { poser(c, LETTRES.charAt(Math.floor(Math.random() * 26))); setTimeout(tour, 60); }
        else poser(c, finale);
      }, depart + i * 45);
    });
  }
  var observateur = new IntersectionObserver(function (entrees) {
    if (!entrees.some(function (e) { return e.isIntersecting; })) return;
    observateur.disconnect();
    tableau.querySelectorAll('.volets').forEach(function (v, rang) { derouler(v, rang * 55); });
  }, { threshold: 0.2 });
  observateur.observe(tableau);
})();
