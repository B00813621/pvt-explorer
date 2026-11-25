/* PVT Explorer — recommandations multi-destinations, calculées localement. */
(function(){
  'use strict';
  var form=document.getElementById('pvt-finder-form');
  var results=document.getElementById('pvt-finder-results');
  if(!form||!results)return;
  var countries=[
    {id:'AU',name:'Australie',max:35,min:3500,url:'/blog/pvt-australie',tags:['english','earn','seasonal','hospitality','nature','mix','warm','roadtrip','career'],why:'Un grand choix de jobs saisonniers et de grands espaces, avec la possibilité de voyager longtemps.'},
    {id:'NZ',name:'Nouvelle-Zélande',max:30,min:3000,url:'/blog/pvt-nouvelle-zelande',tags:['english','travel','seasonal','nature','mix','four','roadtrip'],why:'Une destination idéale pour les road trips, les saisons agricoles et les amoureux de nature.'},
    {id:'CA',name:'Canada',max:35,min:4000,url:'/blog/pvt-canada-2027',tags:['english','earn','career','hospitality','city','nature','mix','four','roadtrip'],why:'De grandes villes, des paysages immenses et des opportunités dans plusieurs secteurs.'},
    {id:'JP',name:'Japon',max:30,min:3500,url:'/blog/pvt-japon',tags:['asian','culture','hospitality','city','mix','four'],why:'Une immersion culturelle forte entre grandes métropoles, traditions et campagne.'},
    {id:'KR',name:'Corée du Sud',max:30,min:3000,url:'/blog/pvt-coree-du-sud',tags:['asian','culture','social','hospitality','city','four','festive'],why:'Une expérience urbaine et culturelle, particulièrement intéressante pour découvrir la vie à Séoul.'},
    {id:'HK',name:'Hong Kong',max:30,min:4500,url:'#pvt-HK',tags:['english','career','hospitality','city','mix'],why:'Une métropole internationale et intense, entre vie urbaine et nature accessible.'},
    {id:'TW',name:'Taïwan',max:30,min:3000,url:'#pvt-TW',tags:['asian','culture','travel','city','nature','mix','warm'],why:'Un bon équilibre entre villes animées, montagnes, littoral et découverte culturelle.'},
    {id:'AR',name:'Argentine',max:35,min:2500,url:'#pvt-AR',tags:['spanish','travel','nature','mix','four','roadtrip','culture'],why:'Des paysages spectaculaires, de Buenos Aires à la Patagonie, et une immersion hispanophone.'},
    {id:'BR',name:'Brésil',max:30,min:2500,url:'#pvt-BR',tags:['portuguese','social','warm','beach','festive','culture'],why:'Une destination chaleureuse, festive et tournée vers les plages et la culture.'},
    {id:'CL',name:'Chili',max:30,min:3000,url:'#pvt-CL',tags:['spanish','travel','nature','four','roadtrip','career','seasonal'],why:'Un terrain de jeu exceptionnel pour les amateurs de randonnée, de désert et de grands espaces.'},
    {id:'CO',name:'Colombie',max:30,min:2500,url:'#pvt-CO',tags:['spanish','social','warm','beach','festive','culture','travel'],why:'Une ambiance conviviale, des villes vivantes, des montagnes et des côtes tropicales.'},
    {id:'EC',name:'Équateur',max:30,min:2500,url:'#pvt-EC',tags:['spanish','travel','nature','warm','roadtrip','culture'],why:'Une destination compacte et dépaysante entre Andes, Amazonie et côte Pacifique.'},
    {id:'MX',name:'Mexique',max:30,min:3000,url:'#pvt-MX',tags:['spanish','social','warm','beach','festive','culture','city'],why:'Un mélange de plages, de villes, de gastronomie et de patrimoine culturel.'},
    {id:'PE',name:'Pérou',max:30,min:2500,url:'#pvt-PE',tags:['spanish','travel','nature','roadtrip','culture'],why:'Une aventure tournée vers les Andes, les sites historiques et les grands itinéraires.'},
    {id:'UY',name:'Uruguay',max:30,min:3000,url:'#pvt-UY',tags:['spanish','travel','beach','mix','four','social'],why:'Un pays à taille humaine, entre littoral, douceur de vivre et culture sud-américaine.'}
  ];
  function selected(name){var el=form.querySelector('[name="'+name+'"]:checked');return el?el.value:'';}
  function add(parent,tag,className,content){var el=document.createElement(tag);if(className)el.className=className;if(content!==undefined)el.textContent=content;parent.appendChild(el);return el;}
  function recommend(e){
    e.preventDefault();
    if(!form.reportValidity())return;
    var age=Number(form.elements.age.value),budget=selected('budget'),nationality=selected('nationality');
    var prefs=['goal','language','climate','environment','work','dream'].map(selected);
    var budgetCeiling={low:2500,medium:4000,comfortable:6000,high:10000}[budget];
    var ranked=countries.filter(function(c){return age>=18&&age<=c.max;}).map(function(c){
      var score=0,matched=0;
      prefs.forEach(function(p){if(p==='open'||p==='any'||p==='flexible'||p==='notpriority')return;if(c.tags.indexOf(p)!==-1){score+=2;matched++;}});
      if(c.tags.indexOf('mix')!==-1&&selected('environment')==='mix')score+=1;
      if(budgetCeiling>=c.min)score+=2;else score-=1;
      return Object.assign({},c,{score:score,matched:matched,budgetOk:budgetCeiling>=c.min});
    }).filter(function(c){return c.score>=4;}).sort(function(a,b){return b.score-a.score||a.min-b.min;});
    results.hidden=false;
    results.replaceChildren();
    add(results,'h3','',ranked.length?'Voici les destinations qui correspondent à votre profil':'Aucune destination ne ressort avec ces critères');
    add(results,'p','pvt-finder__results-intro',ranked.length?'Nous avons classé les pays selon vos envies, votre budget et votre âge. Vous pouvez comparer plusieurs possibilités, sans vous limiter à un seul pays.':'Essayez d’élargir votre budget ou de modifier quelques préférences. Vérifiez également votre âge limite pour chaque programme.');
    if(ranked.length){
      var list=add(results,'div','pvt-finder__result-list');
      ranked.forEach(function(c,i){
        var card=add(list,'article','pvt-finder__card');
        add(card,'span','pvt-finder__match',i<3?'Très bonne correspondance': 'Autre possibilité');
        add(card,'h4','',c.name);
        add(card,'p','',c.why);
        if(!c.budgetOk)add(card,'p','pvt-finder__note','Budget à renforcer : estimation de départ autour de '+c.min.toLocaleString('fr-FR')+' € ou plus.');
        var link=add(card,'a','',c.url.charAt(0)==='#'?'Voir la fiche pays →':'Lire le guide PVT →');
        link.href=c.url;
      });
    }
    var note=nationality==='fr'?'Résultats calculés pour les accords PVT destinés aux ressortissants français.':'Les accords et limites d’âge affichés ici sont basés sur les destinations françaises : vérifiez l’existence d’un accord PVT pour votre nationalité avant toute démarche.';
    add(results,'p','pvt-finder__note',note+' Les budgets sont des ordres de grandeur indicatifs, pas des garanties de fonds suffisants. Les règles de visa, quotas et conditions de travail peuvent évoluer : consultez toujours les autorités officielles.');
    var again=add(results,'button','pvt-finder__again','Modifier mes réponses');
    again.type='button';again.addEventListener('click',function(){results.hidden=true;form.scrollIntoView({behavior:'smooth',block:'start'});});
    results.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }
  form.addEventListener('submit',recommend);
})();
