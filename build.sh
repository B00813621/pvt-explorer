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
  cp "api/blog-plan.json" "$VERCEL_OUT/functions/api/catchall.func/blog-plan.json"
  cp "api/blog-render.js" "$VERCEL_OUT/functions/api/catchall.func/blog-render.js"
  npm --prefix "$VERCEL_OUT/functions/api/catchall.func" install --production --silent
  cp "api/go.js" "$VERCEL_OUT/functions/api/go.func/index.js"

  echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs"}' > "$VERCEL_OUT/functions/api/catchall.func/.vc-config.json"
  echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs"}' > "$VERCEL_OUT/functions/api/go.func/.vc-config.json"

  cat > "$VERCEL_OUT/config.json" << 'CONF'
{
  "version": 3,
  "routes": [
    { "src": "/(.*)", "has": [{ "type": "host", "value": "www.pvt-explorer.fr" }], "status": 308, "headers": { "Location": "https://pvt-explorer.fr/$1" } },
    { "src": "/(.*)", "headers": { "X-Content-Type-Options": "nosniff", "Referrer-Policy": "strict-origin-when-cross-origin" }, "continue": true },
    { "src": "/fonts/(.*)", "headers": { "Cache-Control": "public, max-age=31536000, immutable" }, "continue": true },
    { "src": "/images/(.*)", "headers": { "Cache-Control": "public, max-age=604800" }, "continue": true },
    { "src": "/go/(?<slug>[^/]*)", "dest": "/api/go?slug=$slug" },
    { "src": "/admin$", "dest": "/admin.html" },
    { "src": "/a-propos/?$", "dest": "/a-propos.html" },
    { "src": "/nos-astuces/?$", "dest": "/api/catchall?__p=nos-astuces" },
    { "src": "/blog.html$", "status": 308, "headers": { "Location": "/nos-astuces" } },
    { "src": "/sitemap.xml", "dest": "/api/catchall?__p=sitemap.xml" },
    { "src": "/blog/([^/]+)", "dest": "/api/catchall?__p=blog/$1&__html=1" },
    { "src": "/api/(.*)", "dest": "/api/catchall?__p=$1" },
    { "handle": "filesystem" },
    { "handle": "error" },
    { "src": "/(.*)", "status": 404, "dest": "/404.html" }
  ]
}
CONF
done
