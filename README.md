<p align="center">
  <img src="assets/nazuna-gyomei-banner.png" alt="Nazuna Gyomei" width="100%">
</p>

<h1 align="center">Nazuna Gyomei</h1>

<p align="center">
  <strong>Assistente para WhatsApp com gestão de grupos, automações, utilidades e personalidade configurável.</strong>
</p>

<p align="center">
  <a href="https://github.com/dgreych/_Nazuna_bot_vs.Gyomei_/actions/workflows/gyomei-validate.yml"><img alt="Validação" src="https://img.shields.io/github/actions/workflow/status/dgreych/_Nazuna_bot_vs.Gyomei_/gyomei-validate.yml?branch=main&label=build"></a>
  <img alt="Node.js" src="https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white">
  <img alt="WhatsApp" src="https://img.shields.io/badge/WhatsApp-Baileys-25D366?logo=whatsapp&logoColor=white">
  <img alt="Edição" src="https://img.shields.io/badge/edição-GYOMEI-7D3CFF">
</p>

<p align="center">
  <a href="https://chat.whatsapp.com/Ju0zjLiBLe28eNGUu2gapY"><strong>Grupo oficial</strong></a>
  ·
  <a href="https://wa.me/5522997028553"><strong>Contato</strong></a>
  ·
  <a href="DEPLOY.md"><strong>Deploy</strong></a>
</p>

---

## O projeto

A **NAZUNA BOT - versão modificada GYOMEI** preserva a base da Nazuna 9.0 e acrescenta correções de execução, novos comandos, automações administrativas, personalização e um fluxo de deploy reproduzível.

**GYOMEI** é o nome desta edição modificada e da personalidade principal da assistente. A origem da Nazuna e seus autores permanecem creditados no repositório e no comando `!criador`.

### Estado atual

- integração NVIDIA validada em chamada real;
- modelo `meta/llama-3.1-70b-instruct` definido diretamente na fonte;
- endpoint `https://integrate.api.nvidia.com/v1/chat/completions`;
- teste isolado da API e teste do fluxo completo da assistente;
- aliases oficiais protegidos, incluindo `d`, `del`, `delete` e `deletar`;
- resposta a mensagens citadas e mídias temporárias tratadas pelo comando de apagar;
- `setmidia` corrigido para imagem, vídeo e GIF;
- formatos antigos de comandos VIP normalizados;
- build de servidor sem pasta-mãe e com auditoria de segredos.

## Recursos principais

### Assistente GYOMEI

- respostas naturais por menção ou resposta direta ao bot;
- personalidade protegida e prompt adicional configurável;
- contexto por usuário e histórico curto de conversa;
- fallback seguro quando o modelo devolve texto em vez de JSON;
- diagnóstico explícito para erros de autenticação, acesso, limite e indisponibilidade da NVIDIA.

### Gestão de grupos

- comandos administrativos;
- donos adicionais;
- configurações e antis por grupo;
- recuperação de mensagens apagadas;
- transcrição manual e automática de áudios;
- mídia personalizada para menus e comandos;
- sugestões visuais para comandos digitados incorretamente.

### Deploy controlado

- validação local, pública e de deploy;
- auditoria contra chaves e sessões incluídas por engano;
- artefato público higienizado;
- build privada capaz de preservar configurações locais selecionadas;
- ZIP root-ready, sem diretório externo envolvendo o projeto.

## Requisitos

- Node.js 20 ou superior;
- npm 9 ou superior;
- Git;
- FFmpeg para recursos de áudio e vídeo;
- número de WhatsApp dedicado ao bot;
- chave NVIDIA para a assistente;
- chave VEX para transcrição, quando o recurso for utilizado.

## Instalação rápida

### Linux

```bash
git clone https://github.com/dgreych/_Nazuna_bot_vs.Gyomei_.git
cd _Nazuna_bot_vs.Gyomei_
cp -n .env.example .env.local
chmod 600 .env.local
npm ci
npm start
```

### Windows PowerShell

```powershell
git clone https://github.com/dgreych/_Nazuna_bot_vs.Gyomei_.git
cd _Nazuna_bot_vs.Gyomei_
Copy-Item .env.example .env.local
npm ci
npm start
```

### Termux

```bash
pkg update -y
pkg install git nodejs-lts ffmpeg -y
git clone https://github.com/dgreych/_Nazuna_bot_vs.Gyomei_.git
cd _Nazuna_bot_vs.Gyomei_
cp -n .env.example .env.local
npm ci
npm start
```

> Execute os comandos dentro da pasta do projeto. O npm precisa encontrar `package.json` e `package-lock.json`, detalhe aparentemente pequeno até ele produzir três páginas de protesto.

## Configuração

Copie o arquivo de ambiente e preencha apenas na máquina ou no servidor:

```env
NVIDIA_API_KEY=SUA_CHAVE_NVIDIA
VEX_API_KEY=SUA_CHAVE_VEX
VEX_SITE=https://vexapi.com.br
```

