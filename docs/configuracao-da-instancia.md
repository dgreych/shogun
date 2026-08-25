# Configuração da sua instância do SHOGUN

Este guia responde três perguntas antes que você precise abrir código:

1. **quem é o dono desta instalação?**
2. **o que é obrigatório para o bot iniciar?**
3. **quais chaves de API só são necessárias para recursos opcionais?**

O objetivo é que uma instalação nova seja previsível. Nada de descobrir uma
credencial escondida depois de quinze minutos encarando um stack trace como se
ele fosse um oráculo.

---

## 1. Quem é o “dono” do bot?

Quando você clona o SHOGUN e executa `npm run setup`, o número informado em
`numerodono` define o **dono principal daquela instância**.

```text
Projeto SHOGUN
│
├── autoria e créditos do projeto
│   └── continuam os mesmos em qualquer clone
│
└── sua instalação
    │
    ├── dono principal da instância
    │   └── seu número configurado em numerodono
    │
    ├── sessão WhatsApp desta instalação
    │
    └── grupos onde o bot participa
        └── administradores do grupo ≠ dono principal da instância
```

### Em termos simples

- **Dono principal da instância:** pessoa que controla esta cópia do bot e pode
  usar comandos reservados ao dono.
- **Administrador de grupo:** cargo concedido pelo próprio WhatsApp dentro de um
  grupo. Não transforma alguém em dono da instância.
- **Autor/criador do projeto:** crédito de quem criou ou desenvolveu o software.
  Clonar o projeto não altera autoria.

O número do dono deve incluir país + DDD + número e conter somente dígitos.
Exemplo de formato brasileiro: `55DDDNUMERO`.

A configuração fica em `dados/src/config.json`. Esse arquivo é local e não deve
ser enviado ao GitHub.

---

## 2. O que é obrigatório para o SHOGUN funcionar?

### Núcleo do bot

Para iniciar o núcleo e conectar ao WhatsApp, você precisa de:

- Node.js compatível;
- npm;
- Git;
- FFmpeg;
- `dados/src/config.json`, criado pelo setup;
- uma sessão WhatsApp criada por QR Code ou código de pareamento.

**Nenhuma chave de API é obrigatória apenas para o bot iniciar.** Recursos que
dependem de serviços externos ficam disponíveis conforme você os configura.

Execute:

```bash
npm run preflight
```

O diagnóstico informa o que está pronto sem imprimir seus segredos.

---

## 3. `.env.local`: onde ficam as opções privadas

O SHOGUN carrega configurações privadas de:

```text
.env.local
```

O repositório fornece um modelo seguro:

```text
.env.example
```

Os instaladores oficiais criam `.env.local` a partir do exemplo quando ele
não existe. Se estiver fazendo o processo manualmente:

### Linux, macOS ou Termux

```bash
cp -n .env.example .env.local
chmod 600 .env.local
```

### Windows PowerShell

