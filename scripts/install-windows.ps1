$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

foreach ($command in @("git", "node", "npm", "ffmpeg")) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
    throw "Falta $command. Abra docs/instalacao/windows.md e instale os pré-requisitos."
  }
}

node scripts/preflight-platform.mjs

$previousGitConfigCount = $env:GIT_CONFIG_COUNT
$previousGitConfigKey = $env:GIT_CONFIG_KEY_0
$previousGitConfigValue = $env:GIT_CONFIG_VALUE_0
try {
  $env:GIT_CONFIG_COUNT = "1"
  $env:GIT_CONFIG_KEY_0 = "url.https://github.com/.insteadOf"
  $env:GIT_CONFIG_VALUE_0 = "ssh://git@github.com/"
  npm ci --no-audit --no-fund
  npm run setup
}
finally {
  $env:GIT_CONFIG_COUNT = $previousGitConfigCount
  $env:GIT_CONFIG_KEY_0 = $previousGitConfigKey
  $env:GIT_CONFIG_VALUE_0 = $previousGitConfigValue
}

Write-Host "SHOGUN pronto. Inicie com: npm start" -ForegroundColor Green
