import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeRuntimeCommandSurface } from '../../scripts/analyze-runtime-command-surface.mjs';
import { intencaoDoComando } from '../../dist-vnext/voice/classify.js';
import { EMOJI_POR_INTENCAO, emojiDaIntencao } from '../../dist-vnext/voice/intents.js';

/**
 * O defeito original era medível: 44 overrides e 13 regex para 545 famílias,
 * então 92% dos comandos reagiam com o mesmo ⚙️. Estes testes travam a melhora
 * contra a superfície REAL do bot, não contra uma amostra escolhida a dedo.
 */

const surface = await analyzeRuntimeCommandSurface();
const tokens = surface.prepared.tokens;

test('a superfície inteira recebe intenção: não existe comando órfão', () => {
  assert.ok(tokens.length > 1500, `superfície inesperadamente pequena: ${tokens.length}`);
  for (const token of tokens) {
    const intencao = intencaoDoComando(token);
    assert.ok(EMOJI_POR_INTENCAO[intencao], `token sem intenção válida: ${token}`);
    assert.ok(emojiDaIntencao(intencao), `intenção sem emoji: ${intencao}`);
  }
});

test('nenhuma intenção concentra mais de um terço da superfície', () => {
  const cont = new Map();
  for (const token of tokens) {
    const i = intencaoDoComando(token);
    cont.set(i, (cont.get(i) ?? 0) + 1);
  }
  const maior = Math.max(...cont.values());
  const fatia = maior / tokens.length;
  // Antes, um único balde levava 92%. O teto de um terço impede a volta do
  // estado em que tudo reage igual.
  assert.ok(fatia <= 0.34, `balde dominante com ${Math.round(fatia * 100)}% da superfície`);
});

test('a variedade real de emojis é alta, que é o que o dono percebe', () => {
  const emojis = new Set(tokens.map((t) => emojiDaIntencao(intencaoDoComando(t))));
  assert.ok(emojis.size >= 12, `apenas ${emojis.size} emojis distintos em uso`);
});

test('comandos de famílias diferentes não reagem igual', () => {
  const casos = [
    ['play', 'baixar'],
    ['ban', 'punir'],
    ['menu', 'ajudar'],
    ['perfil', 'perfilar'],
    ['calc', 'calcular'],
    ['pinterest', 'baixar'],
    ['depositar', 'negociar'],
    ['minerar', 'progredir'],
  ];
  for (const [comando, esperado] of casos) {
    assert.equal(intencaoDoComando(comando), esperado, `${comando} classificado errado`);
  }
  const emojis = new Set(casos.map(([c]) => emojiDaIntencao(intencaoDoComando(c))));
  assert.ok(emojis.size >= 7, 'comandos distintos colapsaram no mesmo emoji');
});
