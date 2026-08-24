#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

pkg update -y
pkg install -y git nodejs-lts ffmpeg termux-tools

node scripts/preflight-platform.mjs

GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf \
GIT_CONFIG_VALUE_0=ssh://git@github.com/ \
npm ci --no-audit --no-fund

npm run setup

node --check dados/src/.scripts/start-v9-fixed.js
node --check dados/src/connect.js

echo "SHOGUN pronto. Execute termux-wake-lock e depois npm start."
