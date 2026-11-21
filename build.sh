#!/bin/bash
set -e

# Vercel Build Output API v3
# Vercel pre-creates /vercel/output/builds.json (v2 format) before the build command runs.
# We delete it so our config.json (v3 format) takes effect.
# We also create the output in $PWD/.vercel/output as a fallback.
rm -f /vercel/output/builds.json

for VERCEL_OUT in "/vercel/output" "$PWD/.vercel/output"; do
  mkdir -p "$VERCEL_OUT/static"
  mkdir -p "$VERCEL_OUT/functions/api/[...path].func"
  mkdir -p "$VERCEL_OUT/functions/api/go.func"

  cp -r public/* "$VERCEL_OUT/static/"
  cp "api/[...path].js" "$VERCEL_OUT/functions/api/[...path].func/index.js"
  cp "api/go.js" "$VERCEL_OUT/functions/api/go.func/index.js"

  echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs"}' > "$VERCEL_OUT/functions/api/[...path].func/.vc-config.json"
  echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs"}' > "$VERCEL_OUT/functions/api/go.func/.vc-config.json"

  cat > "$VERCEL_OUT/config.json" << 'CONF'
{
  "version": 3,
  "routes": [
    { "src": "/go/(?<slug>[^/]*)", "dest": "/api/go?slug=$slug" },
    { "src": "/admin$", "dest": "/admin.html" },
    { "handle": "filesystem" }
  ]
}
CONF
done
