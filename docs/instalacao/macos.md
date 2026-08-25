<h1 align="center">🍎 SHOGUN no macOS</h1>
<p align="center"><strong>Intel ou Apple Silicon, do Terminal ao WhatsApp conectado.</strong></p>

<p align="center">
  <img alt="macOS" src="https://img.shields.io/badge/macOS-Intel%20%7C%20Apple%20Silicon-111111?logo=apple&logoColor=white">
  <img alt="Node 20.19+" src="https://img.shields.io/badge/Node.js-20.19%2B-339933?logo=node.js&logoColor=white">
  <img alt="Tempo" src="https://img.shields.io/badge/primeira%20instala%C3%A7%C3%A3o-10%E2%80%9320%20min-6b2637">
</p>

## Rota completa

| Etapa | Ação | Sinal de sucesso |
| --- | --- | --- |
| **1** | instalar requisitos | versões aparecem no Terminal |
| **2** | clonar o SHOGUN | pasta `~/shogun` criada |
| **3** | executar instalador | setup concluído |
| **4** | rodar preflight | requisitos obrigatórios aprovados |
| **5** | conectar WhatsApp | feed ativo |
| **6** | testar | `!menu` responde |

---

## 1 · Prepare o Mac

Se usa Homebrew:

```bash
brew update
brew install node git ffmpeg
```

Confirme:

```bash
node --version
npm --version
git --version
ffmpeg -version
```

> [!IMPORTANT]
> O SHOGUN exige **Node.js 20.19.0 ou superior**.

Se `brew` não existir, instale os requisitos pelos distribuidores oficiais antes de continuar.

---

## 2 · Baixe o projeto

```bash
cd ~
git clone https://github.com/dgreych/shogun.git
cd shogun
```

Se a pasta já existir, use `cd ~/shogun` em vez de clonar novamente.

---

## 3 · Execute o instalador

```bash
bash scripts/install-macos.sh
```

O script cria `.env.local` a partir de `.env.example` se necessário, executa o
preflight, instala as dependências travadas pelo `package-lock.json`, abre o
setup e verifica as entradas principais do runtime. Um `.env.local` existente
é preservado.

<table>
<tr><td><strong>Seu nome</strong></td><td>identificação do dono principal desta instância</td></tr>
<tr><td><strong>Número</strong></td><td>país + DDD + número do dono principal, somente dígitos</td></tr>
<tr><td><strong>Nome do bot</strong></td><td>nome desta instalação</td></tr>
<tr><td><strong>Prefixo</strong></td><td>por exemplo <code>!</code></td></tr>
</table>

### Quem é o dono principal?

```text
projeto SHOGUN
    └── sua instalação no macOS
        ├── dono principal -> numerodono
        ├── sessão WhatsApp
        └── grupos -> administradores próprios
```

O número salvo pelo setup controla **esta instância** e seus comandos de dono.
Ele não altera a autoria do projeto e não é a mesma coisa que ser administrador
de um grupo.

Veja **[Configuração da sua instância](../configuracao-da-instancia.md)** para a
matriz de integrações e credenciais opcionais.

---

## 4 · Faça o preflight

```bash
npm run preflight
```

Esse comando confere os requisitos, a configuração do dono e o estado das
integrações sem mostrar tokens. Avisos sobre APIs opcionais não impedem o núcleo
quando esses recursos não estão sendo usados.

> [!NOTE]
> Nenhuma chave de API é necessária apenas para chegar ao primeiro `!menu`.

---

## 5 · Inicie e conecte

```bash
npm start
```

O painel oferece **QR Code** ou **código de pareamento**.

<p align="center">
  <img src="img/painel.png" alt="Painel de conexão do SHOGUN" width="82%">
</p>

Para QR Code, no telefone abra **WhatsApp → Aparelhos conectados → Conectar um aparelho**. Depois que a sessão for criada, os próximos boots reutilizam a sessão enquanto ela permanecer válida.

---

## 6 · Teste

Em um grupo de teste:

```text
!menu
```

Se escolheu outro prefixo, use-o no lugar de `!`.

---

## APIs opcionais

Depois de confirmar o núcleo, edite `.env.local` apenas para os recursos que
quiser ativar:

- BunnyFy: URL + credencial de consumidor e modos desejados;
- NVIDIA direta: `NVIDIA_API_KEY` para IA direta/fallback;
- VEX legado: `VEX_API_KEY` + `VEX_SITE` somente quando usado.

Detalhes: **[Configuração da sua instância](../configuracao-da-instancia.md)**.

---

## Uso diário

### Iniciar novamente

```bash
cd ~/shogun
npm start
```

### Atualizar

```bash
cd ~/shogun
git pull --ff-only
npm ci --no-audit --no-fund
npm run preflight
npm start
```

### Diagnosticar

```bash
cd ~/shogun
npm run preflight
```

---

## 🔐 Proteja a instalação

Arquivos privados:

```text
.env.local
dados/src/config.json
dados/database/qr-code/
```

> [!CAUTION]
> Não publique, envie ou compartilhe esses arquivos. A sessão contém material
> de autenticação da conta conectada e as configurações podem conter dados
> privados ou credenciais.

Para problemas adicionais, consulte **[Solução de problemas](../solucao-de-problemas.md)**.

<p align="center"><a href="../../README.md">← Voltar à página principal</a></p>