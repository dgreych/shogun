# Instalar o SHOGUN no macOS

> **Antes de baixar o bot:** instale Node.js e Git. No primeiro `npm start`, as dependências incluem FFmpeg e FFprobe para as plataformas compatíveis; o Shogun verifica e usa esses executáveis locais. Se o download falhar ou a plataforma não tiver um binário compatível, use a instalação manual destacada abaixo.


Use um macOS suportado pelos pré-requisitos, uma conexão estável e o aplicativo Terminal. O Mac precisa permanecer ligado, conectado e com o processo ativo para o bot responder.

## 1. Preparar Git, Node.js e FFmpeg

Se ainda não tem Homebrew, siga a instalação no [site oficial](https://brew.sh/). O instalador mostra os comandos necessários para incluir o Homebrew no PATH; execute-os antes de continuar.

Instale as ferramentas:

```bash
brew install git node@24
```

O pacote `node@24` tem um caminho próprio. Para disponibilizá-lo nesta janela:

```bash
export PATH="$(brew --prefix node@24)/bin:$PATH"
```

Para persistir o caminho no shell padrão zsh, adicione a mesma linha ao seu `~/.zprofile` uma única vez:

```bash
printf '\nexport PATH="$(brew --prefix node@24)/bin:$PATH"\n' >> "$HOME/.zprofile"
```

Se prefere instalar Node.js pelo [instalador oficial](https://nodejs.org/en/download), escolha Node.js 24 LTS e instale apenas Git e FFmpeg pelo Homebrew. Não precisa manter duas instalações do Node.js.

Confirme:

```bash
git --version
node --version
npm --version
```

O mínimo do projeto é Node.js 20.19 e npm 9. Consulte os requisitos atuais do [Homebrew](https://docs.brew.sh/Installation), [Node.js 24](https://formulae.brew.sh/formula/node@24) e [FFmpeg](https://formulae.brew.sh/formula/ffmpeg) se sua versão do macOS for antiga.

### FFmpeg — instalação manual se o preparo automático falhar

No Terminal, com o Homebrew instalado:

```bash
brew install ffmpeg
```

Confira `ffmpeg -version` e `ffprobe -version`: ambos precisam mostrar a versão. Depois execute `npm start` novamente.

## 2. Baixar e iniciar

```bash
cd "$HOME"
git clone https://github.com/dgreych/shogun.git
cd shogun
npm start
```

Você também pode baixar o [ZIP do projeto](https://github.com/dgreych/shogun/archive/refs/heads/main.zip), extrair e abrir o terminal na pasta que contém `package.json`. Execute `npm start`. O primeiro início instala as dependências e abre a configuração de quatro campos; não exige executar um instalador separado.

Se a pasta já existir, entre nela. Para atualizar, preserve seus arquivos privados e siga [primeiros passos](../primeiros-passos.md).

## 3. Conectar e testar

Siga a opção de QR ou código de pareamento exibida no terminal. No WhatsApp do número do bot, abra **Aparelhos conectados** e conclua o vínculo.

Depois de conectar, envie `!menu` em uma conversa de teste. Se houver um erro, execute `npm run preflight` para conferir os requisitos e consulte [solução de problemas](../solucao-de-problemas.md).

## 4. Abrir outro dia

Pare com `Ctrl+C`. Para retomar:

```bash
cd "$HOME/shogun"
npm start
```

Se o Mac entrar em repouso, o bot pode ficar indisponível. Ajuste a energia conforme sua rotina; o instalador não modifica as preferências do macOS nem cria um serviço.

[Primeiros passos e atualização](../primeiros-passos.md) · [Solução de problemas](../solucao-de-problemas.md)

## BunnyFy e serviços opcionais

A configuração pede somente nome do bot, número do dono, número do bot e chave BunnyFy opcional. Use os números com DDI e DDD, somente dígitos; exemplo: `5522997028553`. O prefixo inicial é `!`. Para editar os quatro dados depois, execute `npm run setup`.

Conversa e escolha de modelo não gastam a franquia. Sem chave paga, downloads, transcrição, geração de imagens e demais serviços têm 20 chamadas por dia por instância. A API conta o uso e renova à meia-noite de Brasília. Uma operação pode precisar de mais de uma chamada.

Não altere `http://node1.vexhost.com.br:20056`: este é o endereço oficial já configurado. As chaves dos provedores ficam na BunnyFy. Hospedagem e assinaturas são opcionais: [atendimento](https://wa.me/5522997028553). Rodar sua própria instância é gratuito.
