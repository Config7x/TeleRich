#!/usr/bin/env bash
# Put one of the archived Mini App designs back on screen.
# usage: tools/switch-design.sh <commit>   (e.g. tools/switch-design.sh 1b36753)
set -euo pipefail
cd "$(dirname "$0")/.."
[ $# -eq 1 ] || { echo "usage: $0 <commit>"; exit 1; }
git checkout "$1" -- miniapp/src
npm run build >/dev/null
echo "miniapp/src restored from $1 and rebuilt; run: npx wrangler deploy"
