'use strict';
// Génère les motifs guillochés du site (bande ondulée et rosace du logo) dans public/images/.
// Les rosaces propres à chaque pays sont calculées dans le navigateur par public/js/visa.js.
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(__dirname, '..', 'public', 'images');
const f = n => Math.round(n * 10) / 10;

function band() {
  const W = 240, H = 40, lines = 8, step = 2;
  let d = '';
  for (const [cycles, amp] of [[3, 14], [5, 8]]) {
    for (let k = 0; k < lines; k++) {
      const phase = (k / lines) * Math.PI * 2;
      let s = '';
      for (let x = 0; x <= W; x += step) {
        const y = H / 2 + amp * Math.sin((x / W) * Math.PI * 2 * cycles + phase);
        s += (x === 0 ? 'M' : 'L') + f(x) + ' ' + f(y);
      }
      d += s;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="none"><path d="${d}" fill="none" stroke="#000" stroke-width=".55"/></svg>\n`;
}

// Rosace : anneaux sinusoïdaux décalés + hypotrochoïde centrale, comme une rosace d'impression de sécurité.
function rosette(size, petals, rings, inner) {
  const c = size / 2, R = size * 0.42, A = size * 0.06, N = 240;
  let d = '';
  for (let k = 0; k < rings; k++) {
    const ph = (k / rings) * (Math.PI * 2 / petals);
    for (let i = 0; i <= N; i++) {
      const t = (i / N) * Math.PI * 2;
      const r = R + A * Math.sin(petals * t + ph * petals);
      d += (i ? 'L' : 'M') + f(c + r * Math.cos(t)) + ' ' + f(c + r * Math.sin(t));
    }
  }
  const a = size * 0.2, b = a / inner, h = size * 0.12;
  for (let i = 0; i <= N * 2; i++) {
    const t = (i / (N * 2)) * Math.PI * 2 * 1;
    const x = (a - b) * Math.cos(t * inner) + h * Math.cos(((a - b) / b) * t * inner);
    const y = (a - b) * Math.sin(t * inner) - h * Math.sin(((a - b) / b) * t * inner);
    d += (i ? 'L' : 'M') + f(c + x) + ' ' + f(c + y);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}"><path d="${d}" fill="none" stroke="#e3c886" stroke-width="${f(size / 110)}"/></svg>\n`;
}

fs.writeFileSync(path.join(OUT, 'guilloche.svg'), band());
fs.writeFileSync(path.join(OUT, 'rosace.svg'), rosette(64, 12, 3, 7));
console.log('guilloche.svg, rosace.svg écrits dans public/images/');
