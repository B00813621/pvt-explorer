#!/bin/bash
set -e

# Vercel Build Output API v3
# Vercel pre-creates /vercel/output/builds.json (v2 format) before the build command runs.
# We delete it so our config.json (v3 format) takes effect.
# We also create the output in $PWD/.vercel/output as a fallback.
rm -f /vercel/output/builds.json

for VERCEL_OUT in "/vercel/output" "$PWD/.vercel/output"; do
  mkdir -p "$VERCEL_OUT/static"
  mkdir -p "$VERCEL_OUT/functions/api/catchall.func"
  mkdir -p "$VERCEL_OUT/functions/api/go.func"

  cp -r public/* "$VERCEL_OUT/static/"
  cp "api/[...path].js" "$VERCEL_OUT/functions/api/catchall.func/index.js"
  cp "api/package.json" "$VERCEL_OUT/functions/api/catchall.func/package.json"
  npm --prefix "$VERCEL_OUT/functions/api/catchall.func" install --production --silent
  cp "api/go.js" "$VERCEL_OUT/functions/api/go.func/index.js"

  echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs"}' > "$VERCEL_OUT/functions/api/catchall.func/.vc-config.json"
  echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs"}' > "$VERCEL_OUT/functions/api/go.func/.vc-config.json"

  cat > "$VERCEL_OUT/config.json" << 'CONF'
{
  "version": 3,
  "routes": [
    { "src": "/go/(?<slug>[^/]*)", "dest": "/api/go?slug=$slug" },
    { "src": "/admin$", "dest": "/admin.html" },
    { "src": "/nos-astuces$", "dest": "/blog.html" },
    { "src": "/blog/([^/]+)", "dest": "/api/catchall?__p=blog/$1" },
    { "src": "/api/(.*)", "dest": "/api/catchall?__p=$1" },
    { "handle": "filesystem" }
  ]
}
CONF
done
