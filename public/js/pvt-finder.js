/* PVT Explorer — « Trouver mon PVT » : une question à la fois, on passe à la suivante d'un clic,
   puis un tableau des départs avec les destinations qui correspondent le mieux.
   Tout se calcule dans le navigateur ; rien n'est envoyé. */
(function () {
  'use strict';
  var racine = document.querySelector('[data-quiz]');
  if (!racine) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Âges limites, budgets de départ et accès : repris des vignettes et du comparateur de l'accueil (à garder identiques)
  var PAYS = [
    { id: 'AU', iso: 'AUS', nom: 'Australie', max: 35, min: 3500, acces: 'ouvert', url: '/blog/pvt-australie', tags: ['english', 'earn', 'seasonal', 'hospitality', 'nature', 'mix', 'warm', 'roadtrip', 'career'], pourquoi: 'Un grand choix de jobs saisonniers et de grands espaces, avec la possibilité de rester plus longtemps.' },
    { id: 'NZ', iso: 'NZL', nom: 'Nouvelle-Zélande', max: 30, min: 3000, acces: 'ouvert', url: '/blog/pvt-nouvelle-zelande', tags: ['english', 'travel', 'seasonal', 'nature', 'mix', 'four', 'roadtrip'], pourquoi: 'Le pays des road trips, des saisons agricoles et des amoureux de nature.' },
    { id: 'CA', iso: 'CAN', nom: 'Canada', max: 35, min: 2500, acces: 'invitation', url: '/blog/pvt-canada-2027', tags: ['english', 'earn', 'career', 'hospitality', 'city', 'nature', 'mix', 'four', 'roadtrip'], pourquoi: 'De grandes villes, des paysages immenses et du travail dans de nombreux secteurs.' },
    { id: 'JP', iso: 'JPN', nom: 'Japon', max: 30, min: 3000, acces: 'dossier', url: '/blog/pvt-japon', tags: ['asian', 'culture', 'hospitality', 'city', 'mix', 'four'], pourquoi: 'Une immersion forte entre grandes métropoles, traditions et campagne.' },
    { id: 'KR', iso: 'KOR', nom: 'Corée du Sud', max: 30, min: 2500, acces: 'quota', url: '/blog/pvt-coree-du-sud', tags: ['asian', 'culture', 'social', 'hospitality', 'city', 'four', 'festive'], pourquoi: 'Une expérience urbaine et culturelle, idéale pour vivre au rythme de Séoul.' },
    { id: 'HK', iso: 'HKG', nom: 'Hong Kong', max: 30, min: 3500, acces: 'verifier', url: '/#pvt-HK', tags: ['english', 'career', 'hospitality', 'city', 'mix'], pourquoi: 'Une métropole internationale et intense, avec la nature à portée de main.' },
    { id: 'TW', iso: 'TWN', nom: 'Taïwan', max: 30, min: 2500, acces: 'verifier', url: '/#pvt-TW', tags: ['asian', 'culture', 'travel', 'city', 'nature', 'mix', 'warm'], pourquoi: 'Un bon équilibre entre villes animées, montagnes, littoral et découverte culturelle.' },
    { id: 'AR', iso: 'ARG', nom: 'Argentine', max: 35, min: 2000, acces: 'verifier', url: '/#pvt-AR', tags: ['spanish', 'travel', 'nature', 'mix', 'four', 'roadtrip', 'culture'], pourquoi: 'Des paysages spectaculaires, de Buenos Aires à la Patagonie, en espagnol.' },
    { id: 'BR', iso: 'BRA', nom: 'Brésil', max: 30, min: 2500, acces: 'verifier', url: '/#pvt-BR', tags: ['portuguese', 'social', 'warm', 'beach', 'festive', 'culture'], pourquoi: 'Une destination chaleureuse et festive, tournée vers les plages et la culture.' },
    { id: 'CL', iso: 'CHL', nom: 'Chili', max: 30, min: 2500, acces: 'verifier', url: '/#pvt-CL', tags: ['spanish', 'travel', 'nature', 'four', 'roadtrip', 'career', 'seasonal'], pourquoi: 'Un terrain de jeu pour la randonnée, le désert et les grands espaces.' },
    { id: 'CO', iso: 'COL', nom: 'Colombie', max: 30, min: 2000, acces: 'verifier', url: '/#pvt-CO', tags: ['spanish', 'social', 'warm', 'beach', 'festive', 'culture', 'travel'], pourquoi: 'Une ambiance conviviale, des villes vivantes, des montagnes et des côtes tropicales.' },
    { id: 'EC', iso: 'ECU', nom: 'Équateur', max: 30, min: 2000, acces: 'verifier', url: '/#pvt-EC', tags: ['spanish', 'travel', 'nature', 'warm', 'roadtrip', 'culture'], pourquoi: 'Un pays compact et dépaysant entre Andes, Amazonie et côte Pacifique.' },
    { id: 'MX', iso: 'MEX', nom: 'Mexique', max: 30, min: 2500, acces: 'verifier', url: '/#pvt-MX', tags: ['spanish', 'social', 'warm', 'beach', 'festive', 'culture', 'city'], pourquoi: 'Un mélange de plages, de villes, de cuisine et de patrimoine.' },
    { id: 'PE', iso: 'PER', nom: 'Pérou', max: 30, min: 2000, acces: 'verifier', url: '/#pvt-PE', tags: ['spanish', 'travel', 'nature', 'roadtrip', 'culture'], pourquoi: 'Une aventure tournée vers les Andes, les sites incas et les grands itinéraires.' },
    { id: 'UY', iso: 'URY', nom: 'Uruguay', max: 30, min: 2500, acces: 'verifier', url: '/#pvt-UY', tags: ['spanish', 'travel', 'beach', 'mix', 'four', 'social'], pourquoi: 'Un pays à taille humaine, entre littoral et douceur de vivre.' }
  ];
  var ACCES = { ouvert: 'Ouvert', invitation: 'Sur invitation', quota: 'Sous quota', dossier: 'Sur dossier', verifier: 'À vérifier' };

  // [valeur, libellé, libellé court du récapitulatif]
  var QUESTIONS = [
    { cle: 'age', titre: 'Quel âge avez-vous ?', aide: 'La limite est de 30 ou 35 ans selon le pays.', choix: [['moins18', 'Moins de 18 ans', 'Moins de 18 ans'], ['18-30', 'Entre 18 et 30 ans', '18–30 ans'], ['31-35', 'Entre 31 et 35 ans', '31–35 ans'], ['36plus', 'Plus de 35 ans', 'Plus de 35 ans']] },
    { cle: 'nationalite', titre: 'Quelle est votre nationalité ?', aide: 'Les 15 accords présentés ici sont ceux ouverts aux Français.', choix: [['fr', 'Française', 'Française'], ['autre', 'Une autre nationalité', 'Autre nationalité']] },
    { cle: 'budget', titre: 'Quel budget pouvez-vous réunir avant le départ ?', aide: 'Le visa, le billet d’avion et les premières semaines sur place.', choix: [['low', 'Moins de 2 500 €', '< 2 500 €'], ['medium', 'De 2 500 à 4 000 €', '2 500–4 000 €'], ['comfortable', 'De 4 000 à 6 000 €', '4 000–6 000 €'], ['high', 'Plus de 6 000 €', '> 6 000 €']] },
    { cle: 'goal', titre: 'Quel est votre objectif principal ?', choix: [['earn', 'Travailler et mettre de l’argent de côté', 'Économiser'], ['travel', 'Travailler pour financer mes voyages', 'Voyager'], ['culture', 'Découvrir une autre culture', 'Culture'], ['social', 'Rencontrer du monde et vivre une aventure', 'Rencontres']] },
    { cle: 'language', titre: 'Quelle langue avez-vous envie de pratiquer ?', choix: [['english', 'L’anglais', 'Anglais'], ['spanish', 'L’espagnol', 'Espagnol'], ['portuguese', 'Le portugais', 'Portugais'], ['asian', 'Le japonais, le coréen ou le mandarin', 'Langue d’Asie'], ['open', 'Peu importe, j’apprendrai sur place', 'Toute langue']] },
    { cle: 'climate', titre: 'Quel climat vous attire le plus ?', choix: [['warm', 'Chaleur, soleil et plages', 'Chaleur'], ['four', 'Des saisons bien marquées', 'Saisons marquées'], ['any', 'Peu importe, je m’adapte', 'Tout climat']] },
    { cle: 'environment', titre: 'Dans quel cadre vous voyez-vous vivre ?', choix: [['city', 'Une grande ville animée', 'Grande ville'], ['nature', 'La nature et les grands espaces', 'Nature'], ['beach', 'Les plages et l’océan', 'Océan'], ['mix', 'Un peu de tout', 'Un peu de tout']] },
    { cle: 'work', titre: 'Quel type de travail recherchez-vous ?', choix: [['seasonal', 'Saisonnier : fermes, chantiers, tourisme', 'Saisonnier'], ['hospitality', 'Hôtellerie, restauration et services', 'Hôtellerie'], ['flexible', 'Tous les petits boulots', 'Tout job'], ['notpriority', 'Le travail n’est pas ma priorité', 'Travail secondaire']] },
    { cle: 'dream', titre: 'Quelle expérience vous fait le plus rêver ?', choix: [['roadtrip', 'Un road trip dans des paysages immenses', 'Road trip'], ['culture', 'Une immersion culturelle dépaysante', 'Immersion'], ['festive', 'Une vie sociale animée et festive', 'Vie sociale'], ['career', 'Une expérience professionnelle à l’étranger', 'Expérience pro']] }
  ];
  var AGES = { moins18: 17, '18-30': 25, '31-35': 33, '36plus': 40 };
  var PLAFONDS = { low: 2500, medium: 4000, comfortable: 6000, high: 10000 };
  var NEUTRES = ['open', 'any', 'flexible', 'notpriority'];
  var LETTRES = 'ABCDE';
  var N = QUESTIONS.length;
  var reponses = {}, etape = 0, verrou = false;

  var AVION = '<svg class="departs__avion" viewBox="0 0 24 24" aria-hidden="true"><path transform="rotate(62 12 12)" d="M12 2.5c.8 0 1.4.9 1.4 2.2v5.1l7.1 4.3v1.9l-7.1-2.1v4.6l2 1.5v1.5L12 20.6l-3.4.9V20l2-1.5v-4.6l-7.1 2.1v-1.9l7.1-4.3V4.7c0-1.3.6-2.2 1.4-2.2Z" fill="currentColor"/></svg>';
  var FLECHE_G = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8H4M7.5 4.5 4 8l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var FLECHE_D = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function euros(n) { return n.toLocaleString('fr-FR') + ' €'; }
  function libelle(q, v, court) { var c = q.choix.find(function (x) { return x[0] === v; }); return c ? c[court ? 2 : 1] : ''; }

  // Ligne façon passeport (zone de lecture machine) qui se remplit au fil des réponses
  function mrz() {
    var codes = QUESTIONS.map(function (q) { return reponses[q.cle] ? reponses[q.cle].toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) : ''; }).filter(Boolean);
    var l1 = ('P<FRAPVT<EXPLORER<<TROUVER<MON<PVT' + '<'.repeat(44)).slice(0, 44);
    var l2 = (codes.join('<') + '<'.repeat(44)).slice(0, 44);
    return '<!-- impeccable-disable wide-tracking: ligne MRZ imitant une zone de lecture machine, masquée aux lecteurs d’écran -->' +
      '<p class="mrz quiz__mrz" aria-hidden="true">' + esc(l1) + '<br>' + esc(l2) + '</p>';
  }

  function recap() {
    var faites = QUESTIONS.map(function (q, i) { return reponses[q.cle] ? '<li><button type="button" data-aller="' + i + '" aria-label="Modifier : ' + esc(q.titre) + ' (' + esc(libelle(q, reponses[q.cle])) + ')">' + esc(libelle(q, reponses[q.cle], true)) + '</button></li>' : ''; }).join('');
    return faites ? '<div class="quiz__recap"><span class="label">Vos réponses</span><ul role="list">' + faites + '</ul></div>' : '';
  }

  function progres() {
    var s = '';
    for (var i = 0; i < N; i++) s += '<span class="' + (i < etape ? 'is-fait' : i === etape ? 'is-courant' : '') + '"></span>';
    return '<div class="quiz__progres" aria-hidden="true">' + s + '</div>';
  }

  function focaliser() {
    var t = racine.querySelector('#quiz-question');
    if (t) t.focus({ preventScroll: true });
    var haut = racine.getBoundingClientRect().top;
    if (haut < 80 || haut > window.innerHeight * 0.6) window.scrollTo({ top: window.scrollY + haut - 96, behavior: reduce ? 'auto' : 'smooth' });
  }

  function rendre(sens) {
    if (etape >= N) { resultats(sens); return; }
    var q = QUESTIONS[etape];
    racine.innerHTML =
      '<div class="quiz__haut">' + (etape ? '<button class="quiz__retour" type="button" data-retour>' + FLECHE_G + 'Retour</button>' : '<span class="quiz__debut label">Trouver mon PVT</span>') +
      '<p class="quiz__etape data">Question ' + (etape + 1) + ' sur ' + N + '</p></div>' + progres() +
      '<div class="quiz__corps' + (sens && !reduce ? ' is-' + sens : '') + '">' +
        '<h2 class="quiz__question" id="quiz-question" tabindex="-1">' + esc(q.titre) + '</h2>' +
        (q.aide ? '<p class="quiz__aide">' + esc(q.aide) + '</p>' : '') +
        '<div class="quiz__choix" role="group" aria-labelledby="quiz-question">' + q.choix.map(function (c, i) {
          return '<button class="quiz__option" type="button" data-valeur="' + esc(c[0]) + '" aria-pressed="' + (reponses[q.cle] === c[0]) + '" aria-keyshortcuts="' + LETTRES[i] + '"><span class="quiz__lettre data" aria-hidden="true">' + LETTRES[i] + '</span><span class="quiz__libelle">' + esc(c[1]) + '</span></button>';
        }).join('') + '</div>' +
      '</div>' + recap() + mrz();
    if (sens) focaliser();
  }

  function prochaine() {
    for (var i = etape + 1; i < N; i++) if (!reponses[QUESTIONS[i].cle]) return i;
    return N;
  }

  function choisir(bouton) {
    if (verrou) return;
    verrou = true;
    var q = QUESTIONS[etape];
    reponses[q.cle] = bouton.getAttribute('data-valeur');
    racine.querySelectorAll('.quiz__option').forEach(function (b) { b.setAttribute('aria-pressed', String(b === bouton)); });
    bouton.classList.add('is-choisi');
    setTimeout(function () {
      verrou = false;
      // Hors des limites d'âge, inutile de poser les autres questions
      etape = q.cle === 'age' && (reponses.age === 'moins18' || reponses.age === '36plus') ? N : prochaine();
      rendre('avant');
    }, reduce ? 90 : 300);
  }

  function classer() {
    var age = AGES[reponses.age], plafond = PLAFONDS[reponses.budget] || 4000;
    var envies = ['goal', 'language', 'climate', 'environment', 'work', 'dream'].map(function (k) { return reponses[k]; });
    return PAYS.filter(function (p) { return age >= 18 && age <= p.max; }).map(function (p) {
      var score = 0;
      envies.forEach(function (v) { if (v && NEUTRES.indexOf(v) === -1 && p.tags.indexOf(v) !== -1) score += 2; });
      if (p.tags.indexOf('mix') !== -1 && reponses.environment === 'mix') score += 1;
      var budgetOk = plafond >= p.min;
      score += budgetOk ? 2 : -1;
      return { p: p, score: score, budgetOk: budgetOk };
    }).filter(function (r) { return r.score >= 4; }).sort(function (a, b) { return b.score - a.score || a.p.min - b.p.min; });
  }

  function resultats(sens) {
    var horsAge = reponses.age === 'moins18' || reponses.age === '36plus';
    var tous = horsAge ? [] : classer();
    var liste = tous.slice(0, 6), autres = tous.slice(6);
    var corps;
    if (horsAge) {
      corps = '<h2 class="quiz__question" id="quiz-question" tabindex="-1">' + (reponses.age === 'moins18' ? 'Le PVT s’ouvre à 18 ans' : 'Au-delà de 35 ans, pas de PVT') + '</h2>' +
        '<p class="quiz__aide">' + (reponses.age === 'moins18'
          ? 'Les accords de PVT sont réservés aux 18–30 ans ou aux 18–35 ans selon le pays. Vous pouvez déjà préparer votre projet : budget, langue, destination.'
          : 'Les accords de PVT signés par la France s’arrêtent à 30 ou 35 ans selon le pays. D’autres visas de travail existent : renseignez-vous auprès du pays qui vous attire.') + '</p>';
    } else if (!liste.length) {
      corps = '<h2 class="quiz__question" id="quiz-question" tabindex="-1">Aucune destination ne ressort nettement</h2>' +
        '<p class="quiz__aide">Vos envies se répartissent entre plusieurs pays. Essayez d’élargir votre budget ou d’assouplir une ou deux réponses, ou comparez les 15 PVT sur un seul tableau.</p>';
    } else {
      corps = '<h2 class="quiz__question" id="quiz-question" tabindex="-1">Vos meilleurs départs</h2>' +
        '<p class="quiz__aide">J’ai classé les pays selon vos envies, votre budget et votre âge. Comparez-en plusieurs avant de choisir.</p>' +
        '<div class="departs quiz__tableau"><div class="departs__tete" aria-hidden="true"><span class="departs__titre">Vos départs <span lang="en">Departures</span></span>' + AVION +
        '<span class="departs__terminal">' + (liste.length > 1 ? 'Vos ' + liste.length + ' meilleures destinations' : 'Votre meilleure destination') + '</span></div>' +
        '<ol class="choix-departs" role="list">' + liste.map(function (r, i) {
          var p = r.p, fiche = p.url.indexOf('/#') === 0;
          return '<li class="choix-depart' + (i < 3 ? ' is-top' : '') + '">' +
            '<span class="volets" aria-hidden="true">' + p.iso.split('').map(function (c) { return '<span>' + c + '</span>'; }).join('') + '</span>' +
            '<div class="choix-depart__texte"><span class="choix-depart__rang">' + (i < 3 ? 'Meilleur choix' : 'Bonne piste') + '</span>' +
              '<h3 class="choix-depart__nom">' + esc(p.nom) + '</h3><p>' + esc(p.pourquoi) + '</p>' +
              (r.budgetOk ? '' : '<p class="choix-depart__note">Budget de départ indicatif : dès ' + euros(p.min) + '. Prévoyez un peu plus.</p>') + '</div>' +
            '<div class="choix-depart__infos"><span class="porte">18–' + p.max + '</span><span class="statut statut--' + p.acces + '">' + ACCES[p.acces] + '</span>' +
              '<span class="choix-depart__budget data">dès ' + euros(p.min) + '</span>' +
              '<a class="choix-depart__lien" href="' + esc(p.url) + '">' + (fiche ? 'Voir la fiche' : 'Lire le guide') + ' ' + FLECHE_D + '<span class="visually-hidden"> : ' + esc(p.nom) + '</span></a></div>' +
            '</li>';
        }).join('') + '</ol></div>' +
        (autres.length ? '<p class="quiz__autres">Autres pistes possibles : ' + autres.map(function (r) { return '<a href="' + esc(r.p.url) + '">' + esc(r.p.nom) + '</a>'; }).join(', ') + '.</p>' : '');
    }
    var note = reponses.nationalite === 'autre'
      ? 'Ces résultats portent sur les accords ouverts aux Français : vérifiez qu’un accord existe pour votre nationalité avant toute démarche. '
      : '';
    racine.innerHTML =
      '<div class="quiz__haut"><button class="quiz__retour" type="button" data-retour>' + FLECHE_G + 'Retour</button><p class="quiz__etape data">Résultat</p></div>' +
      '<div class="quiz__progres is-complet" aria-hidden="true">' + new Array(N + 1).join('<span class="is-fait"></span>') + '</div>' +
      '<div class="quiz__corps' + (sens && !reduce ? ' is-' + sens : '') + '">' + corps +
        '<p class="quiz__note">' + note + 'Les budgets sont des ordres de grandeur indicatifs ; quotas, tirages et conditions changent. Vérifiez toujours sur le site officiel du pays.</p>' +
        '<div class="quiz__fin"><button class="btn btn--line" type="button" data-recommencer>Recommencer</button><a class="btn" href="/#comparer">Comparer les 15 PVT ' + FLECHE_D + '</a></div>' +
      '</div>' + recap() + mrz();
    focaliser();
  }

  racine.addEventListener('click', function (e) {
    var o = e.target.closest('.quiz__option');
    if (o) { choisir(o); return; }
    if (e.target.closest('[data-retour]')) {
      if (etape >= N && (reponses.age === 'moins18' || reponses.age === '36plus')) etape = 0;
      else etape = Math.max(0, Math.min(etape, N) - 1);
      rendre('arriere');
      return;
    }
    var a = e.target.closest('[data-aller]');
    if (a) { etape = +a.getAttribute('data-aller'); rendre('arriere'); return; }
    if (e.target.closest('[data-recommencer]')) { reponses = {}; etape = 0; rendre('arriere'); }
  });

  // Clavier : A, B, C… (ou 1, 2, 3…) répondent à la question affichée
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || etape >= N) return;
    var t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.querySelector('dialog[open]')) return;
    var k = e.key.toUpperCase(), i = LETTRES.indexOf(k);
    if (i === -1 && /^[1-5]$/.test(k)) i = +k - 1;
    var options = racine.querySelectorAll('.quiz__option');
    if (i >= 0 && options[i]) { e.preventDefault(); options[i].focus(); choisir(options[i]); }
  });

  rendre();
})();
