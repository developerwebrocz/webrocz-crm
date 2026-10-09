#!/bin/sh
# Deploys the latest code from GitHub on the server WITHOUT taking the running site down.
#
#   sh scripts/deploy.sh
#
# What was wrong with the old one-line deploy (rm -rf .next && npm run build && pm2 restart):
#   1. `.next` was deleted first, so for the 2-3 minutes of the build everyone using the CRM got
#      "page not found" / errors.
#   2. Deleting `.next` also threw away the key Next.js uses to name server actions, so every
#      deploy renamed them all and every page that was already open failed on its next click
#      with "Server Action ... was not found on the server".
#
# This script:
#   - builds into a separate folder (.next-build) while the old build keeps serving,
#   - swaps the folders only when the build has succeeded (a failed build changes nothing),
#   - keeps one fixed server-action key in .env, so open pages keep working after a deploy.
set -e
cd "$(dirname "$0")/.."

echo "== 1/6 code"
git fetch origin
git reset --hard origin/main

echo "== 2/6 packages"
npm install --no-audit --no-fund

echo "== 3/6 database"
npx prisma db push

echo "== 4/6 server-action key"
# One permanent key (32 random bytes, base64). Written once to the server's .env — never in git.
if ! grep -q '^NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=' .env 2>/dev/null; then
  printf '\nNEXT_SERVER_ACTIONS_ENCRYPTION_KEY=%s\n' "$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" >> .env
  echo "   key created"
else
  echo "   key already set"
fi

echo "== 5/6 build (the site stays up on the old build)"
rm -rf .next-build
NEXT_DIST_DIR=.next-build npm run build

echo "== 6/6 switch to the new build"
rm -rf .next-old
[ -d .next ] && mv .next .next-old
mv .next-build .next
pm2 restart webrocz-crm
rm -rf .next-old

echo DEPLOY_DONE
