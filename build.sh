#!/bin/bash
set -e

# Vercel Build Output API v3
mkdir -p .vercel/output/static
mkdir -p ".vercel/output/functions/api/[...path].func"
mkdir -p ".vercel/output/functions/api/go.func"

# Static files
cp -r public/* .vercel/output/static/

# API functions
cp "api/[...path].js" ".vercel/output/functions/api/[...path].func/index.js"
cp "api/go.js" ".vercel/output/functions/api/go.func/index.js"

# Function configs
echo '{"runtime":"nodejs20.x","handler":"index.js","launcherType":"Nodejs"}' > ".vercel/output/functions/api/[...path].func/.vc-config.json"
echo '{"runtime":"nodejs20.x","handler":"index.js","launcherType":"Nodejs"}' > ".vercel/output/functions/api/go.func/.vc-config.json"

# Deployment config with routing
cat > .vercel/output/config.json << 'CONF'
{
  "version": 3,
  "routes": [
    { "src": "/go/(?<slug>[^/]*)", "dest": "/api/go?slug=$slug" },
    { "src": "/admin$", "dest": "/admin.html" },
    { "handle": "filesystem" },
    { "src": "/api/(.*)", "dest": "/api/$1" }
  ]
}
CONF

echo "Build Output API structure created."
