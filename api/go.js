// Affiliate redirect handler - reached via /go/:slug rewrite
const AMAZON_TAG = process.env.AMAZON_PARTNER_TAG || '';
const PARTNER_URLS = {
  flights: process.env.PARTNER_FLIGHTS_URL || '',
  stay: process.env.PARTNER_STAYS_URL || '',
  insurance: process.env.PARTNER_INSURANCE_URL || '',
  esim: process.env.PARTNER_ESIM_URL || '',
  activities: process.env.PARTNER_ACTIVITIES_URL || '',
  car: process.env.PARTNER_CAR_URL || ''
};

function affiliateTarget(slug, term) {
  const enc = encodeURIComponent(term || '');
  const tag = AMAZON_TAG ? `&tag=${encodeURIComponent(AMAZON_TAG)}` : '';
  if (slug === 'amazon') return `https://www.amazon.fr/s?k=${enc}${tag}`;
  if (PARTNER_URLS[slug]) return PARTNER_URLS[slug];
  const discovery = {
    insurance: 'https://www.google.com/search?q=assurance+voyage+PVT',
    esim: 'https://www.google.com/search?q=eSIM+voyage',
    flights: 'https://www.google.com/travel/flights',
    stay: 'https://www.booking.com/',
    activities: 'https://www.getyourguide.com/',
    car: 'https://www.google.com/travel/cars'
  };
  return discovery[slug] || null;
}

module.exports = function(req, res) {
  const slug = (req.query.slug || '').trim().slice(0, 60);
  const term = (req.query.q || '').trim().slice(0, 180);
  const target = affiliateTarget(slug, term);
  if (!target) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Lien partenaire inconnu.');
  }
  res.writeHead(302, {
    Location: target,
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'strict-origin-when-cross-origin'
  });
  res.end();
};
