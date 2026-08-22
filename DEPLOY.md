# SHOGUN em um servidor

Este guia é para uma instalação nova em VPS, painel de hospedagem ou contêiner. Ele não substitui o manual da empresa que fornece o servidor.

## Requisitos

- Node.js 20.19 ou superior; Node.js 22 ou 24 é recomendado;
- npm 10 ou superior;
- Git;
- FFmpeg;
- ao menos 1 GB de memória; 2 GB deixam mídias e jogos mais confortáveis;
- armazenamento persistente para `dados/database/` e `dados/src/config.json`.

## Instalação

```bash
git clone https://github.com/dgreych/shogun.git
cd shogun
bash scripts/install-linux.sh
npm start
```

Na primeira execução, conecte o WhatsApp e confirme que `!menu` responde.

## O que precisa sobreviver a uma atualização

Nunca substitua ou apague automaticamente:

```text
dados/src/config.json
dados/database/
.env.local
```

Antes de atualizar, faça um backup privado dessas entradas. Depois:

```bash
git pull --ff-only
npm ci --no-audit --no-fund
npm run preflight
npm start
```

## Serviço Linux

O arquivo `deploy/gyomei.service.example` é uma referência técnica temporária. Ajuste usuário, diretório e caminho do Node.js antes de ativá-lo. Nunca copie sessões ou credenciais para a unidade do serviço.

## Verificação

Uma implantação só está concluída quando:

1. o processo permanece ativo;
2. o WhatsApp aparece como conectado;
3. `!menu` responde;
4. um comando de mídia simples funciona;
5. o reinício preserva a sessão e as configurações.

Se qualquer ponto falhar, restaure o backup de estado antes de tentar outra atualização.
