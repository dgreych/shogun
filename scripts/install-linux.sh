#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

for command in git node npm ffmpeg; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Falta $command. Abra docs/instalacao/linux.md e instale os pré-requisitos."
    exit 1
  fi
done

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

echo "SHOGUN pronto. Rode 'npm run preflight' e depois 'npm start'."
