// Accueil : vignette d'éligibilité (âge et durée → destinations ouvertes), état de la newsletter et des liens partenaires.
(function () {
  'use strict';
  var form = document.getElementById('eligibilite');
  if (!form) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var press = function (el) { if (window.PVT) window.PVT.press(el); };
  var age = form.querySelector('#age');
  var countEl = form.querySelector('#elig-n');
  var textEl = form.querySelector('#elig-texte');
  var mrzEl = form.querySelector('#elig-mrz');
  var formStamp = form.querySelector('#elig-stamp');
  var go = form.querySelector('#elig-go');
  var cards = Array.prototype.slice.call(document.querySelectorAll('.vignette[data-max]'));
  var LINE1 = 'V<FRAPVT<EXPLORER<<GUIDE<2027';
  var lastCodes = cards.map(function (c) { return c.getAttribute('data-iso'); });

  // Longueur de ligne MRZ selon la largeur réelle : 44 caractères au plus, jamais de code coupé
  function lineLength() {
    var probe = document.createElement('span');
    probe.textContent = '<<<<<<<<<<';
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre';
    mrzEl.appendChild(probe);
    var ch = probe.getBoundingClientRect().width / 10;
    probe.remove();
    var cs = getComputedStyle(mrzEl);
    var w = mrzEl.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    return Math.max(24, Math.min(44, Math.floor(w / (ch || 8))));
  }
  function mrzLines(codes) {
    var L = lineLength();
    var pad = function (s) { return (s + '<'.repeat(L)).slice(0, L); };
    var lines = [pad(L >= LINE1.length ? LINE1 : 'V<FRAPVT<EXPLORER')];
    var line = '';
    (codes.length ? codes : ['AUCUNE<DESTINATION']).forEach(function (code) {
      var unit = code + '<';
      if ((line + unit).length > L) { lines.push(pad(line)); line = ''; }
      line += unit;
    });
    lines.push(pad(line));
    return lines;
  }

  var scrambleTimer;
  function writeMrz(codes, instant) {
    lastCodes = codes;
    var target = mrzLines(codes).join('\n');
    var render = function (s) { mrzEl.innerHTML = s.split('\n').map(function (l) { return l.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }).join('<br>'); };
    clearInterval(scrambleTimer);
    if (reduce || instant) return render(target);
    var current = mrzEl.innerText.replace(/\r/g, '');
    var frame = 0, frames = 14, glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<';
    scrambleTimer = setInterval(function () {
      frame++;
      var out = '';
      for (var i = 0; i < target.length; i++) {
        var t = target[i];
        if (t === '\n' || frame / frames > i / target.length + 0.15 || current[i] === t) out += t;
        else out += glyphs[(Math.random() * glyphs.length) | 0];
      }
      render(out);
      if (frame >= frames + 6) { clearInterval(scrambleTimer); render(target); }
    }, 28);
  }

  // Tampon « Éligible » : posé à cheval sur le bord de la fiche, au moment où la fiche entre à l'écran
  function stampFor(card) {
    var s = card.querySelector(':scope > .stamp--elig');
    if (!s) {
      s = document.createElement('span');
      s.className = 'stamp stamp--green stamp--elig';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = 'Éligible';
      var iso = card.getAttribute('data-iso') || '';
      s.style.setProperty('--rot', (((iso.charCodeAt(0) + iso.charCodeAt(2)) % 13) - 8) + 'deg');
      s.style.visibility = 'hidden';
      card.appendChild(s);
    }
    return s;
  }
  var waiting = new Set();
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (entries) {
    var delay = 0;
    entries.forEach(function (en) {
      if (!en.isIntersecting || !waiting.has(en.target)) return;
      waiting.delete(en.target);
      io.unobserve(en.target);
      var s = en.target.querySelector(':scope > .stamp--elig');
      if (!s) return;
      setTimeout(function () { s.style.visibility = ''; press(s); }, delay);
      delay += 90;
    });
  }, { threshold: 0.6 }) : null;
  function queueStamp(card) {
    var s = stampFor(card);
    if (!io) { s.style.visibility = ''; return; }
    waiting.add(card);
    io.unobserve(card);
    io.observe(card);
  }
  function clearStamp(card) {
    waiting.delete(card);
    if (io) io.unobserve(card);
    var s = card.querySelector(':scope > .stamp--elig');
    if (s) s.remove();
  }

  function setFormStamp(label, tone) {
    if (!label) { formStamp.hidden = true; return; }
    formStamp.className = 'stamp elig__stamp stamp--' + tone;
    formStamp.textContent = label;
    formStamp.hidden = false;
    press(formStamp);
  }

  var eligibleBefore = {};
  function update(restamp) {
    var raw = age.value.trim();
    var a = parseInt(raw, 10);
    var long = (form.querySelector('input[name=duree]:checked') || {}).value === '24';
    var hasAge = raw !== '' && !isNaN(a);
    var eligible = cards.filter(function (c) {
      if (long && c.getAttribute('data-long') !== '1') return false;
      if (!hasAge) return true;
      return a >= 18 && a <= +c.getAttribute('data-max');
    });
    var set = new Set(eligible);
    var n = eligible.length;
    var now = {};

    cards.forEach(function (c) {
      var ok = set.has(c), iso = c.getAttribute('data-iso');
      c.classList.toggle('is-out', !ok);
      if (ok && hasAge) {
        now[iso] = true;
        if (restamp || !eligibleBefore[iso]) { clearStamp(c); queueStamp(c); }
      } else {
        clearStamp(c);
      }
    });
    eligibleBefore = now;

    countEl.textContent = n;
    if (hasAge && a < 18) {
      textEl.textContent = 'destination pour l’instant : le PVT s’ouvre à 18 ans.';
    } else if (hasAge && n === 0) {
      textEl.textContent = long
        ? 'destination ne permet de rester plus d’un an à ' + a + ' ans.'
        : 'destination : les PVT ouverts aux Français s’arrêtent à 35 ans.';
    } else if (hasAge) {
      textEl.textContent = (n > 1 ? 'destinations vous sont ouvertes' : 'destination vous est ouverte') + ' à ' + a + ' ans' + (long ? ' pour plus d’un an.' : '.');
    } else {
      textEl.textContent = long ? 'destinations permettent de rester plus d’un an.' : 'destinations ouvertes aux Français de 18 à 35 ans.';
    }
    if (hasAge) setFormStamp(n ? 'Éligible · ' + n + ' pays' : (a < 18 ? 'Trop tôt' : 'Hors limite'), n ? 'green' : 'red');
    else setFormStamp('');
    writeMrz(eligible.map(function (c) { return c.getAttribute('data-iso'); }));
  }

  function goToList(e) {
    if (age.value.trim() === '') {
      e.preventDefault();
      textEl.textContent = 'destinations : indiquez votre âge pour voir celles qui vous sont ouvertes.';
      age.focus();
      return;
    }
    e.preventDefault();
    update(true);
    document.getElementById('destinations').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  }

  var t;
  age.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { update(false); }, 180); });
  form.addEventListener('change', function (e) { if (e.target.name === 'duree') update(false); });
  form.addEventListener('submit', goToList);
  if (go) go.addEventListener('click', goToList);
  writeMrz(lastCodes, true);
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { writeMrz(lastCodes, true); }, 150); });

  // Carrousel des destinations : commandes accessibles, le swipe natif reste actif sur mobile.
  var destinationTrack = document.querySelector('[data-destination-track]');
  if (destinationTrack) {
    var destinationStep = function () {
      var slide = destinationTrack.querySelector('.destination-slide');
      return slide ? slide.getBoundingClientRect().width + (parseFloat(getComputedStyle(destinationTrack).columnGap) || 0) : destinationTrack.clientWidth * 0.8;
    };
    var previous = document.querySelector('[data-destination-prev]');
    var next = document.querySelector('[data-destination-next]');
    if (previous) previous.addEventListener('click', function () { destinationTrack.scrollBy({ left: -destinationStep() * 1.5, behavior: reduce ? 'auto' : 'smooth' }); });
    if (next) next.addEventListener('click', function () { destinationTrack.scrollBy({ left: destinationStep() * 1.5, behavior: reduce ? 'auto' : 'smooth' }); });
  }

  // Newsletter et liens partenaires : l'état réel vient du serveur
  fetch('/api/config').then(function (r) { return r.json(); }).then(function (c) {
    if (!c.newsletterConfigured) {
      var news = document.getElementById('newsletter');
      if (news) {
        news.querySelectorAll('input,button').forEach(function (el) { el.disabled = true; });
        var st = news.querySelector('.form-status');
        if (st) st.textContent = 'La newsletter ouvre bientôt. En attendant, écrivez-moi avec le formulaire.';
      }
    }
    if (c.amazonConfigured) {
      var p = document.getElementById('affiliation-statut');
      if (p) p.textContent = 'Les liens « Dans le sac » mènent vers Amazon avec mon identifiant Partenaires : un achat peut me rapporter une petite commission, sans surcoût pour vous. Les services à comparer ne me rémunèrent pas.';
    }
  }).catch(function () {});
})();
