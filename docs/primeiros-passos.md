# Primeiros passos com o SHOGUN

Depois de seguir o guia do seu sistema, confira a instalação dentro da pasta `shogun`:

```bash
npm run preflight
```

Resolva os erros obrigatórios antes de iniciar. Avisos sobre serviços opcionais não configurados podem ser esperados. No PowerShell, use `npm.cmd` se a política bloquear `npm.ps1`.

## Configuração e conexão

```bash
npm start
```

O primeiro início instala as dependências e pede nome do bot, número do dono, número do bot e chave BunnyFy opcional. O prefixo inicial é `!`. Conversa e escolha de modelo estão disponíveis sem chave paga. Downloads, transcrição, geração de imagens e outros serviços usam a franquia de 20 chamadas diárias da instância, controlada dentro da BunnyFy e renovada à meia-noite de Brasília. Uma operação pode usar mais de uma chamada, por exemplo para enviar e processar uma mídia.

Não altere `http://node1.vexhost.com.br:20056`: esse é o endereço oficial configurado nas instâncias. Chaves dos provedores ficam no servidor da BunnyFy. Para ampliar a franquia, entre em contato pelo [WhatsApp](https://wa.me/5522997028553).

Na primeira conexão, escolha QR ou código de pareamento. Abra **Aparelhos conectados** no WhatsApp e siga a opção escolhida. No mesmo celular do Termux, o código é mais prático que o QR.

A sessão salva será reutilizada no próximo início. Não compartilhe a pasta de sessão, seu código de pareamento ou capturas com credenciais.

## Seu primeiro teste

Envie numa conversa ou grupo de teste:

```text
!menu
```

Se mudou o prefixo, use o novo. Confira se o bot está conectado e responde. O menu acompanha suas permissões; ver um comando não concede privilégios. Comandos administrativos exigem os papéis correspondentes.

Teste uma ferramenta simples e uma figurinha. Só dê cargo de administrador ao bot depois de entender as rotinas de grupo que pretende usar. A instalação completa inclui esse teste real no WhatsApp, além do diagnóstico local.

## Parar e retomar

`Ctrl+C` para o processo. Na próxima vez, abra o terminal na pasta `shogun` e execute:

```bash
npm start
```

O aparelho precisa permanecer ligado e conectado. O instalador não configura automaticamente um serviço do sistema. No Android, siga os cuidados de bateria do [guia do Termux](instalacao/termux.md).

## Backup privado antes de atualizar

Pare o bot e copie a instalação para uma pasta privada fora do repositório, ou faça um backup privado que inclua suas configurações, dados e sessão. Não envie esse backup para o GitHub, grupos ou atendimento. Guarde-o com acesso restrito.

Preserve especialmente `.env.local`, os arquivos locais de configuração e `dados/database/`, inclusive `dados/database/qr-code/`. Não restaure dados antigos sobre uma instância ativa sem verificar o que será substituído.

## Atualização

Na pasta do projeto, com o processo parado e o backup feito:

```bash
git pull --ff-only
```

Se o Git acusar alterações locais ou divergência, pare e revise o aviso. Não use reset forçado para resolver sem entender o que será perdido. Após atualizar, execute novamente o instalador do seu sistema; ele reinstala as dependências com o transporte HTTPS necessário para dependências públicas do GitHub e reabre a configuração.

```bash
npm run preflight
npm start
```

Confirme novamente a resposta ao menu no WhatsApp. Atualizar o código não exige apagar a sessão.

## Dados e serviços externos

A configuração e a sessão ficam na sua instalação. O bot se comunica com o WhatsApp; serviços que você ativa podem receber dados conforme suas funções. Leia as condições de cada fornecedor. Rodar uma instância própria é gratuito, mas infraestrutura e integrações podem gerar custos.

[Solução de problemas](solucao-de-problemas.md) · [Contato](https://wa.me/5522997028553)
