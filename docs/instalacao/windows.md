# Instalar o SHOGUN no Windows

## 1. Preparar o terreno

Instale:

- Git para Windows;
- Node.js 22 ou 24 LTS;
- FFmpeg e adicione a pasta `bin` ao PATH.

Abra um PowerShell novo e confira:

```powershell
node --version
npm --version
git --version
ffmpeg -version
```

## 2. Abrir o quartel

```powershell
git clone https://github.com/dgreych/shogun.git
Set-Location shogun
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

O assistente pede quatro dados básicos. O arquivo criado em `dados\src\config.json` fica apenas no computador.

## 3. Começar a patrulha

```powershell
npm start
```

Leia o QR em **WhatsApp → Aparelhos conectados**. Depois envie `!menu`.

## 4. Voltar outro dia

```powershell
Set-Location caminho\para\shogun
npm start
```

Não mova apenas a pasta `node_modules` para outro computador. Ao mudar de máquina, clone de novo e execute o instalador.
