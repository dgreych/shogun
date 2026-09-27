import assert from 'node:assert/strict';
import test from 'node:test';
import { SHOGUN } from '../../dist-vnext/voice/personas/shogun.js';
import { aplicarFloreio, obterPersona, personasRegistradas, registrarPersona } from '../../dist-vnext/voice/persona.js';
import { NOME_PADRAO, resolveBotName } from '../../dist-vnext/voice/contract.js';

test('a voz contém apenas Shogun, inclusive antes de importar um perfil', () => {
  assert.deepEqual(personasRegistradas().map(item => item.chave), ['shogun']);
  assert.equal(obterPersona('shogun'), SHOGUN);
  assert.equal(obterPersona('perfil_antigo'), null);
  assert.throws(() => registrarPersona({ ...SHOGUN, chave: 'outro' }), /somente Shogun/);
});

test('respostas concretas não recebem bordões aleatórios', () => {
  const texto = 'Procurando "gatos".';
  assert.equal(aplicarFloreio(texto, SHOGUN, () => 0), texto);
  assert.equal(aplicarFloreio(texto, null, () => 0), texto);
  assert.equal(SHOGUN.natureza, 'bot');
});

test('o nome padrão acompanha a identidade única', () => {
  assert.equal(resolveBotName({}), NOME_PADRAO);
  assert.equal(NOME_PADRAO, SHOGUN.nome);
});
