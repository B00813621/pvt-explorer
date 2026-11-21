#!/bin/bash
set -e

echo "=== Build starting, CWD: $(pwd) ==="
echo "=== Contents of /vercel: $(ls /vercel/ 2>/dev/null || echo 'not found') ==="

# Try to understand the right path
VERCEL_OUT=/vercel/output
echo "=== Creating output at $VERCEL_OUT ==="

mkdir -p "$VERCEL_OUT/static"
mkdir -p "$VERCEL_OUT/functions/api/[...path].func"
mkdir -p "$VERCEL_OUT/functions/api/go.func"

# Static files
cp -r public/* "$VERCEL_OUT/static/"
echo "=== Static files: $(ls $VERCEL_OUT/static/) ==="

# API functions
cp "api/[...path].js" "$VERCEL_OUT/functions/api/[...path].func/index.js"
cp "api/go.js" "$VERCEL_OUT/functions/api/go.func/index.js"

# Function configs
echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs"}' > "$VERCEL_OUT/functions/api/[...path].func/.vc-config.json"
echo '{"runtime":"nodejs22.x","handler":"index.js","launcherType":"Nodejs"}' > "$VERCEL_OUT/functions/api/go.func/.vc-config.json"

# Deployment config
cat > "$VERCEL_OUT/config.json" << 'CONF'
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

echo "=== Output structure: $(find $VERCEL_OUT -type f) ==="
echo "=== Build complete ==="
