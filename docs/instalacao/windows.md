# Instalar o SHOGUN no Windows

> **Antes de baixar o bot:** instale Node.js e Git. No primeiro `npm start`, as dependências incluem FFmpeg e FFprobe para as plataformas compatíveis; o Shogun verifica e usa esses executáveis locais. Se o download falhar ou a plataforma não tiver um binário compatível, use a instalação manual destacada abaixo.


Use Windows 10 ou 11, uma conexão estável e uma conta do WhatsApp para testar. Abra o PowerShell e execute uma etapa por vez. O computador precisa ficar ligado para o bot continuar conectado.

## 1. Preparar as ferramentas

Confira se o gerenciador de pacotes está disponível:

```powershell
winget --version
```

Instale Git e Node.js LTS:

```powershell
winget install --id Git.Git --exact --source winget
winget install --id OpenJS.NodeJS.LTS --exact --source winget
```

Se `winget` não existir, atualize o [Instalador de Aplicativo da Microsoft](https://learn.microsoft.com/windows/package-manager/winget/) ou use os instaladores oficiais de [Git](https://git-scm.com/downloads/win), [Node.js](https://nodejs.org/en/download) e [FFmpeg](https://ffmpeg.org/download.html). No caso do FFmpeg, a pasta `bin` precisa estar no PATH.

Feche o PowerShell e abra uma janela nova. Confirme:

```powershell
git --version
node --version
npm.cmd --version
```

Use Node.js 24 LTS para uma instalação nova. O mínimo aceito pelo projeto é Node.js 20.19 e npm 9. Só continue quando Git, Node.js e npm mostrarem suas versões.

### FFmpeg — instalação manual se o preparo automático falhar

FFmpeg e FFprobe são usados para áudio, vídeo e figurinhas. No PowerShell:

```powershell
winget install --id Gyan.FFmpeg --exact --source winget
```

Feche e reabra o terminal. Confira `ffmpeg -version` e `ffprobe -version`. Ambos devem mostrar a versão. Se instalar pelo site do FFmpeg, extraia o pacote e adicione a pasta `bin` ao PATH. Depois execute `npm.cmd start` novamente.

## 2. Baixar e iniciar

```powershell
Set-Location $env:USERPROFILE
git clone https://github.com/dgreych/shogun.git
Set-Location shogun
npm.cmd start
```

Você também pode baixar o [ZIP do projeto](https://github.com/dgreych/shogun/archive/refs/heads/main.zip), extrair e abrir o terminal na pasta que contém `package.json`. Execute `npm.cmd start`. O primeiro início instala as dependências e abre a configuração de quatro campos; não exige executar um instalador separado.

Se a pasta já existir, entre nela. Para atualizar, preserve seus arquivos privados e siga [primeiros passos](../primeiros-passos.md).

## 3. Conectar e testar

Siga a opção de QR ou código de pareamento exibida no terminal. No WhatsApp do número do bot, abra **Aparelhos conectados** e conclua o vínculo.

Depois de conectar, envie `!menu` em uma conversa de teste. Se houver um erro, execute `npm run preflight` para conferir os requisitos e consulte [solução de problemas](../solucao-de-problemas.md).

## 4. Retomar e atualizar

Para parar, pressione `Ctrl+C`. Para voltar:

```powershell
Set-Location "$env:USERPROFILE\shogun"
npm.cmd start
```

Para atualizar, pare o bot, faça backup privado e siga [primeiros passos](../primeiros-passos.md). Não apague a sessão para atualizar. Se o PowerShell bloquear `npm.ps1`, use `npm.cmd` como nos comandos deste guia.

[Primeiros passos](../primeiros-passos.md) · [Solução de problemas](../solucao-de-problemas.md)

## BunnyFy e serviços opcionais

A configuração pede somente nome do bot, número do dono, número do bot e chave BunnyFy opcional. Use os números com DDI e DDD, somente dígitos; exemplo: `5522997028553`. O prefixo inicial é `!`. Para editar os quatro dados depois, execute `npm run setup`.

Conversa e escolha de modelo não gastam a franquia. Sem chave paga, downloads, transcrição, geração de imagens e demais serviços têm 20 chamadas por dia por instância. A API conta o uso e renova à meia-noite de Brasília. Uma operação pode precisar de mais de uma chamada.

Não altere `http://node1.vexhost.com.br:20056`: este é o endereço oficial já configurado. As chaves dos provedores ficam na BunnyFy. Hospedagem e assinaturas são opcionais: [atendimento](https://wa.me/5522997028553). Rodar sua própria instância é gratuito.
