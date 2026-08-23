import test from 'node:test';
import assert from 'node:assert/strict';
import { despachar, estaMigrado } from '../../dist-vnext/rpg/economia/despachante.js';
import { RAMOS_MIGRADOS } from '../../dist-vnext/rpg/economia/ramos.js';

const f = {
  fmt: (v) => `R$ ${v ?? 0}`,
  getUserName: (jid) => jid.split('@')[0],
  saveEconomy: () => {},
};
const deps = {
  economia: f,
  acaso: { agora: () => 1_700_000_000_000, aleatorio: () => 0.5, timeLeft: () => '1m' },
  texto: {
    parseAmount: (b) => Number.parseInt(b, 10),
    findKeyIgnoringAccents: (o, k) => (Object.keys(o).includes(k) ? k : null),
    normalizeParam: (x) => x.toLowerCase(),
  },
  progressao: {
    getSkillBonus: () => 0, addSkillXP: () => {}, updateChallenge: () => {},
    updatePeriodChallenge: () => {}, isChallengeCompleted: () => false, giveMaterial: () => {},
  },
  habilidade: {
    SKILL_LIST: ['mining'],
    skillXpForNext: (n) => n * 100,
    ensureUserSkills: (u) => { u.skills = u.skills || { mining: { level: 1, xp: 0 } }; },
  },
};
const dados = {
  prefixo: '!', remetente: '55@s.whatsapp.net', pushname: 'Fulano',
  mencionado: null, membrosDoGrupo: [], consultaBruta: '',
  permissaoReset: {
    isOwner: false, isSubOwner: false, remetente: '55@s.whatsapp.net',
    donoPrincipal: '99@s.whatsapp.net', enviadoPeloBot: false,
  },
  parAtivo: null, capacidadeBanco: 10000,
};
const ctxDe = (sub) => ({
  econ: { materialsPrices: { ferro: 5 }, propertiesCatalog: {}, jobCatalog: {} },
  usuario: {
    wallet: 1000, bank: 0, materials: { ferro: 10 }, cooldowns: {},
    challenge: { tasks: [], reward: 100 }, properties: {}, ingredients: {},
  },
  bonus: { mineBonus: 0, workBonus: 0, bankCapacity: 10000, fishBonus: 0, exploreBonus: 0, huntBonus: 0, forgeBonus: 0 },
  sub,
  args: [],
});

test('todo ramo declarado como migrado é realmente atendido pelo despachante', () => {
  // Se a lista e o switch divergissem, o comando cairia num corpo legado que
  // o resto do sistema já trata como morto — a falha mais silenciosa possível.
  const orfaos = RAMOS_MIGRADOS.filter((sub) => despachar(ctxDe(sub), deps, dados) === null);
  assert.deepEqual(orfaos, [], 'estes ramos estão na lista mas o despachante não os atende');
});

test('todo ramo atendido devolve texto não vazio', () => {
  for (const sub of RAMOS_MIGRADOS) {
    const r = despachar(ctxDe(sub), deps, dados);
    assert.equal(typeof r.texto, 'string', `${sub} precisa devolver texto`);
    assert.ok(r.texto.length > 0, `${sub} devolveu texto vazio`);
  }
});

test('ramo não migrado devolve null para o legado seguir', () => {
  // minerar, pescar, cozinhar e companhia continuam no monólito.
  for (const sub of ['minerar', 'pescar', 'cozinhar', 'plantar', 'apostar', 'assaltar']) {
    assert.equal(despachar(ctxDe(sub), deps, dados), null, `${sub} não deveria ser atendido ainda`);
    assert.equal(estaMigrado(sub), false);
  }
});

test('estaMigrado concorda com a lista', () => {
  for (const sub of RAMOS_MIGRADOS) assert.equal(estaMigrado(sub), true, sub);
});
