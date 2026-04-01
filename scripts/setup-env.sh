#!/bin/bash
# Run this once after cloning: bash scripts/setup-convex-env.sh

set -e

echo "Setting Convex environment variables..."
echo "You'll need: BETTER_AUTH_SECRET, SITE_URL, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET"
echo ""

read -p "SITE_URL (default: http://localhost:5173): " SITE_URL
SITE_URL=${SITE_URL:-http://localhost:5173}

read -p "GITHUB_CLIENT_ID: " GITHUB_CLIENT_ID
read -s -p "GITHUB_CLIENT_SECRET: " GITHUB_CLIENT_SECRET
echo ""

BETTER_AUTH_SECRET=$(openssl rand -base64 32)

npx convex env set BETTER_AUTH_SECRET "$BETTER_AUTH_SECRET"
npx convex env set SITE_URL "$SITE_URL"
npx convex env set GITHUB_CLIENT_ID "$GITHUB_CLIENT_ID"
npx convex env set GITHUB_CLIENT_SECRET "$GITHUB_CLIENT_SECRET"

echo ""
echo "Done! All Convex env vars are set."