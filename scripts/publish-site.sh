#!/bin/sh
# Genera los JSON, arma la pagina y la publica en Cloudflare Pages.
set -eu
gasto publish
DIST="${DATA_DIR}/dist"
rm -rf "$DIST"
mkdir -p "$DIST"
cp -R "${SITE_DIR:-/app/dashboard/public}/." "$DIST/"
cp -R "${DATA_DIR}/published/data" "$DIST/data"
cp -R "${FUNCTIONS_DIR:-/app/dashboard/functions}" "${DATA_DIR}/functions.tmp"
cd "$DATA_DIR"
rm -rf functions && mv functions.tmp functions
wrangler pages deploy "$DIST" --project-name "${CLOUDFLARE_PAGES_PROJECT}" --branch main --commit-dirty=true
