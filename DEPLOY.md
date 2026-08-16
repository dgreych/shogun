# Deploy da NAZUNA BOT - versão modificada GYOMEI

Este guia cobre dois tipos de build:

1. **artefato público higienizado**, próprio para preencher no servidor;
2. **build privada controlada**, gerada na instalação local já configurada.

Os arquivos compactados são **root-ready**. Depois da extração, `package.json`, `dados/` e `node_modules/` ficam diretamente no diretório do contêiner, sem uma pasta externa envolvendo o projeto.

## 1. Repositório correto

```bash
git remote -v
git branch --show-current
git rev-parse HEAD
```

Repositório esperado:

```text
https://github.com/dgreych/_Nazuna_bot_vs.Gyomei_
```

Não sincronize dados de outros bots ou outras pastas. Projetos diferentes não desenvolvem parentesco só porque ambos usam Node.js, apesar do esforço coletivo da humanidade em tratar diretórios como parentes distantes.

## 2. Preparar a configuração

```bash
cp -n .env.example .env.local
chmod 600 .env.local
```

Preencha `.env.local` somente na máquina ou no servidor:

```text
NVIDIA_API_KEY=SUA_CHAVE_NVIDIA
VEX_API_KEY=SUA_CHAVE_VEX
VEX_SITE=https://vexapi.com.br
```

Edite também:

```text
dados/src/config.json
```

Campos principais:

```json
{
  "nomedono": "SEU_NOME",
  "numerodono": "55DDDNUMERO",
  "nomebot": "NAZUNA BOT • GYOMEI",
  "prefixo": "!",
  "lidowner": "",
  "site_vex": "https://vexapi.com.br",
  "apikey_vex": "COLOQUE_SUA_CHAVE_VEX"
}
```

## 3. Validação

### Árvore pública

```bash
npm run validate:ci
npm run validate:public
```

### Instalação local configurada

```bash
npm run validate:local
```

### Servidor configurado

```bash
npm run validate:deploy
```

## 4. Artefato público root-ready

```bash
npm run build:server:artifact
```

Saída:

```text
dist/nazuna-gyomei-server-v1.0.0/
dist/nazuna-gyomei-server-v1.0.0-root.zip
dist/nazuna-gyomei-server-v1.0.0-root.tar.gz
```

O artefato público:

- usa exatamente a árvore do commit atual;
- mantém somente placeholders em `config.json`;
- remove `.env.local`;
- remove sessão do WhatsApp;
- remove JSONs de grupos;
- remove bancos pessoais e estatísticas geradas;
- remove qualquer chave NVIDIA hardcoded do módulo legado;
- valida o pacote montado antes de compactar.

### Conferir o ZIP

```bash
unzip -l dist/nazuna-gyomei-server-v1.0.0-root.zip | head -n 30
```

Você deve encontrar `package.json` diretamente na listagem. Não deve existir o prefixo:

```text
nazuna-gyomei-server-v1.0.0/package.json
```

### Conferir o TAR

```bash
tar -tzf dist/nazuna-gyomei-server-v1.0.0-root.tar.gz | head -n 30
```

A entrada esperada é:

```text
./package.json
```

## 5. Build privada com estado local

Pare o bot local antes de gerar:

```bash
npm run build:server
```

A build privada pode incluir, por lista controlada:

- `dados/src/config.json`;
- `.env.local`;
- design, áudio e texto “ler mais” do menu;
- personalizações de grupos;
- prompts, donos adicionais e mídias configuradas;
- antiflood, antipv, antispam e bloqueios;
- limites de menções;
- modo lite, horários e mensagens automáticas;
- JSONs de grupos com estados anti.

Ela não inclui automaticamente:

- sessão do WhatsApp;
- logs;
- bancos de usuários e economia;
- estatísticas de comandos;
- cache JID/LID;
- arquivos temporários;
- histórico Git.

Os campos `contador` são removidos dos grupos; antis e estados de moderação são preservados.

> A build privada pode conter chaves e configurações reais. Não publique esse ZIP ou TAR em releases, issues, commits ou grupos.

