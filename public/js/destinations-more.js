// Affichage progressif des destinations sur téléphone uniquement.
(function () {
  'use strict';
  var section = document.getElementById('destinations');
  if (!section) return;
  var cards = Array.prototype.slice.call(section.querySelectorAll('.vignette'));
  var button = section.querySelector('[data-destinations-more]');
  if (!button || cards.length <= 3 || !window.matchMedia) return;

  var mobile = window.matchMedia('(max-width: 600px)');
  var expanded = false;
  var extra = cards.slice(3);
  var regions = Array.prototype.slice.call(section.querySelectorAll('.region'));

  function render() {
    if (!mobile.matches) {
      cards.forEach(function (card) { card.classList.remove('vignette--mobile-extra'); });
      regions.forEach(function (region) { region.classList.remove('region--mobile-empty'); });
      button.hidden = true;
      button.setAttribute('aria-expanded', 'false');
      return;
    }
    extra.forEach(function (card) {
      card.classList.toggle('vignette--mobile-extra', !expanded);
    });
    regions.forEach(function (region) {
      var visible = region.querySelectorAll('.vignette:not(.vignette--mobile-extra)').length;
      region.classList.toggle('region--mobile-empty', !expanded && visible === 0);
    });
    button.hidden = false;
    button.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    button.innerHTML = expanded
      ? 'Voir moins <span aria-hidden="true">↑</span>'
      : 'Voir les ' + extra.length + ' autres destinations <span aria-hidden="true">↓</span>';
  }

  button.addEventListener('click', function () {
    expanded = !expanded;
    render();
  });
  if (mobile.addEventListener) mobile.addEventListener('change', function () { expanded = false; render(); });
  else if (mobile.addListener) mobile.addListener(function () { expanded = false; render(); });
  render();
})();
