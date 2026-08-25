# Primeiros passos com o SHOGUN

## Antes de tudo: esta instalação é sua instância

Ao executar o setup, o número salvo em `numerodono` vira o **dono principal
desta instância** do SHOGUN. É esse número que recebe privilégios reservados ao
dono do bot.

Isso não altera a autoria do projeto e também não é a mesma coisa que ser
administrador de um grupo do WhatsApp.

```text
projeto SHOGUN
    └── sua instalação
        ├── dono principal -> numerodono
        ├── sessão WhatsApp
        └── grupos -> administradores próprios
```

Leia **[Configuração da sua instância](configuracao-da-instancia.md)** para a
matriz completa de APIs e credenciais opcionais.

## A inspeção

Dentro da pasta do projeto:

```bash
npm run preflight
```

Todos os itens obrigatórios devem aparecer com `✅`. Avisos sobre NVIDIA, VEX,
BunnyFy ou outras integrações opcionais não impedem o núcleo de iniciar quando
esses recursos não estão sendo usados.

O preflight também verifica `.env.local` e a configuração da instância sem
imprimir tokens ou chaves.

## A configuração

```bash
npm run setup
```

Informe seu nome, número com país e DDD, nome do bot e prefixo. Para manter um
valor existente, apenas pressione Enter.

O setup grava `dados/src/config.json`. Os instaladores oficiais também criam
`.env.local` a partir de `.env.example` quando necessário, mantendo APIs
opcionais desligadas por padrão.

## A conexão

```bash
npm start
```

Escolha QR ou código de pareamento. A sessão fica local e será reutilizada no
próximo início.

## A primeira missão

Envie:

```text
!menu
```

Depois teste uma ferramenta simples, uma figurinha e um comando de grupo sem
efeito destrutivo. Só dê cargo de administrador quando entender quais rotinas
serão usadas.

## APIs vêm depois do primeiro boot

Você não precisa configurar BunnyFy, NVIDIA, VEX ou upload externo para provar
que o núcleo instalou corretamente. Primeiro confirme `!menu`; depois ative
somente as integrações que realmente quiser usar.

Consulte **[Configuração da sua instância](configuracao-da-instancia.md)** para
saber exatamente qual variável pertence a cada capacidade.

## A rotina

- `Ctrl+C` encerra com segurança;
- `npm start` retoma a patrulha;
- `npm run setup` altera dono, nome e prefixo;
- `npm run preflight` diagnostica sistema, configuração e integrações;
- `git pull --ff-only` e `npm ci` atualizam o código e as dependências.
