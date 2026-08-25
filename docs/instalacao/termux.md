<h1 align="center">📱 SHOGUN no Android</h1>
<p align="center"><strong>Instalação pelo Termux, do zero ao primeiro <code>!menu</code>.</strong></p>

<p align="center">
  <img alt="Android" src="https://img.shields.io/badge/Android-Termux-101010?logo=android&logoColor=white">
  <img alt="Node 20.19+" src="https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white">
  <img alt="Tempo" src="https://img.shields.io/badge/primeira%20instala%C3%A7%C3%A3o-15%E2%80%9335%20min-6b2637">
</p>

> [!TIP]
> Faça a primeira instalação no Wi‑Fi, com o aparelho carregando e pelo menos **2 GB livres**. O bot não exige Termux:API para manter o wake lock.

<p align="center">
  <img src="img/preflight-termux.png" alt="Preflight do SHOGUN no Termux" width="86%">
</p>

## Rota completa

| Etapa | O que acontece | Você sabe que deu certo quando… |
| --- | --- | --- |
| **1** | instalar o Termux | aparece o terminal com `$` |
| **2** | atualizar pacotes | o prompt volta sem erro |
| **3** | clonar o SHOGUN | `pwd` termina em `/shogun` |
| **4** | rodar o instalador | aparece a configuração do bot |
| **5** | manter o processo acordado | `termux-wake-lock` não retorna erro |
| **6** | conectar o WhatsApp | o feed do SHOGUN começa a rodar |
| **7** | testar | `!menu` recebe resposta |

---

## 1 · Instale o Termux

Use preferencialmente uma das fontes oficiais da linha tradicional:

