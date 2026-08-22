#!/data/data/com.termux/files/usr/bin/bash
set -euo pipefail

cd "$(dirname "$0")/.."

pkg update -y
pkg install -y git nodejs-lts ffmpeg

node scripts/preflight-platform.mjs

GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0=url.https://github.com/.insteadOf \
GIT_CONFIG_VALUE_0=ssh://git@github.com/ \
npm ci --no-audit --no-fund

npm run setup

echo "SHOGUN pronto. Use termux-wake-lock e depois npm start."
