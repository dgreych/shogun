import assert from 'node:assert/strict';
import test from 'node:test';
import menus from '../dados/src/menus/index.js';
import { createShogunMenuTheme, withShogunMenuTheme } from '../dados/src/menus/theme.js';
import { installBotPresentation, formatCommandResponse } from '../dados/src/utils/commandPresentation.js';

test('menus reais têm composição aberta lua/gato sem colunas ou slogans', async () => {
  for (const [name, render] of Object.entries(menus)) {
    const args = name === 'menubn' ? ['!', 'SHOGUN', 'Maurício', true]
      : name === 'menuTopCmd' ? ['!', 'SHOGUN', 'Maurício', []] : ['!', 'SHOGUN', 'Maurício'];
    const output = await render(...args);
    assert.match(output, /⋆ · ⟡ 🐈‍⬛ ⟡ · ⋆/u, name);
    assert.match(output, /☾/u, name);
    assert.match(output, /🐾/u, name);
    assert.doesNotMatch(output, /^[│┃╭╰┣]/mu, name);
    assert.doesNotMatch(output, /nosso canto|sob a mesma lua|entre luas e ideias|o resto é comigo|escolha sua rota|seu próximo passo|SHOGUN AVISO/iu, name);
    assert.ok(output.includes('*!'), name);
  }
});

test('defaults v4 migram, menudesign customizado permanece ativo', () => {
  const old = { styleVersion: 4,
    header: '⟡━━〔 🐈‍⬛ *SHOGUN* 〕━━⟡\n     *#title#*\n\n╭─ ☾ ─────────────\n│  ☾ Salve, *#nome#*.\n│  #intro#\n│  ⌘ Prefixo *#prefix#*\n╰───────────── ⟡\n',
    middleBorder: '│', menuItemIcon: '  ⤷ ', bottomBorder: 'FECHO DO DONO' };
  const migrated = withShogunMenuTheme(old);
  assert.equal(migrated.header, createShogunMenuTheme().header);
  assert.equal(migrated.middleBorder, '');
  assert.equal(migrated.bottomBorder, 'FECHO DO DONO');
});

test('conversa e avisos livres chegam intactos pelo socket global', async () => {
  const sent = [];
  const socket = { async sendMessage(...args) { sent.push(args); } };
  installBotPresentation(socket);
  const text = 'Sei, Maurício. Você é o Alaska Dev.\n\n```js\n  run();\n```';
  await socket.sendMessage('group', { text, mentions: ['123'] });
  assert.equal(sent[0][1].text, text);
  assert.deepEqual(sent[0][1].mentions, ['123']);
  assert.equal(formatCommandResponse('Uma resposta natural.', 'gpt'), 'Uma resposta natural.');
});

test('aliases de conversa e escrita entregam a mesma resposta natural', () => {
  const text='Posso explicar isso, sim.\n\n```js\n  example();\n```';
  for(const command of ['gpt','resumir','resumirurl','ideias','ideia','explicar','explique','corrigir','correcao','resumirchat','resumirgrupo','resumirconversa','historia','story','gerarhistoria','recomendar','recomendacao','recomendação','suggest','gemma','phi','phi3','qwen2','qwen','qwen3','llama','llama3','baichuan','baichuan2','marin','kimi','kimik2','mistral','magistral','rakutenai','rocket','yi','gemma2','swallow','falcon','qwencoder','codegemma','cog','tradutor','translator','debater','debate','historiainterativa','storyinteractive','aventura']) {
    assert.equal(formatCommandResponse(text,command),text,command);
  }
});


test('assistente configura o grupo com título funcional', () => {
  for(const alias of ['assistente','assistent']) {
    const out=formatCommandResponse('Conversa ligada neste grupo.',alias);
    assert.match(out,/ASSISTENTE DO GRUPO/);
    assert.doesNotMatch(out,/SHOGUN RESPONDE|SHOGUN AVISO/);
  }
});
