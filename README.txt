PVT EXPLORER — KIT DE LANCEMENT
Version 4 — application Node.js + site responsive

CONTENU
- index.html : site public (15 destinations, comparateur, forum, assistant IA, produits)
- server.js : API Node.js sans dépendances npm
- admin.html : modération et statistiques simples
- mentions-legales.html / confidentialite.html : modèles à compléter impérativement
- inscription-confirmee.html : page de confirmation Brevo
- .env.example : modèle des variables privées
- data/db.json : données locales du forum et statistiques (créé automatiquement)

LANCEMENT LOCAL
1. Installer Node.js 18 ou supérieur.
2. Copier .env.example en .env.
3. Définir au minimum ADMIN_TOKEN avec un secret long et aléatoire.
4. Dans un terminal, charger les variables du fichier .env ou les saisir dans l'environnement.
   macOS/Linux : set -a; source .env; set +a
   PowerShell : Get-Content .env | ForEach-Object { if ($_ -match '^([^#][^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') } }
5. Lancer : npm start
6. Ouvrir http://localhost:3000
7. Administration : http://localhost:3000/admin.html ; saisir ADMIN_TOKEN.

FONCTIONS ACTIVES SANS COMPTE PARTENAIRE
- Navigation, recherche, filtres et fiches destinations.
- Forum : publication, réponses et votes ; les contenus sont modérés avant affichage.
- Redirections vers des pages de découverte et comptage des clics sortants.
- Catalogue de produits avec recherche Amazon (sans commission tant qu'AMAZON_PARTNER_TAG est vide).
- Administration : modération et compteurs basiques.

CONNEXIONS OPTIONNELLES À CONFIGURER
1. Assistant IA : OPENAI_API_KEY et OPENAI_MODEL. La clé reste côté serveur.
2. Amazon : AMAZON_PARTNER_TAG uniquement après acceptation au programme Partenaires.
3. Autres affiliations : renseigner les URL exactes fournies par les programmes dans PARTNER_FLIGHTS_URL, PARTNER_STAYS_URL, PARTNER_INSURANCE_URL, PARTNER_ESIM_URL, PARTNER_ACTIVITIES_URL et PARTNER_CAR_URL. Ne pas inventer ni utiliser des liens non autorisés.
4. Newsletter Brevo : BREVO_API_KEY, BREVO_LIST_ID, BREVO_DOI_TEMPLATE_ID et BREVO_REDIRECT_URL. Créer dans Brevo une liste, un modèle de double opt-in avec lien de confirmation, et une URL de redirection. L'inscription utilise l'API doubleOptinConfirmation.
5. AdSense : ADSENSE_CLIENT_ID et identifiants de blocs après approbation du site. La diffusion publicitaire n'est volontairement PAS activée dans ce kit : il faut intégrer une CMP certifiée compatible Google, la configurer et tester le consentement avant d'ajouter les scripts publicitaires.

MISE EN LIGNE (HÉBERGEUR NODE)
- Choisir un hébergeur acceptant Node.js 18+ (par ex. Render, Railway ou VPS).
- Déployer le dossier depuis un dépôt Git privé. Commande de démarrage : npm start.
- Définir les variables .env dans le panneau sécurisé de l'hébergeur ; ne jamais envoyer .env dans Git.
- Attacher un disque persistant au dossier /data, sinon les questions et compteurs JSON peuvent être perdus lors d'un redéploiement. Pour une vraie montée en charge, migrer vers PostgreSQL.
- Ajouter le domaine et HTTPS, configurer les DNS et tester les formulaires.
- Protéger l'administration avec un ADMIN_TOKEN unique, long, non réutilisé.

AVANT OUVERTURE AU PUBLIC — BLOQUANTS
- Remplacer tous les champs [À COMPLÉTER] dans mentions-legales.html et confidentialite.html : identité de l'éditeur, adresse professionnelle, contact, hébergeur, responsable de traitement, durées, prestataires et droits.
- Vérifier les données de chaque destination et les liens officiels ; les budgets sont indicatifs et les règles de visa évoluent.
- Mettre en place une CMP adaptée avant toute publicité ou mesure non essentielle. Le site n'installe pas de cookies publicitaires à ce stade.
- Configurer le mécanisme de désinscription et vérifier le double opt-in Brevo.
- Afficher les mentions d'affiliation adéquates à proximité des liens et respecter chaque programme (notamment Amazon).
- Faire vérifier les obligations RGPD, droit de la consommation, publicité, modération et mentions légales.

LIMITES HONNÊTES
Ce projet est un kit de lancement testable, pas un service déjà hébergé. Sans domaine, hébergement, secrets API et identifiants partenaires, l'assistant IA, la newsletter et les commissions ne peuvent pas être activés. Les liens de découverte ne sont pas des liens affiliés. AdSense est désactivé par défaut.

LANCEMENT AVEC DOCKER (ALTERNATIVE)
1. Installer Docker et Docker Compose.
2. Copier .env.example en .env et remplir au minimum ADMIN_TOKEN.
3. Lancer : docker compose up -d --build
4. Ouvrir http://localhost:3000 ; administration : /admin.html.
5. Le dossier ./data est monté en volume pour conserver les questions et compteurs.
