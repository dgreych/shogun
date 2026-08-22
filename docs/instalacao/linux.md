# Instalar o SHOGUN no Linux

## 1. Preparar o terreno

No Ubuntu ou Debian:

```bash
sudo apt update
sudo apt install -y git ffmpeg
```

Instale Node.js 22 ou 24 pelo método recomendado para sua distribuição. O piso técnico é Node.js 20.19.

Confirme:

```bash
node --version
npm --version
git --version
ffmpeg -version
```

## 2. Abrir o quartel

```bash
git clone https://github.com/dgreych/shogun.git
cd shogun
bash scripts/install-linux.sh
```

O assistente pede quatro dados básicos e grava `dados/src/config.json` somente nessa máquina.

## 3. Começar a patrulha

```bash
npm start
```

Leia o QR no WhatsApp em **Aparelhos conectados**. Depois envie `!menu`.

## 4. Voltar outro dia

```bash
cd shogun
npm start
```

Enquanto o terminal estiver aberto, o SHOGUN fica em serviço. Para servidor contínuo, consulte [DEPLOY.md](../../DEPLOY.md).
