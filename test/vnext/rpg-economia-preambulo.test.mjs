import assert from 'node:assert/strict';
import test from 'node:test';

import { prepararEconomia, textoDaRecusa } from '../../dist-vnext/rpg/economia/context.js';

/**
 * O preâmbulo é compartilhado por 85 aliases e 23 ramos internos. Se a ordem
 * dos efeitos mudar aqui, muda o que fica gravado em disco para todos eles —
 * por isso a ordem é testada, não só o resultado.
 */

function deps(registro) {
  const econ = { marcador: 'economia' };
  return {
    econ,
    d: {
      loadEconomy: () => { registro.push('load'); return econ; },
      ensureEconomyDefaults: (e) => { registro.push('defaults'); assert.equal(e, econ); return registro.mudou ?? false; },
      getEcoUser: (e, id) => { registro.push('usuario:' + id); return { id }; },
      ensureUserChallenge: (u) => { registro.push('desafio:' + u.id); },
      applyShopBonuses: (u, e) => { registro.push('bonus'); return { mineBonus: 1, workBonus: 2, bankCapacity: 3, fishBonus: 4, exploreBonus: 5, huntBonus: 6, forgeBonus: 7 }; },
      saveEconomy: () => { registro.push('save'); },
    },
  };
}

const entrada = (over = {}) => ({
  emGrupo: true, modoRpgAtivo: true, remetente: '55@s.whatsapp.net',
  comando: 'banco', consulta: '', ...over,
});

test('fora de grupo recusa antes de tocar a economia', () => {
  const reg = [];
  const r = prepararEconomia(entrada({ emGrupo: false }), deps(reg).d);
  assert.equal(r.ok, false);
  assert.equal(r.recusa, 'fora-de-grupo');
  // Carregar economia para depois recusar seria I/O desperdiçado a cada
  // comando de RPG mandado no privado.
  assert.deepEqual(reg, []);
});

test('modo RPG desativado recusa sem carregar economia', () => {
  const reg = [];
  const r = prepararEconomia(entrada({ modoRpgAtivo: false }), deps(reg).d);
  assert.equal(r.ok, false);
  assert.equal(r.recusa, 'modo-rpg-desativado');
  assert.deepEqual(reg, []);
});

test('a ordem dos efeitos é a mesma do bloco legado', () => {
  const reg = [];
  const r = prepararEconomia(entrada(), deps(reg).d);
  assert.equal(r.ok, true);
  // Defaults antes de resolver usuário; desafio antes dos bônus. Inverter
  // qualquer um muda o que é gravado.
  assert.deepEqual(reg, ['load', 'defaults', 'usuario:55@s.whatsapp.net', 'desafio:55@s.whatsapp.net', 'bonus']);
});

test('só grava quando os defaults mudaram algo', () => {
  const reg = [];
  reg.mudou = true;
  const r = prepararEconomia(entrada(), deps(reg).d);
  assert.equal(r.ok, true);
  assert.ok(reg.includes('save'), 'defaults alterados precisam ser persistidos');

  const reg2 = [];
  prepararEconomia(entrada(), deps(reg2).d);
  assert.ok(!reg2.includes('save'), 'salvar sempre multiplicaria escrita em disco');
});

test('argumentos chegam divididos e em minúsculas, como o legado espera', () => {
  const r = prepararEconomia(entrada({ consulta: '  Espada  DE Ferro ' }), deps([]).d);
  assert.equal(r.ok, true);
  assert.deepEqual(r.contexto.args, ['espada', 'de', 'ferro']);
  assert.equal(r.contexto.sub, 'banco');
});

test('consulta vazia produz lista vazia, nunca um elemento em branco', () => {
  const r = prepararEconomia(entrada({ consulta: '   ' }), deps([]).d);
  assert.deepEqual(r.contexto.args, []);
});

test('as mensagens de recusa preservam o texto do bloco legado', () => {
  assert.match(textoDaRecusa('fora-de-grupo', '!'), /apenas em grupos/);
  const texto = textoDaRecusa('modo-rpg-desativado', '!');
  assert.match(texto, /Modo RPG desativado/);
  assert.match(texto, /!modorpg/);
  assert.match(texto, /!menurpg/);
});