## 6. Upload em painel com extração automática

Use preferencialmente:

```text
nazuna-gyomei-server-v1.0.0-root.zip
```

Envie o ZIP para o diretório principal do contêiner e use a função de extração do painel. Depois, confirme:

```bash
pwd
ls -la
 test -f package.json && echo "startup na raiz" || echo "package.json não encontrado"
```

A estrutura correta deve ser parecida com:

```text
/container/package.json
/container/dados/
/container/node_modules/
```

Não deve ser:

```text
/container/nazuna-gyomei-server-v1.0.0/package.json
```

## 7. Startup do painel

Com Node.js 20 ou superior:

```bash
npm start
```

Para validar antes de iniciar:

```bash
npm run validate:deploy && npm start
```

Se o painel exigir um arquivo de entrada direto:

```text
dados/src/.scripts/start-v9.js
```

## 8. Upload por SSH

```bash
scp dist/nazuna-gyomei-server-v1.0.0-root.tar.gz usuario@servidor:/tmp/
```

No servidor:

```bash
sudo mkdir -p /opt/gyomei
sudo tar -xzf /tmp/nazuna-gyomei-server-v1.0.0-root.tar.gz -C /opt/gyomei
sudo useradd --system --home-dir /opt/gyomei --shell /usr/sbin/nologin gyomei 2>/dev/null || true
sudo chown -R gyomei:gyomei /opt/gyomei
```

Depois configure:

```bash
sudo -u gyomei cp -n /opt/gyomei/.env.example /opt/gyomei/.env.local
sudo chmod 600 /opt/gyomei/.env.local /opt/gyomei/dados/src/config.json
```

## 9. Teste em primeiro plano

```bash
cd /opt/gyomei
sudo -u gyomei npm run validate:deploy
sudo -u gyomei npm start
```

Teste no WhatsApp:

1. `!criador`;
2. comando incorreto e sugestões;
3. menção e resposta à IA;
4. `!t` em um áudio;
5. `!autotr` em grupo de teste;
6. exclusão e `!return1`;
7. `!setmidia menubn` e `!menubn`;
8. `!menumidia`, `!prompts` e `!listdonos`.

## 10. Serviço systemd

```bash
sudo cp /opt/gyomei/deploy/gyomei.service.example /etc/systemd/system/gyomei.service
sudo systemctl daemon-reload
sudo systemctl enable --now gyomei
```

Status e logs:

```bash
sudo systemctl status gyomei --no-pager
sudo journalctl -u gyomei -n 200 --no-pager
sudo journalctl -u gyomei -f
```

## 11. Sessão do WhatsApp

A sessão não entra em nenhum artefato público e não é copiada automaticamente na build privada.

Para migrar uma sessão existente, pare completamente as duas instâncias e copie a pasta separadamente por um canal privado. Nunca execute a mesma sessão simultaneamente em dois locais.

## 12. Rollback

Antes de substituir uma instalação:

```bash
sudo systemctl stop gyomei 2>/dev/null || true
sudo mv /opt/gyomei "/opt/gyomei-backup-$(date +%Y%m%d-%H%M%S)"
sudo mkdir -p /opt/gyomei
sudo tar -xzf /tmp/nazuna-gyomei-server-v1.0.0-root.tar.gz -C /opt/gyomei
sudo chown -R gyomei:gyomei /opt/gyomei
```

Para voltar:

```bash
sudo systemctl stop gyomei
sudo rm -rf /opt/gyomei
sudo mv /opt/gyomei-backup-AAAAmmdd-HHMMSS /opt/gyomei
sudo systemctl start gyomei
```

## 13. Segurança

- revogue chaves que já apareceram publicamente;
- nunca publique `.env.local`;
- mantenha sessão e bancos fora do Git;
- confira o manifesto da build;
- use o artefato público para distribuição;
- use a build privada somente para seu próprio servidor;
- não confie no ZIP automático do botão “Code” para deploy em painel, pois ele sempre inclui a pasta do repositório por fora.
