# Instalar o 𝖘𝖍𝖔𝖌𝖚𝖓 no Android com Termux

Este guia parte de um Android limpo e acompanha exatamente o fluxo atual do repositório público. O instalador cria a configuração local, instala as dependências e deixa o bot pronto para `npm start`.

> **Tempo normal:** 15 a 35 minutos na primeira instalação. Use Wi-Fi, mantenha o aparelho carregando e reserve pelo menos 2 GB livres.

<p align="center">
  <img src="img/preflight-termux.png" alt="Verificação do ambiente no Termux" width="82%">
</p>

## 1. Instale o Termux

A fonte recomendada para a maioria das pessoas é o **F-Droid**. A versão publicada no Google Play existe novamente, mas é uma variante experimental com diferenças de compatibilidade em relação à linha tradicional do Termux.

- [Termux no F-Droid](https://f-droid.org/packages/com.termux/)
- [Releases oficiais no GitHub](https://github.com/termux/termux-app/releases)

Não misture aplicativo e plugins vindos de fontes diferentes. Eles usam assinaturas diferentes e o Android não trata isso com a delicadeza que a humanidade gostaria.

Abra o Termux após a instalação. Você verá um terminal com uma linha terminando em `$`.

## 2. Atualize os pacotes básicos

Cole este comando e aguarde até o prompt voltar:

```bash
pkg update -y && pkg upgrade -y
```

Se o Termux perguntar sobre manter ou substituir algum arquivo de configuração que você nunca alterou, pode aceitar a opção padrão pressionando **Enter**.

## 3. Baixe o SHOGUN

```bash
cd ~
git clone https://github.com/dgreych/shogun.git
cd shogun
```

> ✅ **Deu certo se:** o comando `pwd` terminar em `/shogun`.

Se aparecer `destination path 'shogun' already exists`, você já possui uma cópia. Entre nela com `cd ~/shogun` em vez de clonar outra.

## 4. Rode o instalador do próprio projeto

```bash
bash scripts/install-termux.sh
```

O script atual faz, nesta ordem:

1. atualiza o índice de pacotes do Termux;
2. instala Git, Node.js LTS, FFmpeg e as ferramentas básicas do Termux;
3. executa a verificação de plataforma;
4. instala exatamente as dependências travadas em `package-lock.json` com `npm ci`;
5. abre a configuração inicial do SHOGUN.

Durante a configuração, informe:

- seu nome;
- número do dono com país + DDD + número, somente dígitos;
- nome do bot;
- prefixo dos comandos.

A configuração é salva somente no aparelho, em `dados/src/config.json`.

## 5. Mantenha o Android acordado

Antes de iniciar o bot:

```bash
termux-wake-lock
```

Esse comando faz parte das ferramentas do próprio Termux. **Não é necessário instalar o aplicativo Termux:API somente para usar o wake lock.**

Se o comando não existir:

```bash
pkg install -y termux-tools
termux-wake-lock
```

Também vale retirar o Termux da otimização agressiva de bateria do fabricante. Androids adoram encerrar processos úteis em nome de economizar 0,4% de bateria e depois fingir surpresa.

## 6. Inicie o bot

```bash
npm start
```

Na primeira execução, o SHOGUN abre o painel de conexão real da aplicação. Ele oferece:

1. **QR Code**;
2. **código de pareamento**;
3. sair.

<p align="center">
  <img src="img/painel.png" alt="Painel de conexão do SHOGUN" width="78%">
</p>

### Opção A: QR Code

Escolha a opção de QR e, no WhatsApp do número do bot, abra **Aparelhos conectados → Conectar um aparelho**. Leia o QR exibido pelo SHOGUN.

### Opção B: código de pareamento

Escolha a opção de código. O programa usa o número configurado no setup e solicita ao WhatsApp um código de pareamento. Digite esse código no fluxo de aparelhos conectados do WhatsApp.

Quando a sessão for salva, as próximas inicializações usam a sessão existente e não pedem novo QR enquanto ela continuar válida.

## 7. Confirme que está realmente conectado

Depois da conexão, o terminal muda para o feed de execução.

<p align="center">
  <img src="img/conectado.png" alt="SHOGUN conectado" width="78%">
</p>

Envie no grupo:

```text
!menu
```

Se você escolheu outro prefixo no setup, use esse prefixo no lugar de `!`.

## Iniciar novamente depois

Sempre que fechar o Termux ou reiniciar o celular:

```bash
cd ~/shogun
termux-wake-lock
npm start
```

## Atualizar a instalação

Pare o bot com `Ctrl + C` e execute:

```bash
cd ~/shogun
git pull --ff-only
npm ci --no-audit --no-fund
npm start
```

O `npm ci` usa o lockfile público e evita que uma atualização transforme seu celular num congresso de versões aleatórias.

## Diagnóstico rápido

Se o bot não iniciar:

```bash
cd ~/shogun
npm run preflight
```

O preflight verifica a versão do Node.js, npm, Git, FFmpeg, detecta Termux e informa se configuração e dependências locais existem.

### Node.js antigo

O SHOGUN exige **Node.js 20.19.0 ou superior**. Atualize:

```bash
pkg update -y
pkg upgrade -y
pkg install -y nodejs-lts
node --version
```

### FFmpeg ausente

```bash
pkg install -y ffmpeg
ffmpeg -version
```

### `npm ci` falhou depois de uma instalação antiga

```bash
cd ~/shogun
rm -rf node_modules
npm ci --no-audit --no-fund
```

### Sessão do WhatsApp precisa ser refeita

A sessão fica em `dados/database/qr-code/`. Ela dá acesso à conta vinculada, então **não envie essa pasta para ninguém** e não a publique em GitHub, Drive ou grupos.

Só apague a sessão quando realmente quiser desvincular e parear de novo.

## O que é obrigatório e o que é opcional

Para o núcleo do bot iniciar no Termux, o caminho público exige:

- Android com Termux funcional;
- Node.js 20.19+;
- npm;
- Git;
- FFmpeg;
- conexão com o WhatsApp.

Chaves externas e integrações de IA são opcionais. Recursos que dependem de uma API externa específica só funcionam quando essa integração é configurada, mas isso não impede o SHOGUN de iniciar, conectar e executar o núcleo local.

---

[← Voltar ao README](../../README.md)