```powershell
if (-not (Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Nunca publique `.env.local`.

---

## 4. Matriz de integrações e credenciais

| Recurso | Precisa de chave? | Configuração | Quando usar |
| --- | --- | --- | --- |
| Núcleo + WhatsApp | **não** | setup + sessão | sempre |
| BunnyFy | sim, se ativada | `BUNNYFY_ENABLED`, `BUNNYFY_BASE_URL`, `BUNNYFY_API_TOKEN` | capacidades servidas pela BunnyFy |
| Assistente via BunnyFy | chave BunnyFy | `BUNNYFY_AI_MODE=exclusive` | IA totalmente pela BunnyFy |
| Assistente BunnyFy + fallback NVIDIA | BunnyFy + NVIDIA | `BUNNYFY_AI_MODE=primary`, `NVIDIA_API_KEY` | BunnyFy primeiro, NVIDIA direta se houver falha transitória |
| Assistente NVIDIA direta | NVIDIA | `BUNNYFY_AI_MODE=off`, `NVIDIA_API_KEY` | IA sem BunnyFy |
| Transcrição via BunnyFy | chave BunnyFy | BunnyFy ativa + modo correspondente | caminho recomendado quando disponível |
| Transcrição VEX legado | VEX | `VEX_API_KEY`, `VEX_SITE` | somente quando o fallback legado for usado |
| Upload GitHub legado | GitHub | `UPLOAD_GITHUB_TOKEN`, `UPLOAD_GITHUB_REPO` | somente nos fluxos legados que ainda dependam dele |

### Regra importante sobre BunnyFy

A BunnyFy é uma plataforma separada. Se uma instância do SHOGUN usa a BunnyFy,
o bot recebe **somente uma credencial de consumidor da BunnyFy**.

Chaves internas de provedores usados pela BunnyFy, como NVIDIA ou outros
serviços da infraestrutura da API, pertencem ao operador da BunnyFy e **não
devem ser copiadas para o bot**.

---

## 5. Modos BunnyFy

A chave mestra é:

```env
BUNNYFY_ENABLED=false
```

Com `false`, as capacidades BunnyFy ficam desligadas e os caminhos legados ou
locais continuam sendo usados quando existirem.

Ao ativar:

```env
BUNNYFY_ENABLED=true
BUNNYFY_BASE_URL=https://SUA-BUNNYFY.example
BUNNYFY_API_TOKEN=SUA_CREDENCIAL_DE_CONSUMIDOR
```

Cada família usa um modo:

```text
off       -> não usa BunnyFy nessa capacidade
primary   -> tenta BunnyFy; em falha transitória usa fallback quando houver
exclusive -> usa BunnyFy; não cai para o provider legado
```

As famílias atuais incluem IA, YouTube, imagens, stickers, canvas, logos,
geração visual, Tavern e NEXO. O `.env.example` é a referência dos nomes
exatos disponíveis nesta versão.

> Não ative `exclusive` em uma capacidade antes de confirmar que a BunnyFy
> configurada oferece aquele contrato.

---

## 6. Configurações da IA

### Opção A — IA totalmente pela BunnyFy

```env
BUNNYFY_ENABLED=true
BUNNYFY_AI_MODE=exclusive
BUNNYFY_BASE_URL=https://SUA-BUNNYFY.example
BUNNYFY_API_TOKEN=SUA_CREDENCIAL
NVIDIA_API_KEY=
```

O bot não precisa conhecer a chave do provedor de IA da BunnyFy.

### Opção B — NVIDIA direta

```env
BUNNYFY_ENABLED=false
NVIDIA_API_KEY=SUA_CHAVE_NVIDIA
```

O modelo pode ser escolhido pelos mecanismos do próprio bot.

### Opção C — BunnyFy com fallback NVIDIA

```env
BUNNYFY_ENABLED=true
BUNNYFY_AI_MODE=primary
BUNNYFY_BASE_URL=https://SUA-BUNNYFY.example
BUNNYFY_API_TOKEN=SUA_CREDENCIAL
NVIDIA_API_KEY=SUA_CHAVE_NVIDIA
```

Aqui a chave NVIDIA é necessária para o fallback direto realmente funcionar.

---

## 7. VEX e integrações legadas

O SHOGUN ainda preserva alguns fallbacks para não remover recursos antes de uma
substituição comprovada.

Para o fallback VEX de transcrição:

```env
VEX_API_KEY=
VEX_SITE=
```

Deixe vazio se você não usa esse caminho.

Da mesma forma, `UPLOAD_GITHUB_TOKEN` não é requisito geral do bot. Só configure
credenciais legadas quando você souber qual recurso as consome.

---

## 8. Como verificar sem vazar segredo

Use:

```bash
npm run preflight
```

E, quando estiver configurando NVIDIA direta:

```bash
npm run test:nvidia:live
```

O preflight deve mostrar **presença/ausência e modo**, nunca o valor de tokens.

Nunca cole em issue, print, vídeo ou pedido de suporte:

- `.env.local`;
- `dados/src/config.json`;
- `dados/database/qr-code/`;
- tokens e chaves;
- cookies;
- URLs assinadas.

---

## 9. Sequência recomendada para uma instalação nova

```text
1. instalar Git + Node + FFmpeg
          ↓
2. clonar o repositório
          ↓
3. executar o instalador da sua plataforma
          ↓
4. informar o dono principal da instância
          ↓
5. rodar npm run preflight
          ↓
6. iniciar com npm start
          ↓
7. conectar o WhatsApp
          ↓
8. testar !menu
          ↓
9. só então ativar APIs opcionais que você realmente quiser
```

Isso mantém o primeiro boot simples e deixa integrações externas como extensão,
não como pedágio para chegar ao menu.
