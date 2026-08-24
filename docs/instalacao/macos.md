# Instalar o 𝖘𝖍𝖔𝖌𝖚𝖓 no macOS

O fluxo público do SHOGUN também é validado para macOS. O requisito é Node.js 20.19 ou superior, Git e FFmpeg.

## 1. Instale os requisitos

Se você usa Homebrew:

```bash
brew update
brew install node git ffmpeg
```

Confirme:

```bash
node --version
git --version
ffmpeg -version
```

## 2. Clone o repositório público

```bash
cd ~
git clone https://github.com/dgreych/shogun.git
cd shogun
```

## 3. Execute o instalador

```bash
bash scripts/install-macos.sh
```

Ele executa o preflight, instala as dependências exatamente pelo `package-lock.json`, abre o setup e verifica as entradas principais do runtime.

## 4. Inicie

```bash
npm start
```

O painel oferece QR Code ou código de pareamento. Depois que a sessão for criada, as próximas inicializações reutilizam a sessão enquanto ela permanecer válida.

## Atualizar

```bash
cd ~/shogun
git pull --ff-only
npm ci --no-audit --no-fund
npm start
```

## Diagnóstico

```bash
npm run preflight
```

A sessão do WhatsApp fica em `dados/database/qr-code/`. Não publique nem compartilhe essa pasta.

---

[← Voltar ao README](../../README.md)
