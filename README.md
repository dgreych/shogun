# SHOGUN

[Conheça o Shogun](https://dgreych.github.io/DOMO-BJI/shogun/)

![SHOGUN](assets/brand/shogun-cat-hero.png)

O SHOGUN reúne ferramentas de grupo, figurinhas e comandos úteis no WhatsApp, com configuração local e menus que acompanham as permissões de cada pessoa.

**Instalar e rodar sua própria instância é gratuito.** Você escolhe o aparelho ou servidor. Internet, energia, hospedagem e integrações de terceiros podem ter custos próprios.

[Conheça o site](https://dgreych.github.io/DOMO-BJI/shogun/) · [Primeiros passos](docs/primeiros-passos.md) · [Contato pelo WhatsApp](https://wa.me/5522997028553)

## Instalação

Escolha seu sistema. Os guias explicam os pré-requisitos, a configuração, o pareamento e como retomar a sessão.

| Sistema | Guia | Iniciar, dentro da pasta do projeto |
| --- | --- | --- |
| Windows | [PowerShell](docs/instalacao/windows.md) | `npm start` |
| Linux | [Terminal](docs/instalacao/linux.md) | `npm start` |
| macOS | [Terminal e Homebrew](docs/instalacao/macos.md) | `npm start` |
| Android | [Termux](docs/instalacao/termux.md) | `npm start` |

O projeto requer Node.js 20.19 ou superior, npm 9 ou superior e Git. Para uma instalação nova, use Node.js 24 LTS.

**FFmpeg e FFprobe:** `npm start` prepara os executáveis compatíveis no Windows, Linux e macOS quando eles não estão instalados. No Android, execute `pkg install -y ffmpeg` no Termux. Cada guia também explica como instalar manualmente caso a preparação automática falhe.

## Iniciar a instância

```bash
npm start
```

Depois de extrair o projeto, execute `npm start` dentro da pasta. As dependências são instaladas automaticamente. Informe somente nome do bot, número do dono, número do bot e chave BunnyFy opcional. Sem chave paga, conversa e modelos continuam disponíveis; os outros serviços têm 20 chamadas por dia, controladas na API. Não altere o endereço oficial da BunnyFy.

Escolha QR ou código de pareamento quando solicitado. No WhatsApp conectado, envie `!menu` (ou o prefixo que você configurou). Comece em uma conversa ou grupo de teste.

- `npm run setup` abre a configuração local.
- `Ctrl+C` encerra o processo; `npm start` retoma a instalação.
- [Primeiros passos](docs/primeiros-passos.md) explica conexão, permissões, backup e atualização.
- [Solução de problemas](docs/solucao-de-problemas.md) ajuda a interpretar falhas comuns.

## Controle e privacidade

O menu apresenta comandos conforme as permissões reais. Comandos administrativos exigem os papéis correspondentes; o menu não concede privilégios. Só dê cargo de administrador ao bot quando entender as rotinas que pretende usar.

Sessão e configuração ficam na sua instalação. O bot se conecta ao WhatsApp, e integrações opcionais podem enviar dados aos respectivos fornecedores. Não publique arquivos de sessão, chaves, códigos de pareamento ou backups privados. O SHOGUN é independente e não é um produto oficial do WhatsApp; mudanças na plataforma podem afetar a conexão.

## Hospedagem, API e apoio

Você pode rodar por conta própria ou [conversar sobre serviços opcionais](https://wa.me/5522997028553). Disponibilidade, limites, suporte e preço são combinados no atendimento antes de qualquer contratação. Esses serviços não são requisito para acessar o código e instalar o bot.

## Licença e créditos

Distribuído sob a [licença ISC](LICENSE). Direção e manutenção: Maurício Almeida. Os créditos e avisos de autoria estão em [NOTICE](NOTICE); preserve-os ao redistribuir o projeto.
