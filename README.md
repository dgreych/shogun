<p align="center">
  <img src="assets/brand/shogun-banner.png" alt="SHOGUN diante de uma lua carmesim" width="100%">
</p>

<h1 align="center">SHOGUN</h1>

<p align="center">
  <strong>Seu sentinela no WhatsApp.</strong><br>
  Organiza grupos, encontra mídias, anima conversas e reúne ferramentas para o dia a dia.
</p>

<p align="center">
  <img alt="Node.js 20.19+" src="https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white">
  <img alt="WhatsApp" src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?logo=whatsapp&logoColor=white">
  <img alt="Windows, Linux e Termux" src="https://img.shields.io/badge/Windows%20%7C%20Linux%20%7C%20Termux-pronto-ce141a">
</p>

<p align="center">
  <a href="https://chat.whatsapp.com/Ju0zjLiBLe28eNGUu2gapY"><strong>Grupo oficial</strong></a>
  ·
  <a href="https://wa.me/5522997028553"><strong>Ajuda</strong></a>
  ·
  <a href="docs/primeiros-passos.md"><strong>Primeiros passos</strong></a>
</p>

---

## O que o SHOGUN faz

- mantém grupos organizados com ferramentas de administração e proteção;
- encontra músicas, vídeos, imagens e outros conteúdos sem tirar você da conversa;
- transforma áudios, vídeos, figurinhas e mídias do jeito que o grupo precisa;
- traz jogos, brincadeiras, perfis, economia e desafios para movimentar a comunidade;
- aceita menus, respostas e personalidade configuráveis;
- mostra o QR diretamente no terminal e guarda a sessão somente no seu aparelho.

O SHOGUN fala sério até quando a missão é criar uma figurinha. Essa é a graça.

## Escolha seu posto

Nunca usou um terminal? Comece pelo guia completo da sua plataforma. Ele mostra
onde baixar cada ferramenta, o que tocar, o que deve aparecer na tela e como
chegar ao primeiro `!menu`. Não é preciso saber programar.

| Onde vai rodar | Melhor para | Guia |
| --- | --- | --- |
| Windows 10/11 | computador pessoal e primeira instalação | [Do PowerShell ao primeiro menu](docs/instalacao/windows.md) |
| Linux | computador, mini PC ou servidor | [Do Terminal ao primeiro menu](docs/instalacao/linux.md) |
| Termux | Android dedicado ou aparelho reserva | [Do download do Termux ao bot](docs/instalacao/termux.md) |

## Instalação rápida para quem já usa terminal

Se palavras como Node.js, Git ou FFmpeg são novas para você, use os guias da
tabela acima. Os blocos abaixo são apenas o atalho para quem já tem o ambiente
preparado.

### Linux

```bash
git clone https://github.com/dgreych/shogun.git
cd shogun
bash scripts/install-linux.sh
npm start
```

### Windows PowerShell

```powershell
git clone https://github.com/dgreych/shogun.git
Set-Location shogun
powershell -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
npm start
```

### Termux

Instale o Termux pelo F-Droid ou GitHub oficial. Dentro dele:

```bash
pkg update -y
pkg install -y git
git clone https://github.com/dgreych/shogun.git
cd shogun
bash scripts/install-termux.sh
npm start
```

Para manter o Android acordado e preparar inicialização após reiniciar, siga as
etapas de bateria, Termux:API e Termux:Boot no
[guia completo do Android](docs/instalacao/termux.md).

O instalador abre um pequeno quartel de configuração. Ele pede seu nome, seu número com país e DDD, o nome do bot e o prefixo dos comandos. Nenhuma senha ou sessão é enviada ao repositório.

## Primeira patrulha

1. Execute `npm start`.
2. Escolha **QR Code** ou **código de pareamento**.
3. No WhatsApp, abra **Aparelhos conectados → Conectar um aparelho**.
4. Leia o QR exibido no terminal. No mesmo celular com Termux, prefira o código de pareamento.
5. Envie `!menu` numa conversa autorizada.

A sessão fica em `dados/database/qr-code/` e já está protegida pelo `.gitignore`. Trate essa pasta como uma chave: não compacte, não envie e não publique.

## Comandos para cuidar do posto

```bash
npm run preflight   # confere Node.js, npm, Git, FFmpeg e a plataforma
npm run setup       # abre novamente a configuração guiada
npm start           # inicia o SHOGUN
```

Para atualizar:

```bash
git pull --ff-only
npm ci --no-audit --no-fund
npm start
```

## Ajuda rápida

- QR não apareceu: aumente a janela do terminal ou use o código de pareamento.
- FFmpeg não encontrado: siga o guia da sua plataforma e repita `npm run preflight`.
- Android encerra o processo: desative a otimização de bateria do Termux e use `termux-wake-lock`.
- Mudou de pasta ou computador: execute `npm ci` novamente; nunca copie `node_modules` entre sistemas.

Veja [Solução de problemas](docs/solucao-de-problemas.md) para o passo a passo completo.

## Segurança

- use um número dedicado quando possível;
- não publique `config.json`, `.env.local` ou a pasta de sessão;
- não entregue o terminal ou o código de pareamento a terceiros;
- revise permissões administrativas antes de ativar automações em grupos reais;
- respeite as regras do WhatsApp e a privacidade das pessoas.

Leia [Segurança](docs/seguranca.md) antes de colocar o bot em uma comunidade.

## Projeto

SHOGUN é um projeto independente, criado e mantido por **Maurício Almeida**.

- [Licença ISC](LICENSE)
- [Guia de implantação em servidor](DEPLOY.md)
- [Contato](https://wa.me/5522997028553)
