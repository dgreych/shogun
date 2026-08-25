#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

pkg update -y
pkg install -y git nodejs-lts ffmpeg termux-tools

if [ ! -f .env.local ]; then
  cp .env.example .env.local
  chmod 600 .env.local
  echo "🔐 .env.local criado a partir de .env.example. APIs opcionais continuam desativadas."
else
  chmod 600 .env.local 2>/dev/null || true
  echo "🔐 .env.local existente preservado."
fi

node scripts/preflight-platform.mjs

GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf \
GIT_CONFIG_VALUE_0=ssh://git@github.com/ \
npm ci --no-audit --no-fund

npm run setup

node --check dados/src/.scripts/start-v9-fixed.js
node --check dados/src/connect.js

echo "SHOGUN pronto. Execute termux-wake-lock, rode 'npm run preflight' e depois 'npm start'."
