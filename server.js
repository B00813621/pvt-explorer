// PVT Explorer - serveur Node.js 18+ sans dépendance externe.
// Données communautaires persistées dans data/db.json. Les secrets restent côté serveur.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = Number(process.env.PORT || 3000);
const API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const AMAZON_TAG = process.env.AMAZON_PARTNER_TAG || '';
const ADSENSE_CLIENT_ID = process.env.ADSENSE_CLIENT_ID || '';
const ADSENSE_SLOT_DESTINATIONS = process.env.ADSENSE_SLOT_DESTINATIONS || '';
const ADSENSE_SLOT_CONTENT = process.env.ADSENSE_SLOT_CONTENT || '';
const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
const BREVO_LIST_ID = Number(process.env.BREVO_LIST_ID || 0);
const BREVO_DOI_TEMPLATE_ID = Number(process.env.BREVO_DOI_TEMPLATE_ID || 0);
const BREVO_REDIRECT_URL = process.env.BREVO_REDIRECT_URL || '';
const PARTNER_URLS = {
  flights: process.env.PARTNER_FLIGHTS_URL || '',
  stay: process.env.PARTNER_STAYS_URL || '',
  insurance: process.env.PARTNER_INSURANCE_URL || '',
  esim: process.env.PARTNER_ESIM_URL || '',
  activities: process.env.PARTNER_ACTIVITIES_URL || '',
  car: process.env.PARTNER_CAR_URL || ''
};
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8'};
const rate = new Map();
fs.mkdirSync(DATA_DIR, {recursive:true});
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({questions:[], clicks:{}, newsletter:[]}, null, 2));
function dbRead(){ try{return JSON.parse(fs.readFileSync(DB_FILE,'utf8'));}catch{return {questions:[],clicks:{},newsletter:[]};} }
function dbWrite(db){ const tmp=DB_FILE+'.tmp'; fs.writeFileSync(tmp,JSON.stringify(db,null,2)); fs.renameSync(tmp,DB_FILE); }
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}
function text(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'X-Content-Type-Options':'nosniff'});res.end(body);}
function readBody(req,max=12000){return new Promise((resolve,reject)=>{let body='';req.on('data',c=>{body+=c;if(body.length>max){reject(new Error('Contenu trop volumineux'));req.destroy();}});req.on('end',()=>{try{resolve(JSON.parse(body||'{}'));}catch{reject(new Error('JSON invalide'));}});req.on('error',reject);});}
function clean(v,n=1200){return typeof v==='string'?v.trim().replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').slice(0,n):'';}
function id(){return crypto.randomBytes(9).toString('hex');}
function clientKey(req){return crypto.createHash('sha256').update(String(req.socket.remoteAddress||'unknown')).digest('hex').slice(0,16);}
function limited(req,key,max=8,windowMs=60000){const k=key+':'+clientKey(req),now=Date.now(),arr=(rate.get(k)||[]).filter(t=>now-t<windowMs);if(arr.length>=max){rate.set(k,arr);return false;}arr.push(now);rate.set(k,arr);return true;}
function isAdmin(req){if(!ADMIN_TOKEN)return false;const h=req.headers.authorization||'';const token=h.startsWith('Bearer ')?h.slice(7):'';return token.length===ADMIN_TOKEN.length&&crypto.timingSafeEqual(Buffer.from(token),Buffer.from(ADMIN_TOKEN));}
function publicQuestion(q){return {id:q.id,title:q.title,body:q.body,country:q.country,author:q.author,createdAt:q.createdAt,votes:q.votes||0,replies:(q.replies||[]).filter(r=>r.status==='approved').map(r=>({id:r.id,body:r.body,author:r.author,createdAt:r.createdAt}))};}
function affiliateTarget(slug,term){const enc=encodeURIComponent(term||'');const tag=AMAZON_TAG?`&tag=${encodeURIComponent(AMAZON_TAG)}`:'';if(slug==='amazon')return `https://www.amazon.fr/s?k=${enc}${tag}`;if(PARTNER_URLS[slug])return PARTNER_URLS[slug];const discovery={insurance:'https://www.google.com/search?q=assurance+voyage+PVT',esim:'https://www.google.com/search?q=eSIM+voyage',flights:'https://www.google.com/travel/flights',stay:'https://www.booking.com/',activities:'https://www.getyourguide.com/',car:'https://www.google.com/travel/cars'};return discovery[slug]||null;}
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,`http://${req.headers.host||'localhost'}`); const p=url.pathname;
 try {
  if(req.method==='GET'&&p==='/api/config') return json(res,200,{assistantEnabled:!!API_KEY,amazonConfigured:!!AMAZON_TAG,newsletterConfigured:!!(BREVO_API_KEY&&BREVO_LIST_ID&&BREVO_DOI_TEMPLATE_ID&&BREVO_REDIRECT_URL),adsConfigured:false,adsPending:!!ADSENSE_CLIENT_ID,partnerConfigured:Object.fromEntries(Object.entries(PARTNER_URLS).map(([k,v])=>[k,!!v]))});
  if(req.method==='GET'&&p==='/api/questions') {const db=dbRead();const qs=db.questions.filter(q=>q.status==='approved').sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt)).slice(0,100).map(publicQuestion);return json(res,200,{questions:qs});}
  if(req.method==='POST'&&p==='/api/questions') {if(!limited(req,'question',5))return json(res,429,{error:'Trop de publications. Réessaie dans quelques minutes.'});const b=await readBody(req,8000);const title=clean(b.title,120),body=clean(b.body,1600),author=clean(b.author,35)||'Voyageur anonyme',country=clean(b.country,60)||'Non précisée';if(title.length<8||body.length<15)return json(res,400,{error:'Ajoute un titre (8 caractères minimum) et un détail (15 caractères minimum).'});const db=dbRead();const q={id:id(),title,body,author,country,createdAt:new Date().toISOString(),votes:0,status:'pending',replies:[]};db.questions.unshift(q);dbWrite(db);return json(res,201,{ok:true,message:'Merci ! Ta question a été envoyée à la modération avant publication.'});}
  const replyMatch=p.match(/^\/api\/questions\/([a-f0-9]+)\/replies$/);
  if(req.method==='POST'&&replyMatch){if(!limited(req,'reply',8))return json(res,429,{error:'Trop de réponses. Réessaie plus tard.'});const b=await readBody(req,5000),body=clean(b.body,1200),author=clean(b.author,35)||'Voyageur';if(body.length<10)return json(res,400,{error:'La réponse doit contenir au moins 10 caractères.'});const db=dbRead(),q=db.questions.find(x=>x.id===replyMatch[1]&&x.status==='approved');if(!q)return json(res,404,{error:'Discussion introuvable.'});q.replies=q.replies||[];q.replies.push({id:id(),body,author,createdAt:new Date().toISOString(),status:'pending'});dbWrite(db);return json(res,201,{ok:true,message:'Réponse envoyée à la modération.'});}
  const voteMatch=p.match(/^\/api\/questions\/([a-f0-9]+)\/vote$/);
  if(req.method==='POST'&&voteMatch){if(!limited(req,'vote',20))return json(res,429,{error:'Limite de votes atteinte.'});const db=dbRead(),q=db.questions.find(x=>x.id===voteMatch[1]&&x.status==='approved');if(!q)return json(res,404,{error:'Discussion introuvable.'});q.votes=(q.votes||0)+1;dbWrite(db);return json(res,200,{votes:q.votes});}
  if(req.method==='GET'&&p==='/api/admin/pending'){if(!isAdmin(req))return json(res,401,{error:'Accès administrateur refusé. Configure ADMIN_TOKEN.'});const db=dbRead(),items=[];for(const q of db.questions){if(q.status==='pending')items.push({type:'question',questionId:q.id,id:q.id,title:q.title,body:q.body,author:q.author,country:q.country,createdAt:q.createdAt});for(const r of q.replies||[])if(r.status==='pending')items.push({type:'reply',questionId:q.id,id:r.id,title:q.title,body:r.body,author:r.author,createdAt:r.createdAt});}return json(res,200,{items});}
  if(req.method==='POST'&&p==='/api/admin/moderate'){if(!isAdmin(req))return json(res,401,{error:'Accès administrateur refusé.'});const b=await readBody(req,3000);if(!['approve','reject'].includes(b.action))return json(res,400,{error:'Action invalide.'});const db=dbRead(),q=db.questions.find(x=>x.id===b.questionId);if(!q)return json(res,404,{error:'Élément introuvable.'});const status=b.action==='approve'?'approved':'rejected';if(b.type==='reply'){const r=(q.replies||[]).find(x=>x.id===b.id);if(!r)return json(res,404,{error:'Réponse introuvable.'});r.status=status;}else q.status=status;dbWrite(db);return json(res,200,{ok:true});}
  if(req.method==='GET'&&p.startsWith('/go/')){const slug=p.slice(4);const term=clean(url.searchParams.get('q')||'',180);const target=affiliateTarget(slug,term);if(!target)return text(res,404,'Lien partenaire inconnu.');const db=dbRead();db.clicks[slug]=(db.clicks[slug]||0)+1;dbWrite(db);res.writeHead(302,{Location:target,'Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin'});return res.end();}
  if(req.method==='GET'&&p==='/api/admin/stats'){if(!isAdmin(req))return json(res,401,{error:'Accès administrateur refusé.'});const db=dbRead();return json(res,200,{clicks:db.clicks,questions:db.questions.length,approved:db.questions.filter(q=>q.status==='approved').length,pending:db.questions.filter(q=>q.status==='pending').length});}
  if(req.method==='POST'&&p==='/api/ask'){
   if(!limited(req,'ask',10))return json(res,429,{error:'Trop de questions en peu de temps. Réessaie dans une minute.'});if(!API_KEY)return json(res,503,{error:'Assistant IA non configuré : ajoute OPENAI_API_KEY sur le serveur.'});const b=await readBody(req,6000),question=clean(b.question,1500),country=clean(b.country,80)||'non précisée';if(question.length<4)return json(res,400,{error:'La question est trop courte.'});
   const instructions=`Tu es l'assistant de préparation PVT de PVT Explorer, destiné aux Français. Réponds en français, clairement et concrètement. Destination : ${country}. N'invente jamais les conditions de visa, quotas, prix, salaires, droits au travail ou URL officielles. Pour toute information administrative évolutive, demande de vérifier le site officiel de l'immigration du pays et précise que tu ne consultes pas les données en temps réel. Ne fournis pas de conseil médical, juridique ou financier personnalisé. Distingue faits vérifiables, estimations et recommandations. Signale les liens commerciaux et ne pousse jamais à acheter un produit inutile.`;
   const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,instructions,input:question,max_output_tokens:800})});const data=await r.json();if(!r.ok)return json(res,502,{error:data.error?.message||'Erreur du fournisseur IA.'});let answer=data.output_text;if(!answer&&Array.isArray(data.output))answer=data.output.flatMap(o=>o.content||[]).filter(c=>c.type==='output_text').map(c=>c.text).join('\n');return json(res,200,{answer:answer||'Je ne peux pas répondre pour le moment.'});
  }
  if(req.method==='POST'&&p==='/api/newsletter'){if(!limited(req,'newsletter',3,3600000))return json(res,429,{error:'Trop de tentatives. Réessaie plus tard.'});if(!BREVO_API_KEY||!BREVO_LIST_ID||!BREVO_DOI_TEMPLATE_ID||!BREVO_REDIRECT_URL)return json(res,503,{error:'Newsletter non configurée : le propriétaire doit renseigner les paramètres Brevo et le modèle de double confirmation.'});const b=await readBody(req,2000),email=clean(b.email,254).toLowerCase(),consent=b.consent===true;if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!consent)return json(res,400,{error:'Adresse e-mail invalide ou consentement manquant.'});const br=await fetch('https://api.brevo.com/v3/contacts/doubleOptinConfirmation',{method:'POST',headers:{'api-key':BREVO_API_KEY,'Content-Type':'application/json','accept':'application/json'},body:JSON.stringify({email,includeListIds:[BREVO_LIST_ID],templateId:BREVO_DOI_TEMPLATE_ID, redirectionUrl:BREVO_REDIRECT_URL})});if(!br.ok){const err=await br.json().catch(()=>({}));return json(res,502,{error:err.message||'Brevo n’a pas pu envoyer la confirmation.'});}return json(res,200,{ok:true,message:'Un e-mail de confirmation vient de t’être envoyé. Confirme ton inscription pour rejoindre la newsletter.'});}
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Méthode non autorisée.'});
  let pathname=decodeURIComponent(p==='/'?'/index.html':p);if(pathname.includes('..'))return json(res,400,{error:'Chemin invalide.'});const file=path.resolve(ROOT,'.'+pathname);if(!file.startsWith(ROOT+path.sep))return json(res,403,{error:'Interdit'});fs.readFile(file,(err,buf)=>{if(err)return json(res,404,{error:'Fichier introuvable.'});res.writeHead(200,{'Content-Type':MIME[path.extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin'});if(req.method==='HEAD')return res.end();res.end(buf);});
 } catch(e){if(!res.headersSent)json(res,400,{error:e.message||'Erreur de requête.'});}
});
server.listen(PORT,()=>console.log(`PVT Explorer : http://localhost:${PORT}`));
