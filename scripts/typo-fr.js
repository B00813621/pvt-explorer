'use strict';
// Espaces insécables fines de la typographie française (avant ? ! : ; », après «), hors <script>, <style> et attributs.
function typoFr(html) {
  return String(html).split(/(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)/).map((part, i) => {
    if (i % 2) return part;
    return part
      .replace(/[  ]+([?!;:»])/g, ' $1')
      .replace(/«[  ]+/g, '« ');
  }).join('');
}
module.exports = { typoFr };
if (require.main === module) {
  const fs = require('node:fs');
  for (const f of process.argv.slice(2)) fs.writeFileSync(f, typoFr(fs.readFileSync(f, 'utf8')));
}
