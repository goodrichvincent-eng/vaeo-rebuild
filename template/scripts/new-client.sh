#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# new-client.sh — VAEO Rebuild: onboard a new Shopify client
#
# Usage:
#   ./new-client.sh <client-name> <shopify-store> <shopify-token>
#
# Example:
#   ./new-client.sh beachclub beachclub.myshopify.com shpat_xxxx
#
# What it does:
#   1. Creates clients/<client-name>/ from the Next.js template
#   2. Writes .env.local with Shopify credentials
#   3. Installs npm dependencies
#   4. Runs the Shopify extractor (pulls products, images, pages, menus)
#   5. Prints next steps
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Usage / help ──────────────────────────────────────────────────────────────

usage() {
  cat <<EOF

  VAEO Rebuild — New Client Setup

  Usage:
    ./new-client.sh <client-name> <shopify-store> <shopify-token>

  Arguments:
    client-name     Slug for the new client (e.g. beachclub, sunnyco)
                    Used as the directory name: clients/<client-name>/

    shopify-store   Shopify Admin API domain
                    e.g. mystore.myshopify.com

    shopify-token   Shopify Admin API access token
                    e.g. shpat_xxxxxxxxxxxxxxxxxxxxx
                    Get this from: Shopify Admin → Settings → Apps → Develop apps

  Example:
    ./new-client.sh beachclub beachclub.myshopify.com shpat_abc123

  What gets created:
    clients/<client-name>/
    ├── app/                   Next.js app (copied from template)
    ├── data/content.json      Extracted Shopify data
    ├── data/reviews.json      Product review metafields
    ├── public/images/         WebP-converted product images
    ├── scripts/sync.ts        Incremental sync script
    └── .env.local             Your credentials (gitignored)

EOF
  exit 1
}

# Show help if no arguments provided
if [[ $# -eq 0 ]]; then
  usage
fi

# Validate argument count
if [[ $# -lt 3 ]]; then
  echo ""
  echo "  ❌ Error: missing arguments (got $#, need 3)"
  usage
fi

# ── Setup ─────────────────────────────────────────────────────────────────────

CLIENT_NAME="$1"
SHOPIFY_STORE="$2"
SHOPIFY_TOKEN="$3"

# Validate client name (alphanumeric + hyphens only)
if ! [[ "$CLIENT_NAME" =~ ^[a-z0-9][a-z0-9-]*$ ]]; then
  echo ""
  echo "  ❌ Error: client-name must be lowercase alphanumeric with hyphens only"
  echo "     Got: '$CLIENT_NAME'"
  echo "     e.g. beachclub, sunny-co, pool-world"
  echo ""
  exit 1
fi

# Resolve script and repo root paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TEMPLATE_APP_DIR="$REPO_ROOT/clients/cococabana"   # use cococabana as the template base
CLIENT_DIR="$REPO_ROOT/clients/$CLIENT_NAME"

echo ""
echo "  🚀 VAEO Rebuild — New Client Setup"
echo "  ────────────────────────────────────"
echo "  Client:  $CLIENT_NAME"
echo "  Store:   $SHOPIFY_STORE"
echo "  Token:   ${SHOPIFY_TOKEN:0:12}…"
echo "  Output:  $CLIENT_DIR"
echo ""

# ── Step 1: Guard against overwrite ──────────────────────────────────────────

if [[ -d "$CLIENT_DIR" ]]; then
  echo "  ⚠️  Directory already exists: $CLIENT_DIR"
  read -r -p "  Overwrite? [y/N] " confirm
  if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "  Aborted."
    exit 0
  fi
  rm -rf "$CLIENT_DIR"
fi

# ── Step 2: Copy template ─────────────────────────────────────────────────────

echo "  📁 Step 1/4 — Copying template…"

mkdir -p "$CLIENT_DIR"

# Copy Next.js app structure (excluding node_modules, .next, logs, data/content.json, .env.local)
rsync -a \
  --exclude='.next/' \
  --exclude='node_modules/' \
  --exclude='.env.local' \
  --exclude='logs/*.json' \
  --exclude='data/content.json' \
  --exclude='data/reviews.json' \
  --exclude='public/images/*/'\
  "$TEMPLATE_APP_DIR/" "$CLIENT_DIR/"

# Clear any existing images (client gets fresh ones)
rm -rf "$CLIENT_DIR/public/images/"*/
mkdir -p "$CLIENT_DIR/public/images"
mkdir -p "$CLIENT_DIR/data"
mkdir -p "$CLIENT_DIR/logs"

echo "  ✓ Template copied"

# ── Step 3: Write .env.local ──────────────────────────────────────────────────

echo "  🔑 Step 2/4 — Writing credentials…"

cat > "$CLIENT_DIR/.env.local" <<ENVFILE
# Client: $CLIENT_NAME
# Created: $(date -u +"%Y-%m-%dT%H:%M:%SZ")

SHOPIFY_STORE=$SHOPIFY_STORE
SHOPIFY_TOKEN=$SHOPIFY_TOKEN
CLIENT_NAME=$CLIENT_NAME

# Generate a random SYNC_SECRET:
#   openssl rand -hex 32
SYNC_SECRET=

# Set after Vercel deployment:
VERCEL_DEPLOY_HOOK_URL=
ENVFILE

echo "  ✓ .env.local written (gitignored)"

# ── Step 4: Install dependencies ─────────────────────────────────────────────

echo "  📦 Step 3/4 — Installing dependencies…"
cd "$CLIENT_DIR"
npm install --silent
echo "  ✓ Dependencies installed"

# ── Step 5: Run extractor ─────────────────────────────────────────────────────

echo ""
echo "  🔄 Step 4/4 — Extracting Shopify data…"
echo "  (this pulls all products, images, pages, menus)"
echo ""

SHOPIFY_STORE="$SHOPIFY_STORE" \
SHOPIFY_TOKEN="$SHOPIFY_TOKEN" \
CLIENT_NAME="$CLIENT_NAME" \
npx tsx "$REPO_ROOT/template/scripts/extract.ts"

# ── Done ──────────────────────────────────────────────────────────────────────

echo ""
echo "  ✅ Client '$CLIENT_NAME' is ready!"
echo ""
echo "  Next steps:"
echo ""
echo "    1. Preview locally:"
echo "       cd clients/$CLIENT_NAME && npm run dev"
echo ""
echo "    2. Deploy to Vercel:"
echo "       cd clients/$CLIENT_NAME && vercel --prod"
echo ""
echo "    3. Set up daily sync cron:"
echo "       Add VERCEL_DEPLOY_HOOK_URL to .env.local"
echo "       The cron is already configured in vercel.json (3am UTC daily)"
echo ""
echo "    4. Keep data fresh:"
echo "       cd clients/$CLIENT_NAME && npm run sync"
echo ""
