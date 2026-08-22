import assert from 'node:assert/strict';
import { test } from 'node:test';

import { avisoDeEspera, comFloreio, mensagemDeErro } from '../../dist-vnext/voice/compose.js';
import { EMOJI_POR_INTENCAO, emojiDaIntencao, mereceAvisoDeEspera } from '../../dist-vnext/voice/intents.js';
import { MAX_FLOREIOS_POR_MENSAGEM, resolveBotName, NOME_PADRAO } from '../../dist-vnext/voice/contract.js';

/**
 * O sistema antigo cobria 8% das 545 famílias com emoji explícito; o resto caía
 * em regex largo ou no ⚙️. Estes testes fixam as propriedades que impedem a
 * volta daquele estado.
 */

test('toda intenção tem emoji: cobertura é total por construção', () => {
  const intencoes = Object.keys(EMOJI_POR_INTENCAO);
  for (const i of intencoes) {
    assert.ok(emojiDaIntencao(i), `intenção sem emoji: ${i}`);
  }
  // Sem fallback genérico não existe o buraco de 92% que havia antes.
  assert.equal(intencoes.length, new Set(intencoes).size);
});

test('intenções diferentes não colapsam no mesmo emoji sem motivo', () => {
  const emojis = Object.values(EMOJI_POR_INTENCAO);
  // Alguma repetição é aceitável, mas não a ponto de tudo virar o mesmo ícone.
  assert.ok(new Set(emojis).size >= emojis.length - 2, `emojis colapsados demais: ${emojis.join(' ')}`);
});

test('operação rápida não anuncia que está processando', () => {
  assert.equal(mereceAvisoDeEspera('calcular'), false);
  assert.equal(avisoDeEspera({ intencao: 'calcular', assunto: '2+2' }), null);
});

test('aviso de espera diz o que está sendo feito e com qual assunto', () => {
  const msg = avisoDeEspera({ intencao: 'buscar', assunto: 'zenitsu wallpaper 4k', quantidade: 4 });
  assert.ok(msg);
  assert.match(msg, /Procurando/);
  assert.match(msg, /zenitsu wallpaper 4k/);
  assert.match(msg, /4 itens/);
  // O defeito que motivou tudo: frase que serviria para qualquer comando.
  assert.doesNotMatch(msg, /sombras|serenidade|guerreiro|Concentração total/i);
});

test('erro repete o termo buscado e entrega um próximo passo', () => {
  const msg = mensagemDeErro({
    intencao: 'buscar',
    assunto: 'zenitsu wallpaper 4k',
    proximoPasso: 'Tenta um termo mais curto: !pinterest zenitsu',
  });
  assert.match(msg, /zenitsu wallpaper 4k/);
  assert.match(msg, /!pinterest zenitsu/);
  // Sem repetir o termo o usuário não sabe se errou a digitação.
  assert.doesNotMatch(msg, /termo pesquisado/);
});

test('erro sem próximo passo ainda diz o que foi tentado', () => {
  const msg = mensagemDeErro({ intencao: 'baixar', assunto: 'link quebrado' });
  assert.match(msg, /link quebrado/);
});

test('o teto de floreio é respeitado, que é o que evita cara de IA', () => {
  const texto = comFloreio('🔍 Procurando "gatos".', ['Já volto.', 'Ah, e mais uma coisa.', 'E outra.']);
  assert.equal(texto.includes('Já volto.'), true);
  assert.equal(texto.includes('Ah, e mais uma coisa.'), false);
  assert.equal(MAX_FLOREIOS_POR_MENSAGEM, 1);
});

test('sem floreio o texto passa intacto', () => {
  const base = '🔍 Procurando "gatos".';
  assert.equal(comFloreio(base, []), base);
  assert.equal(comFloreio(base, ['   ']), base);
});

test('o nome vem de configuração, porque vai mudar', () => {
  assert.equal(resolveBotName({}), NOME_PADRAO);
  assert.equal(resolveBotName({ BOT_NAME: 'Alaska' }), 'Alaska');
  assert.equal(resolveBotName({ BOT_NAME: '  Outro  ' }), 'Outro');
});
