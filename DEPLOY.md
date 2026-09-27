# Deploy operacional do SHOGUN

> **Fonte operacional:** laboratório local. O antigo fluxo de VPS/Pterodactyl não é mais a produção ativa.

Este documento descreve o caminho atual de implantação. Ele existe para evitar que uma instrução antiga mande uma atualização para o lugar errado, uma tradição particularmente eficiente de transformar documentação desatualizada em incidente.

## Estado atual

A produção roda no laboratório local em:

```text
/home/mauricio/Projetos/Laboratorio-SHOGUN
```

Serviços principais:

```text
shogun-lab.service      # bot
bunnyfy-lab.service     # API local, 127.0.0.1:18080
```

As units ficam em `/etc/systemd/user/`. O gerenciador de usuário inicia antes de o home cifrado estar disponível, por isso as units não devem ser movidas para `~/.config/systemd/user/`.

Para o histórico completo da migração e das travas do laboratório, consulte:

- `docs/RETOMADA_SHOGUN_2026-08-23.md`;
- `docs/LABORATORIO_LOCAL_SHOGUN_BUNNYFY_2026-08-22.md`.

## Antes de qualquer implantação

Confirme primeiro o que está realmente no ar:

```bash
systemctl --user status shogun-lab.service bunnyfy-lab.service --no-pager
systemctl --user status shogun-lab-health.timer --no-pager
curl --fail http://127.0.0.1:18080/health
curl --fail http://127.0.0.1:18080/ready
```

O painel somente leitura também pode ser usado sem afetar os processos:

```bash
bash ops/local-lab/painel.sh bot
bash ops/local-lab/painel.sh api
```

Nunca imprima `.env`, `config.json`, `creds.json`, cookies, bancos ou cabeçalhos de autenticação durante diagnóstico.

## Fonte que deve ser implantada

O SHOGUN é desenvolvido e qualificado no repositório privado. O repositório público é um recorte distribuível e não substitui a árvore operacional do laboratório.

Antes de aplicar uma mudança:

```bash
git status --short
git branch --show-current
git rev-parse HEAD
npm run validate:ci
```

A implantação não deve começar com árvore suja ou revisão desconhecida.

## Aplicar a camada qualificada

O laboratório mantém releases separados. Primeiro descubra o runtime usado pelas units em vez de presumir um caminho:

```bash
systemctl --user cat shogun-lab.service
systemctl --user cat bunnyfy-lab.service
```

Identifique o diretório `releases/<id>` comum ao runtime ativo e use esse caminho como argumento:

```bash
bash ops/local-lab/aplicar-camada-qualificacao.sh \
  /home/mauricio/Projetos/Laboratorio-SHOGUN/releases/<id>
```

O script atualiza somente a cópia de runtime e preserva estado vivo como sessão, bancos, mídias configuráveis e arquivos locais de configuração.

## Gate obrigatório antes de reiniciar o bot

Depois de aplicar a camada e **antes** de reiniciar `shogun-lab.service`, entre no runtime do bot e gere novamente as fontes efetivamente executadas:

```bash
cd /home/mauricio/Projetos/Laboratorio-SHOGUN/releases/<id>/shogun
node dados/src/.scripts/prepareRuntimeSources.js
```

`exit=0` é obrigatório.

Esse passo não é cosmético. O processo executa arquivos `.runtime-*` gerados e alguns patches dependem de correspondência literal no fonte. Testes verdes no repositório não provam que o runtime gerado ainda inicia.

Depois, valide o runtime implantado:

```bash
npm run validate:deploy
```

Se qualquer gate falhar, **não reinicie o serviço**. Corrija a camada ou restaure o runtime conhecido antes de avançar.

## Reinício controlado

Com os gates verdes:

```bash
systemctl --user restart bunnyfy-lab.service
curl --fail http://127.0.0.1:18080/health
curl --fail http://127.0.0.1:18080/ready

systemctl --user restart shogun-lab.service
systemctl --user status shogun-lab.service bunnyfy-lab.service --no-pager
```

O SHOGUN deve reaproveitar a sessão existente. Um QR novo inesperado é falha de implantação, não convite para apagar a sessão e começar de novo.

## Provas depois do restart

No sistema:

```bash
systemctl --user is-active shogun-lab.service bunnyfy-lab.service
systemctl --user is-enabled shogun-lab.service bunnyfy-lab.service shogun-lab-health.timer
loginctl show-user "$USER" -p Linger
curl --fail http://127.0.0.1:18080/health
curl --fail http://127.0.0.1:18080/ready
```

Logs recentes, sem despejar segredos:

```bash
journalctl --user -u bunnyfy-lab.service -n 100 --no-pager
journalctl --user -u shogun-lab.service -n 100 --no-pager
```

No WhatsApp, o aceite mínimo é:

1. SHOGUN conectado sem QR novo;
2. `!menu` respondendo;
3. `!perfil` do remetente;
4. `!perfil @mencionado`;
5. `!perfil` respondendo a uma mensagem de outra pessoa;
6. um comando simples de grupo;
7. uma capacidade que faça SHOGUN → BunnyFy pelo loopback.

Depois faça um restart adicional de cada serviço e confirme que sessão, configuração e estado continuam intactos.

## O que não fazer

- não usar o antigo deploy Pterodactyl como caminho normal de produção;
- não editar a cópia selada de snapshot como se fosse fonte;
- não sobrescrever `dados/database/`, `dados/src/config.json`, `.env.local` ou sessão;
- não reiniciar o bot antes de `prepareRuntimeSources.js` retornar `0`;
- não declarar implantação concluída só porque commit ou CI ficou verde;
- não tocar no servidor Mendes descrito nas travas operacionais antigas.

## Critério de conclusão

Uma mudança está implantada somente quando **fonte, runtime gerado e comportamento real** concordam: gates verdes, serviços ativos, BunnyFy saudável, WhatsApp conectado e smokes funcionais aprovados.