- **[F-Droid](https://f-droid.org/packages/com.termux/)**
- **[GitHub Releases](https://github.com/termux/termux-app/releases)**

> [!IMPORTANT]
> A edição do Google Play segue uma linha diferente e ainda pode variar em compatibilidade. Também não misture o aplicativo principal e plugins baixados de fontes diferentes, porque as assinaturas não combinam.

Abra o Termux. Se você vê uma linha terminando em `$`, está no lugar certo. É só um terminal. Ele parece hostil porque terminais foram desenhados antes de alguém descobrir bordas arredondadas.

---

## 2 · Atualize o ambiente

```bash
pkg update -y && pkg upgrade -y
```

**O que isso faz:** atualiza a lista de pacotes e instala as versões mais recentes disponíveis para o seu Termux.

Se surgir uma pergunta sobre arquivo de configuração que você nunca alterou, a opção padrão costuma ser suficiente: pressione **Enter**.

---

## 3 · Baixe o SHOGUN

```bash
cd ~
git clone https://github.com/dgreych/shogun.git
cd shogun
```

Confira onde está:

```bash
pwd
```

> [!NOTE]
> Se aparecer `destination path 'shogun' already exists`, não clone de novo. Use `cd ~/shogun`.

---

## 4 · Deixe o projeto preparar o aparelho

```bash
bash scripts/install-termux.sh
```

O instalador do repositório faz a parte tediosa em ordem previsível:

1. atualiza o índice do Termux;
2. instala **Git, Node.js LTS, FFmpeg e termux-tools**;
3. cria `.env.local` a partir de `.env.example` se ainda não existir;
4. executa o preflight da plataforma;
5. instala as dependências travadas em `package-lock.json` com `npm ci`;
6. abre a configuração inicial.

Um `.env.local` existente é preservado. APIs opcionais começam desligadas.

### O setup pergunta

<table>
<tr><td><strong>Seu nome</strong></td><td>como o bot identifica o dono principal desta instância</td></tr>
<tr><td><strong>Seu número</strong></td><td>país + DDD + número do dono principal, somente dígitos</td></tr>
<tr><td><strong>Nome do bot</strong></td><td>o nome exibido pela instalação</td></tr>
<tr><td><strong>Prefixo</strong></td><td>por exemplo <code>!</code></td></tr>
</table>

A configuração é gravada localmente em `dados/src/config.json`.

### Quem é o dono principal?

```text
projeto SHOGUN
    └── sua instalação no Android
        ├── dono principal -> numerodono
        ├── sessão WhatsApp
        └── grupos -> administradores próprios
```

O número do setup controla **esta cópia do bot** e seus comandos de dono. Isso
não muda os créditos/autoria do projeto e não é a mesma coisa que ser
administrador de um grupo.

Veja **[Configuração da sua instância](../configuracao-da-instancia.md)** para
entender APIs e credenciais antes de preencher qualquer chave.

---

## 5 · Impeça o Android de dormir em cima do bot

```bash
termux-wake-lock
```

O wake lock vem de `termux-tools`. **Não é necessário instalar o aplicativo Termux:API só para isso.**

Se o comando estiver ausente:

```bash
pkg install -y termux-tools
termux-wake-lock
```

Também retire o Termux da otimização agressiva de bateria do fabricante. Android adora matar exatamente o processo que você queria manter vivo e chamar isso de otimização.

---

## 6 · Verifique e conecte

Antes do boot:

```bash
npm run preflight
```

O diagnóstico verifica sistema, configuração, dono principal e integrações sem
imprimir tokens. Avisos sobre APIs opcionais não impedem o núcleo quando você
não usa aqueles recursos.

Depois:

```bash
npm start
```

O painel real da aplicação oferece:

- **QR Code**;
- **código de pareamento**;
- sair.

<p align="center">
  <img src="img/painel.png" alt="Painel de conexão do SHOGUN" width="82%">
</p>

### QR Code

No WhatsApp do número que será usado pelo bot, abra **Aparelhos conectados → Conectar um aparelho** e leia o QR mostrado no Termux.

### Código de pareamento

Escolha a opção correspondente. O SHOGUN usa o número salvo no setup e pede ao WhatsApp um código para ser informado no fluxo de aparelhos conectados.

> [!TIP]
> Depois que a sessão é criada, inicializações futuras reutilizam essa sessão enquanto ela permanecer válida. Novo QR em todo boot não é comportamento normal.

---

## 7 · Faça o teste que importa

Quando o feed aparecer:

<p align="center">
  <img src="img/conectado.png" alt="SHOGUN conectado no Termux" width="82%">
</p>

Envie em um grupo de teste:

```text
!menu
```

Se escolheu outro prefixo, troque `!` por ele.

**Recebeu resposta?** Instalação, conexão e roteamento básico estão funcionando.

---

## APIs opcionais

Você não precisa de uma chave de API para chegar ao primeiro `!menu`.

Depois que o núcleo estiver funcionando, edite `.env.local` somente para os
recursos que quiser ativar:

- BunnyFy: URL + credencial de consumidor;
- NVIDIA direta: `NVIDIA_API_KEY`;
- VEX legado: `VEX_API_KEY` + `VEX_SITE`.

A matriz completa e os modos `off`, `primary` e `exclusive` estão em
**[Configuração da sua instância](../configuracao-da-instancia.md)**.

---

## Da próxima vez

```bash
cd ~/shogun
termux-wake-lock
npm start
```

## Atualizar sem destruir a sessão

Pare o processo com `Ctrl + C` e execute:

```bash
cd ~/shogun
git pull --ff-only
npm ci --no-audit --no-fund
npm run preflight
npm start
```

`npm ci` respeita o lockfile do projeto. O diretório de sessão não deve ser apagado durante uma atualização normal.

---

## Diagnóstico rápido

```bash
cd ~/shogun
npm run preflight
```

O preflight verifica **Node.js, npm, Git, FFmpeg, Termux, configuração, dono da
instância, dependências locais e estado das integrações opcionais**.

<details>
<summary><strong>Node.js está abaixo de 20.19</strong></summary>
<br>

```bash
pkg update -y
pkg upgrade -y
pkg install -y nodejs-lts
node --version
```
</details>

<details>
<summary><strong>FFmpeg não existe</strong></summary>
<br>

```bash
pkg install -y ffmpeg
ffmpeg -version
```
</details>

<details>
<summary><strong><code>npm ci</code> falhou depois de uma instalação antiga</strong></summary>
<br>

```bash
cd ~/shogun
rm -rf node_modules
npm ci --no-audit --no-fund
```
</details>

<details>
<summary><strong>Quero refazer a configuração</strong></summary>
<br>

```bash
cd ~/shogun
npm run setup
```
</details>

---

## 🔐 A parte que você não deve mandar para ninguém

Arquivos privados desta instalação:

```text
.env.local
dados/src/config.json
dados/database/qr-code/
```

> [!CAUTION]
> Esses arquivos podem representar acesso à sessão vinculada ou conter
> configuração privada. **Não envie, não coloque em Drive, não publique em
> GitHub e não cole seu conteúdo em suporte.**

## O mínimo obrigatório

**Necessário para o núcleo:** Android + Termux, Node.js 20.19+, npm, Git, FFmpeg, configuração do dono e conexão com WhatsApp.

**Opcional:** integrações externas, IA e capacidades que dependam de APIs específicas. A ausência delas não impede o núcleo do SHOGUN de iniciar e conectar.

---

<p align="center"><a href="../../README.md">← Voltar à página principal</a></p>