A variável `NVIDIA_API_KEY` tem prioridade sobre o campo legado `nvidia_api_key` do `config.json`.

Complete também as configurações locais em:

```text
dados/src/config.json
```

Nunca publique:

- `.env.local`;
- sessão em `dados/database/qr-code/`;
- chaves de API;
- bancos pessoais, caches e arquivos de grupos reais;
- números administrativos privados.

## Testes da IA

Carregue a chave apenas na sessão atual do terminal:

```bash
read -rsp "NVIDIA_API_KEY: " NVIDIA_API_KEY
echo
export NVIDIA_API_KEY
```

Teste o endpoint, a chave e o modelo:

```bash
npm run test:nvidia:live
```

Teste o fluxo completo da assistente, incluindo prompt, contexto, chamada NVIDIA e parser:

```bash
npm run test:assistant:live
```

Remova a variável ao terminar:

```bash
unset NVIDIA_API_KEY
```

## Validação do projeto

```bash
npm run validate:ci
npm run validate:public
npm run validate:local
npm run validate:deploy
```

Para validar antes de iniciar:

```bash
npm run start:validated
```

## Comandos adicionados ou corrigidos

### Apagar mensagem citada

```text
!d
!del
!delete
!deletar
```

O bot precisa ser administrador do grupo. O usuário deve responder à mensagem que será apagada.

### Transcrição

```text
!t
!transc
!transcrever
!autotr
!autotransc
```

### Recuperar mensagens apagadas

```text
!return1
!return2
!return3
!return4
!return5
```

Também é aceita a forma `!return 1`.

### Mídias personalizadas

```text
!menumidia
!setmidia menu
!setmidia menubn
!setmidia comando
!delmidia comando
```

Use `setmidia` respondendo a uma imagem, vídeo ou GIF.

### Donos adicionais

```text
!adddono 55DDDNUMERO
!deldono 55DDDNUMERO
!listdonos
```

### Prompts da assistente

```text
!prompts
!verprompt gyomei
!setprompt gyomei SEU TEXTO
!resetprompt gyomei
```

As instruções personalizadas complementam o prompt protegido. Elas não substituem identidade, regras de segurança ou contrato de resposta.

## Build para servidor

### Artefato público higienizado

```bash
npm run build:server:artifact
```

Arquivos gerados:

```text
dist/nazuna-gyomei-server-v1.0.0/
dist/nazuna-gyomei-server-v1.0.0-root.zip
dist/nazuna-gyomei-server-v1.0.0-root.tar.gz
```

O ZIP começa diretamente com:

```text
package.json
package-lock.json
dados/
node_modules/
deploy/
```

Não existe uma pasta-mãe envolvendo o projeto. O arquivo pode ser extraído diretamente na raiz do contêiner.

### Build privada

```bash
npm run build:server
```

A build privada pode transportar, por lista controlada:

- `config.json` e `.env.local` locais;
- design, áudio e opções de menu;
- prompts e donos adicionais;
- mídias vinculadas a comandos;
- configurações de antis e automações.

Sessão do WhatsApp, logs, caches e históricos pessoais continuam excluídos por padrão.

Leia [DEPLOY.md](DEPLOY.md) antes de substituir uma instalação em produção.

## Créditos

### Criação original

**Hiudy (Hiduy)**

- [WhatsApp](https://wa.me/553391967445)
- [GitHub](https://github.com/hiudyy)
- [Instagram](https://instagram.com/hiudyyy_)

### Continuidade da Nazuna

**DevTokyo**

- [WhatsApp](https://wa.me/5532985076326)
- [GitHub](https://github.com/DevTokyoVx)
- [Repositório original](https://github.com/DevTokyoVx/nazuna)

### Versão modificada GYOMEI

**Alaska_dev / Maurício Almeida**

- correções e compatibilidade;
- personalidade e integração da assistente;
- comandos e automações;
- validações e empacotamento;
- documentação e deploy.

- [WhatsApp](https://wa.me/5522997028553)
- [Repositório desta versão](https://github.com/dgreych/_Nazuna_bot_vs.Gyomei_)

## Hospedagem

<a href="https://wa.me/5522997028553?text=Ol%C3%A1%21%20Tenho%20interesse%20em%20hospedar%20a%20NAZUNA%20BOT%20-%20vers%C3%A3o%20GYOMEI.%20Pode%20me%20passar%20os%20detalhes%3F">
  <img src="assets/hospedagem-gyomei.svg" alt="Hospedagem da NAZUNA BOT GYOMEI" width="100%">
</a>

Atendimento a partir de **R$ 16,99/mês**.

## Direção futura

Downloads e outras funcionalidades externas estão migrando gradualmente para
a API própria BunnyFy, substituindo integrações herdadas e serviços de
terceiros. Integrações funcionais não são removidas antes de uma substituição
validada.

## Responsabilidade

Respeite a licença e os créditos do projeto original. Não utilize o bot para spam, invasão de privacidade, golpes ou outras atividades prejudiciais.
