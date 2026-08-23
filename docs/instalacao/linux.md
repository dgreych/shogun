# SHOGUN no Linux: do terminal ao primeiro menu

Este guia atende computadores e servidores Linux. Se é sua primeira vez,
Ubuntu ou Debian oferecem o caminho mais simples. Reserve cerca de 20 minutos.

## Etapa 1 — abrir o Terminal

No Ubuntu, pressione `Ctrl+Alt+T`. Em outras distribuições, procure o aplicativo
**Terminal** no menu. Copie uma caixa por vez, cole com `Ctrl+Shift+V` e
pressione Enter.

## Etapa 2 — instalar Git e FFmpeg

Use somente o bloco da sua distribuição.

### Ubuntu, Debian, Linux Mint e derivados

```bash
sudo apt update
sudo apt install -y git ffmpeg curl
```

### Fedora

```bash
sudo dnf install -y git ffmpeg curl
```

### Arch Linux e derivados

```bash
sudo pacman -Syu --needed git ffmpeg curl
```

Quando `sudo` pedir a senha, digite mesmo que nenhum caractere apareça e
pressione Enter. Isso é uma proteção normal do Linux.

## Etapa 3 — instalar Node.js LTS

O SHOGUN exige Node.js 20.19 ou mais recente e recomenda a linha LTS 22 ou 24.
Se sua distribuição já oferece uma dessas versões, instale `nodejs` e `npm`
pelo gerenciador de pacotes dela. Caso contrário, siga o método mostrado na
página oficial [Baixar Node.js](https://nodejs.org/en/download).

Não use Node.js 18. Depois de instalar, feche e abra o Terminal.

## Etapa 4 — conferir o terreno

Rode um por vez:

```bash
node --version
```

```bash
npm --version
```

```bash
git --version
```

```bash
ffmpeg -version
```

Cada comando deve mostrar uma versão. Para Node.js, espere algo como `v22...`
ou `v24...`.

## Etapa 5 — baixar o SHOGUN

Volte à sua pasta pessoal:

```bash
cd
```

Baixe o projeto:

```bash
git clone https://github.com/dgreych/shogun.git
```

Entre na pasta:

```bash
cd shogun
```

## Etapa 6 — preparar e configurar

```bash
bash scripts/install-linux.sh
```

O instalador baixa os componentes e faz quatro perguntas:

1. como o SHOGUN deve chamar você;
2. seu número com país e DDD, somente dígitos — exemplo fictício
   `5511999999999`;
3. nome do bot — pressione Enter para manter `SHOGUN`;
4. prefixo — pressione Enter para manter `!`.

Quando aparecer **SHOGUN pronto**, a configuração local está protegida e a
instalação terminou. Para refazer apenas as perguntas:

```bash
npm run setup
```

## Etapa 7 — inspeção e conexão

```bash
npm run preflight
```

Com os itens obrigatórios aprovados, inicie:

```bash
npm start
```

Escolha `1` para QR Code. No telefone, abra WhatsApp → menu de três pontos →
**Aparelhos conectados/Dispositivos conectados → Conectar um aparelho** e leia
o QR do terminal.

Se o WhatsApp estiver no mesmo equipamento ou o QR não couber, reinicie com
`Ctrl+C`, escolha `2` e use o código de pareamento.

## Etapa 8 — confirmar a primeira missão

Numa conversa de teste, envie:

```text
!menu
```

Se o menu chegou, o posto está pronto. O Terminal precisa permanecer aberto
enquanto o SHOGUN estiver em serviço.

## Sua rotina

Para parar, pressione `Ctrl+C`.

Para voltar outro dia:

```bash
cd ~/shogun
```

```bash
npm start
```

Para atualizar, pare o processo e rode:

```bash
git pull --ff-only
```

```bash
npm ci --no-audit --no-fund
```

```bash
npm start
```

## Servidor ligado continuamente

Primeiro conclua a instalação manual e confirme `!menu`. Depois consulte
[Implantação em servidor](../../DEPLOY.md) para manter o processo supervisionado.
Não publique a pasta de sessão nem o arquivo de configuração ao mover o bot.

## Socorro rápido

- **`sudo: command not found`:** sua distribuição usa outro método de
  administração; consulte a documentação dela ou peça ao administrador para
  instalar Git, Node.js e FFmpeg.
- **Node mostra `v18`:** atualize para Node.js 22 ou 24 e reabra o Terminal.
- **Permissão negada no instalador:** rode com `bash scripts/install-linux.sh`,
  exatamente como na etapa 6.
- **A pasta `shogun` já existe:** use `cd ~/shogun`; não clone por cima.
- **Ainda não funcionou:** rode `npm run preflight` e consulte
  [solução de problemas](../solucao-de-problemas.md).
