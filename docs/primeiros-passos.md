# Primeiros passos com o SHOGUN

## A inspeção

Dentro da pasta do projeto:

```bash
npm run preflight
```

Todos os itens obrigatórios devem aparecer com `✅`.

## A configuração

```bash
npm run setup
```

Informe seu nome, número com país e DDD, nome do bot e prefixo. Para manter um valor existente, apenas pressione Enter.

## A conexão

```bash
npm start
```

Escolha QR ou código de pareamento. A sessão fica local e será reutilizada no próximo início.

## A primeira missão

Envie:

```text
!menu
```

Depois teste uma ferramenta simples, uma figurinha e um comando de grupo sem efeito destrutivo. Só dê cargo de administrador quando entender quais rotinas serão usadas.

## A rotina

- `Ctrl+C` encerra com segurança;
- `npm start` retoma a patrulha;
- `npm run setup` altera a configuração;
- `git pull --ff-only` e `npm ci` atualizam o código e as dependências.
