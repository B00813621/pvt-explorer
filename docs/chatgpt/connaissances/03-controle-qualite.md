# 03 — Contrôle qualité (à lancer avec l'outil d'analyse de code)

Avant de livrer, enregistre l'article HTML dans `article.html` et la fiche dans `fiche.json`, puis exécute ce script Python. Corrige chaque ligne « À CORRIGER » et relance jusqu'à « Tout est conforme ».

```python
import json, re, html as H

art = open('article.html', encoding='utf-8').read()
try:
    fiche = json.load(open('fiche.json', encoding='utf-8'))
except Exception as e:
    fiche = {}
    print('À CORRIGER  fiche.json invalide ou absente :', e)

# Slugs existants ou prévus : copier la liste depuis 04-site-et-cocon.md si besoin
SLUGS_CONNUS = None  # ex. {'pvt-australie', 'budget-pvt-australie', ...}

def txt(s):
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', H.unescape(s)).strip()

mots = len(txt(art).split())
h2 = [txt(m) for m in re.findall(r'<h2[^>]*>(.*?)</h2>', art, re.S)]
h3 = len(re.findall(r'<h3', art))
faq_i = next((i for i, t in enumerate(h2) if 'FAQ' in t.upper()), -1)
m_faq = re.search(r'<h2[^>]*>[^<]*FAQ.*', art, re.S | re.I)
faq_part = m_faq.group(0) if m_faq else ''
faq_part = re.split(r'<p>\s*(?:<em>\s*)?(?:Sources?(?: officielles?)?\s*:|Photo\s*:)', faq_part)[0]
faq_q = len(re.findall(r'<h3', faq_part))
tables = len(re.findall(r'<table', art))
thead = len(re.findall(r'<thead|<th[\s>]', art))
callouts = re.findall(r'data-callout="(\w+)"', art)
imgs = re.findall(r'<img\b[^>]*>', art)
img_ko = [i for i in imgs if not re.search(r'alt="[^"]{5,}"', i) or not re.search(r'width="\d+"', i) or not re.search(r'height="\d+"', i)]
internes = sorted(set(re.findall(r'href="/blog/([^"#?]+)"', art)))
externes = sorted(set(re.findall(r'href="(https?://[^"]+)"', art)))
credits = len(re.findall(r'Photo\s*:', art))
kw = (fiche.get('focusKeyword') or '').lower()
debut = ' '.join(txt(art).split()[:100]).lower()
plain = txt(art)
nous = len(re.findall(r'(?<![\wÀ-ÿ])(nous|notre|nos)(?![\wÀ-ÿ])', plain, re.I))
tu = len(re.findall(r'(?<![\wÀ-ÿ])(tu|ton|ta|tes|toi)(?![\wÀ-ÿ])', plain))
pilier = (fiche.get('slug') or '').startswith('pvt-')
mini, maxl = (2500, 16) if pilier else (1800, 12)
titre, desc = fiche.get('title', ''), fiche.get('description', '')
k2 = sum(1 for t in h2 if kw and kw.split()[0] in t.lower())

res = []
def check(ok, label, detail=''):
    res.append(('OK         ' if ok else 'À CORRIGER ') + label + (' — ' + detail if detail else ''))

check(mots >= mini, 'Longueur', f'{mots} mots (minimum {mini})')
check(len(h2) >= 6, 'Sections', f'{len(h2)} H2, {h3} H3')
check(faq_i >= 0 and faq_i == len(h2) - 1, 'FAQ en dernier H2', f'dernier H2 : « {h2[-1] if h2 else "-"} »')
check(6 <= faq_q <= 10, 'Questions FAQ', f'{faq_q}')
check(bool(kw) and kw.split()[0] in debut, 'Mot-clé dans les 100 premiers mots', kw or 'focusKeyword absent')
check(k2 >= 2, 'Mot-clé dans au moins 2 H2', f'{k2}')
check('key' in callouts, 'Encadré « À retenir » (key)', ', '.join(callouts) or 'aucun')
check(len(callouts) >= 3, 'Au moins 3 encadrés', str(len(callouts)))
check(tables >= 1, 'Tableau', str(tables))
check(thead == 0, 'Tableaux sans thead/th', str(thead))
check(len(imgs) >= 2 and not img_ko, 'Photos du corps (alt + dimensions)', f'{len(imgs)} photo(s), {len(img_ko)} incomplète(s)')
check(bool(fiche.get('image')) and len(fiche.get('imageAlt', '')) >= 10, 'Photo à la une + alt')
check(credits >= len(imgs) + 1, 'Crédits photo', str(credits))
check(5 <= len(internes) <= maxl, 'Liens internes', f'{len(internes)} (5 à {maxl}) : {", ".join(internes)}')
if SLUGS_CONNUS:
    inconnus = [s for s in internes if s not in SLUGS_CONNUS]
    check(not inconnus, 'Liens internes vers des slugs existants', ', '.join(inconnus))
check(len(externes) >= 1, 'Sources officielles en lien', str(len(externes)))
check(50 <= len(titre) <= 65, 'Title', f'{len(titre)} caractères')
check(140 <= len(desc) <= 158, 'Meta description', f'{len(desc)} caractères')
check(nous == 0 and tu == 0, 'Voix « je + vous »', f'nous/notre/nos : {nous}, tutoiement : {tu}')
check(fiche.get('content', '').strip() == art.strip(), 'Le content de la fiche = article.html')

print('\n'.join(res))
print('\nStructure H2 :')
for i, t in enumerate(h2, 1):
    print(f'  {i}. {t}')
ko = sum(1 for r in res if r.startswith('À CORRIGER'))
print('\n' + (f'{ko} point(s) à corriger.' if ko else 'Tout est conforme.'))
```

## Relecture humaine (après le script)

- [ ] Un seul article, cohérent avec le cocon (04-site-et-cocon.md).
- [ ] Structure plus complète que chacun des 3 concurrents analysés.
- [ ] Aucun texte concurrent recopié.
- [ ] « Je + vous » partout, aucune anecdote ni témoignage inventé.
- [ ] Chaque chiffre daté et attribué à une source officielle.
- [ ] Encadré « À retenir » en ouverture, réponse directe sous chaque H2.
- [ ] Photos libres de droits avec crédit exact.
- [ ] FAQ de 6 à 10 questions en dernier H2.
