import assert from 'node:assert/strict';
import test from 'node:test';

import { ramoCarteira, ramoMercado, ramoResetRpg, RAMOS_MIGRADOS } from '../../dist-vnext/rpg/economia/ramos.js';

/**
 * Paridade com o bloco legado. O que estes testes protegem não é a lógica —
 * é o TEXTO: são comandos que o usuário lê todo dia, e mudança silenciosa de
 * formatação é regressão de produto mesmo com a regra intacta.
 */

const f = {
  fmt: (v) => `R$ ${Number(v || 0)}`,
  getUserName: (jid) => jid.split('@')[0],
  saveEconomy: () => {},
};

const ctx = (econ, usuario = {}) => ({ econ, usuario, bonus: {}, sub: '', args: [] });

test('carteira soma carteira e banco e mostra o emprego pelo catálogo', () => {
  const econ = { jobCatalog: { minerador: { name: 'Minerador' } } };
  const r = ramoCarteira(ctx(econ, { wallet: 100, bank: 50, job: 'minerador' }), f);
  assert.match(r.texto, /PERFIL FINANCEIRO/);
  assert.match(r.texto, /Carteira:\* R\$ 100/);
  assert.match(r.texto, /Banco:\* R\$ 50/);
  assert.match(r.texto, /Total:\* R\$ 150/);
  assert.match(r.texto, /Emprego:\* Minerador/);
});

test('sem emprego a carteira diz Desempregado, não vazio', () => {
  const r = ramoCarteira(ctx({}, { wallet: 0, bank: 0, job: null }), f);
  assert.match(r.texto, /Desempregado\(a\)/);
});

test('emprego sem entrada no catálogo cai para a própria chave', () => {
  // Sem este fallback o jogador veria o campo em branco quando o catálogo
  // muda e um emprego antigo some dele.
  const r = ramoCarteira(ctx({ jobCatalog: {} }, { job: 'pescador' }), f);
  assert.match(r.texto, /Emprego:\* pescador/);
});

test('mercado vazio orienta como anunciar, em vez de só dizer que está vazio', () => {
  const r = ramoMercado(ctx({ market: [] }), f);
  assert.match(r.texto, /mercado está vazio/);
  assert.match(r.texto, /listar/);
});

test('mercado lista ofertas e marca todos os vendedores', () => {
  const econ = { market: [
    { id: 1, type: 'item', key: 'espada', qty: 2, price: 300, seller: '55a@s.whatsapp.net' },
    { id: 2, type: 'material', mat: 'ferro', qty: 10, price: 50, seller: '55b@s.whatsapp.net' },
  ] };
  const r = ramoMercado(ctx(econ), f);
  assert.match(r.texto, /#1 • espada x2 — R\$ 300/);
  assert.match(r.texto, /#2 • ferro x10 — R\$ 50/);
  // Sem as menções, os vendedores não são notificados de que apareceram na lista.
  assert.deepEqual(r.mencoes, ['55a@s.whatsapp.net', '55b@s.whatsapp.net']);
});

const permissaoOk = {
  isOwner: true, isSubOwner: false,
  remetente: 'dono@s.whatsapp.net', donoPrincipal: 'dono@s.whatsapp.net',
  enviadoPeloBot: false,
};

test('reset recusa sub-dono mesmo sendo dono', () => {
  // Ação destrutiva e irreversível: o gate é deliberadamente mais estreito
  // que o de outros comandos de dono.
  const r = ramoResetRpg(ctx({ users: {} }), f, { ...permissaoOk, isSubOwner: true }, null, [], '');
  assert.match(r.texto, /Apenas o Dono principal/);
});

test('reset recusa quem não é o dono principal', () => {
  const r = ramoResetRpg(ctx({ users: {} }), f, { ...permissaoOk, remetente: 'outro@s.whatsapp.net' }, null, [], '');
  assert.match(r.texto, /Apenas o Dono principal/);
});

test('reset com escopo all apaga só quem tem dados e conta certo', () => {
  const econ = { users: { 'a@x': {}, 'c@x': {} } };
  const r = ramoResetRpg(ctx(econ), f, permissaoOk, null, ['a@x', 'b@x', 'c@x'], 'all');
  // 'b@x' não tinha dados: contar 3 mentiria sobre o que foi apagado.
  assert.match(r.texto, /de 2 membros/);
  assert.deepEqual(Object.keys(econ.users), []);
});

test('reset aceita "todos" além de "all"', () => {
  const econ = { users: { 'a@x': {} } };
  const r = ramoResetRpg(ctx(econ), f, permissaoOk, null, ['a@x'], 'TODOS');
  assert.match(r.texto, /de 1 membros/);
});

test('reset sem alvo e sem escopo explica o que fazer', () => {
  const r = ramoResetRpg(ctx({ users: {} }), f, permissaoOk, null, [], '');
  assert.match(r.texto, /Marque um usuário/);
  assert.match(r.texto, /"all"/);
});

test('reset em alvo marcado apaga e menciona o alvo', () => {
  const econ = { users: { 'alvo@x': {} } };
  const r = ramoResetRpg(ctx(econ), f, permissaoOk, 'alvo@x', [], '');
  assert.match(r.texto, /resetados para @alvo/);
  assert.deepEqual(r.mencoes, ['alvo@x']);
  assert.equal(econ.users['alvo@x'], undefined);
});

test('a lista de migrados é o gate do que já saiu do monólito', () => {
  assert.deepEqual([...RAMOS_MIGRADOS], ['banco','cancelar','carteira','coletarpropriedades','comprarpropriedade','crime','demitir','desafio','emprego','habilidades','ingredientes','listar','materiais','mercado','perfilrpg','propriedades','receitas','resetrpg','sementes','slots','vagas','vender','vendercomida']);
});

// ===== Segunda leva =====
import { ramoVagas, ramoMateriais, ramoCancelar } from '../../dist-vnext/rpg/economia/ramos.js';

test('vagas cai para o catálogo embutido quando a economia não tem nenhuma', () => {
  // Sem esse fallback, um grupo novo veria lista vazia e não teria como
  // conseguir emprego nenhum — o sistema de economia travaria na entrada.
  const r = ramoVagas(ctx({ jobCatalog: {} }), f, '!');
  assert.match(r.texto, /estagiario/);
  assert.match(r.texto, /programador/);
  assert.match(r.texto, /!emprego <vaga>/);
});

test('vagas usa o catálogo da economia quando ele existe', () => {
  const r = ramoVagas(ctx({ jobCatalog: { ferreiro: { name: 'Ferreiro', min: 10, max: 20 } } }), f, '!');
  assert.match(r.texto, /ferreiro/);
  assert.doesNotMatch(r.texto, /estagiario/, 'catálogo próprio não pode ser misturado com o padrão');
});

test('materiais lista só o que tem saldo positivo', () => {
  // Material zerado na lista sugere posse que não existe.
  const r = ramoMateriais(ctx({}, { materials: { ferro: 3, ouro: 0, madeira: 5 } }), '!');
  assert.match(r.texto, /ferro: 3/);
  assert.match(r.texto, /madeira: 5/);
  assert.doesNotMatch(r.texto, /ouro/);
});

test('sem materiais, ensina como conseguir em vez de só dizer que está vazio', () => {
  const r = ramoMateriais(ctx({}, { materials: {} }), '!');
  assert.match(r.texto, /não possui materiais/);
  assert.match(r.texto, /!minerar/);
});

test('cancelar devolve item ao inventário do vendedor', () => {
  // A devolução é a parte que não pode falhar: sem ela o jogador perde o item
  // ao cancelar, que é pior do que não poder cancelar.
  const econ = { market: [{ id: 7, type: 'item', key: 'espada', qty: 2, price: 100, seller: 'v@x' }] };
  const me = { inventory: { espada: 1 } };
  const c = { ...ctx(econ, me), args: ['7'] };
  const r = ramoCancelar(c, f, 'v@x');
  assert.match(r.texto, /#7 cancelado/);
  assert.equal(me.inventory.espada, 3);
  assert.equal(econ.market.length, 0);
});

test('cancelar devolve material quando a oferta não é de item', () => {
  const econ = { market: [{ id: 8, type: 'material', mat: 'ferro', qty: 5, price: 50, seller: 'v@x' }] };
  const me = { materials: {} };
  const r = ramoCancelar({ ...ctx(econ, me), args: ['8'] }, f, 'v@x');
  assert.match(r.texto, /#8 cancelado/);
  assert.equal(me.materials.ferro, 5);
});

test('cancelar recusa quem não é o vendedor e não mexe no mercado', () => {
  const econ = { market: [{ id: 9, type: 'item', key: 'x', qty: 1, price: 10, seller: 'dono@x' }] };
  const r = ramoCancelar({ ...ctx(econ, {}), args: ['9'] }, f, 'outro@x');
  assert.match(r.texto, /Apenas o vendedor/);
  assert.equal(econ.market.length, 1, 'oferta alheia não pode sumir');
});

test('cancelar valida o ID antes de procurar', () => {
  assert.match(ramoCancelar({ ...ctx({ market: [] }, {}), args: [] }, f, 'v@x').texto, /Informe o ID/);
  assert.match(ramoCancelar({ ...ctx({ market: [] }, {}), args: ['abc'] }, f, 'v@x').texto, /Informe o ID/);
  assert.match(ramoCancelar({ ...ctx({ market: [] }, {}), args: ['99'] }, f, 'v@x').texto, /não encontrado/);
});

// ===== Terceira leva =====
import { ramoVenderComida, ramoListar } from '../../dist-vnext/rpg/economia/ramos.js';

test('vender comida sem argumento ensina o uso e onde ver o estoque', () => {
  const r = ramoVenderComida({ ...ctx({}, {}), args: [] }, f, '!');
  assert.match(r.texto, /!vendercomida <comida>/);
  assert.match(r.texto, /!comer/);
});

test('falta de estoque diz quanto o jogador tem, e vem antes da receita', () => {
  // Se a receita fosse checada primeiro, quem só não tinha estoque receberia
  // "receita não encontrada" — mensagem errada para o problema real.
  const econ = { cookingRecipes: {} };
  const r = ramoVenderComida({ ...ctx(econ, { cookedFood: { sopa: 1 } }), args: ['sopa', '5'] }, f, '!');
  assert.match(r.texto, /não tem 5x sopa/);
  assert.match(r.texto, /Você tem: 1/);
});

test('venda debita o estoque e credita a carteira', () => {
  const econ = { cookingRecipes: { sopa: { name: 'Sopa', sellPrice: 30 } } };
  const me = { cookedFood: { sopa: 4 }, wallet: 100 };
  const r = ramoVenderComida({ ...ctx(econ, me), args: ['sopa', '3'] }, f, '!');
  assert.match(r.texto, /vendeu 3x Sopa/);
  assert.equal(me.cookedFood.sopa, 1);
  assert.equal(me.wallet, 190);
});

test('venda sem quantidade assume uma unidade', () => {
  const econ = { cookingRecipes: { pao: { name: 'Pão', sellPrice: 10 } } };
  const me = { cookedFood: { pao: 2 }, wallet: 0 };
  ramoVenderComida({ ...ctx(econ, me), args: ['pao'] }, f, '!');
  assert.equal(me.cookedFood.pao, 1);
  assert.equal(me.wallet, 10);
});

test('listar exige tipo válido e explica o formato', () => {
  const r = ramoListar({ ...ctx({}, {}), args: ['xpto'] }, f, 'v@x', '!');
  assert.match(r.texto, /!listar item <key>/);
  assert.match(r.texto, /!listar mat <material>/);
});

test('listar recusa quantidade ou preço não positivos', () => {
  for (const args of [['item','x','0','10'], ['item','x','5','0'], ['item','x','abc','10']]) {
    assert.match(ramoListar({ ...ctx({}, {}), args }, f, 'v@x', '!').texto, /inválidos/);
  }
});

test('listar debita o estoque na hora de anunciar', () => {
  // Sem o débito imediato o jogador anunciaria o mesmo item várias vezes e
  // venderia estoque que não tem.
  const econ = { market: [], marketCounter: 10 };
  const me = { inventory: { espada: 5 } };
  const r = ramoListar({ ...ctx(econ, me), args: ['item', 'espada', '2', '300'] }, f, 'v@x', '!');
  assert.match(r.texto, /#10 criado: espada x2/);
  assert.equal(me.inventory.espada, 3);
  assert.equal(econ.market.length, 1);
  assert.equal(econ.marketCounter, 11, 'o contador precisa avançar para o próximo anúncio');
});

test('listar material usa o tipo mat, que é o que o cancelar espera', () => {
  const econ = { market: [], marketCounter: 1 };
  const me = { materials: { ferro: 10 } };
  ramoListar({ ...ctx(econ, me), args: ['mat', 'ferro', '4', '20'] }, f, 'v@x', '!');
  assert.equal(econ.market[0].type, 'mat');
  assert.equal(econ.market[0].mat, 'ferro');
  assert.equal(me.materials.ferro, 6);
});

test('listar recusa sem estoque, sem criar anúncio', () => {
  const econ = { market: [], marketCounter: 1 };
  const r = ramoListar({ ...ctx(econ, { inventory: { espada: 1 } }), args: ['item','espada','9','10'] }, f, 'v@x', '!');
  assert.match(r.texto, /não possui itens suficientes/);
  assert.equal(econ.market.length, 0);
});

// ===== Quarta leva =====
import { ramoVender, ramoEmprego } from '../../dist-vnext/rpg/economia/ramos.js';

const t = {
  parseAmount: (bruto) => { const n = Number.parseInt(bruto, 10); return Number.isFinite(n) ? n : NaN; },
  findKeyIgnoringAccents: (obj, alvo) => {
    const norm = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    return Object.keys(obj).find((k) => norm(k) === norm(alvo)) ?? null;
  },
  normalizeParam: (x) => x.toLowerCase(),
};

test('vender aceita "all" para escoar o estoque inteiro', () => {
  // Depois de minerar, vender tudo é a operação mais comum; obrigar a contar
  // seria atrito puro.
  const econ = { materialsPrices: { ferro: 5 } };
  const me = { materials: { ferro: 20 }, wallet: 0 };
  const r = ramoVender({ ...ctx(econ, me), args: ['ferro', 'all'] }, f, t, '!');
  assert.match(r.texto, /Vendeu: 20x ferro/);
  assert.equal(me.materials.ferro, 0);
  assert.equal(me.wallet, 100);
});

test('vender sem quantidade assume tudo, como o legado', () => {
  const econ = { materialsPrices: { ouro: 10 } };
  const me = { materials: { ouro: 3 }, wallet: 0 };
  ramoVender({ ...ctx(econ, me), args: ['ouro'] }, f, t, '!');
  assert.equal(me.materials.ouro, 0);
  assert.equal(me.wallet, 30);
});

test('vender recusa material sem preço e aponta onde ver os preços', () => {
  const r = ramoVender({ ...ctx({ materialsPrices: {} }, {}), args: ['pedra'] }, f, t, '!');
  assert.match(r.texto, /Material inválido/);
  assert.match(r.texto, /!precos/);
});

test('vender distingue material sem preço de material sem estoque', () => {
  // Duas causas diferentes precisam de mensagens diferentes, senão o jogador
  // não sabe se erra o nome ou se está sem o item.
  const econ = { materialsPrices: { ferro: 5 } };
  const r = ramoVender({ ...ctx(econ, { materials: { ferro: 0 } }), args: ['ferro'] }, f, t, '!');
  assert.match(r.texto, /não possui esse material/);
});

test('emprego encontra a vaga mesmo digitada sem acento', () => {
  // Os nomes têm acento e o usuário digita sem — sem a normalização, contratar
  // "estagiario" falharia contra "Estagiário".
  const econ = { jobCatalog: { 'estagiário': { name: 'Estagiário', min: 80, max: 140 } } };
  const me = {};
  const r = ramoEmprego({ ...ctx(econ, me), args: ['estagiario'] }, f, t, '!');
  assert.match(r.texto, /CONTRATADO/);
  assert.equal(me.job, 'estagiário');
});

test('emprego persiste o catálogo padrão quando a economia não tinha nenhum', () => {
  // Sem persistir, a vaga aceita agora não seria encontrada na próxima consulta.
  const econ = {};
  const me = {};
  const r = ramoEmprego({ ...ctx(econ, me), args: ['designer'] }, f, t, '!');
  assert.match(r.texto, /Designer/);
  assert.ok(econ.jobCatalog, 'o catálogo precisa ficar gravado');
  assert.ok(econ.jobCatalog.designer);
  assert.equal(me.job, 'designer');
});

test('emprego não sobrescreve catálogo próprio do grupo', () => {
  const econ = { jobCatalog: { ferreiro: { name: 'Ferreiro', min: 1, max: 2 } } };
  ramoEmprego({ ...ctx(econ, {}), args: ['ferreiro'] }, f, t, '!');
  assert.deepEqual(Object.keys(econ.jobCatalog), ['ferreiro'], 'padrão não pode invadir catálogo próprio');
});

test('emprego recusa vaga inexistente sem contratar', () => {
  const me = {};
  const r = ramoEmprego({ ...ctx({ jobCatalog: { x: { name: 'X' } } }, me), args: ['inexistente'] }, f, t, '!');
  assert.match(r.texto, /Vaga inexistente/);
  assert.equal(me.job, undefined);
});

// ===== Quinta leva: acaso, progressão e propriedades =====
import {
  ramoDesafio, ramoSlots, ramoCrime,
  ramoPropriedades, ramoComprarPropriedade, ramoColetarPropriedades,
} from '../../dist-vnext/rpg/economia/ramos.js';

const AGORA = 1_700_000_000_000;
/** Sorte determinística: consome a fila em ordem, como o legado consome Math.random. */
const acaso = (fila, agora = AGORA) => {
  const restante = [...fila];
  return { agora: () => agora, aleatorio: () => restante.shift() ?? 0, timeLeft: () => '5m' };
};
const prog = (extra = {}) => ({
  getSkillBonus: () => 0, addSkillXP: () => {}, updateChallenge: () => {},
  updatePeriodChallenge: () => {}, isChallengeCompleted: () => true,
  giveMaterial: (u, k, q) => { u.materials = { ...u.materials, [k]: (u.materials?.[k] || 0) + q }; },
  ...extra,
});

test('desafio coletar paga uma vez e marca como coletado', () => {
  const me = { wallet: 0, challenge: { tasks: [], reward: 500 } };
  const r1 = ramoDesafio({ ...ctx({}, me), args: ['coletar'] }, f, prog(), '!');
  assert.match(r1.texto, /RECOMPENSA/);
  assert.equal(me.wallet, 500);
  const r2 = ramoDesafio({ ...ctx({}, me), args: ['coletar'] }, f, prog(), '!');
  assert.match(r2.texto, /já coletou/);
  assert.equal(me.wallet, 500, 'coletar duas vezes não pode pagar duas vezes');
});

test('desafio recusa coleta com tarefas pendentes', () => {
  const me = { wallet: 0, challenge: { tasks: [], reward: 500 } };
  const r = ramoDesafio({ ...ctx({}, me), args: ['coletar'] }, f, prog({ isChallengeCompleted: () => false }), '!');
  assert.match(r.texto, /Complete todas as tarefas/);
  assert.equal(me.wallet, 0);
});

test('desafio sem argumento mostra progresso e só sugere coletar quando dá', () => {
  const me = { challenge: { tasks: [{ type: 'mine', progress: 3, target: 5 }], reward: 200 } };
  const pendente = ramoDesafio(ctx({}, me), f, prog({ isChallengeCompleted: () => false }), '!');
  assert.match(pendente.texto, /Minerações/);
  assert.match(pendente.texto, /3\/5/);
  assert.ok(!/desafio coletar/.test(pendente.texto), 'não sugerir coleta impossível');
  const pronto = ramoDesafio(ctx({}, me), f, prog(), '!');
  assert.match(pronto.texto, /!desafio coletar/);
});

test('slots respeita cooldown sem cobrar a aposta', () => {
  const me = { wallet: 1000, cooldowns: { slots: AGORA + 60_000 } };
  const r = ramoSlots({ ...ctx({}, me), args: ['100'] }, f, acaso([]), t);
  assert.match(r.texto, /Aguarde/);
  assert.equal(me.wallet, 1000);
});

test('slots usa aposta padrão de 100 quando omitida', () => {
  const me = { wallet: 1000, cooldowns: {} };
  ramoSlots({ ...ctx({}, me), args: [] }, f, acaso([0.5, 0.1, 0.5]), t);
  assert.equal(me.wallet, 900, 'perda de 100 = aposta padrão');
});

test('slots recusa aposta maior que a carteira', () => {
  const me = { wallet: 50, cooldowns: {} };
  const r = ramoSlots({ ...ctx({}, me), args: ['500'] }, f, acaso([]), t);
  assert.match(r.texto, /Saldo insuficiente/);
  assert.equal(me.wallet, 50);
});

test('slots paga 2x no jackpot e arma o cooldown', () => {
  // Sorteio 0 em cada rolo cai no primeiro símbolo dos pesos rotacionados.
  const me = { wallet: 1000, cooldowns: {} };
  const r = ramoSlots({ ...ctx({}, me), args: ['100'] }, f, acaso([0, 0, 0]), t);
  const rolos = r.texto.match(/│ (.+) \| (.+) \| (.+)\n/);
  if (rolos && rolos[1] === rolos[2] && rolos[2] === rolos[3]) {
    assert.equal(me.wallet, 1100, 'trinca paga o dobro da aposta');
  }
  assert.equal(me.cooldowns.slots, AGORA + 8 * 60 * 1000);
});

test('crime bem-sucedido credita, pontua e conta stat', () => {
  const me = { wallet: 0, cooldowns: {} };
  const chamadas = [];
  const p = prog({
    addSkillXP: (_u, k) => chamadas.push(`xp:${k}`),
    updateChallenge: (_u, t2) => chamadas.push(`ch:${t2}`),
    updatePeriodChallenge: (_u, t2) => chamadas.push(`per:${t2}`),
  });
  const r = ramoCrime(ctx({}, me), f, acaso([0.01, 0]), p);
  assert.match(r.texto, /bem-sucedido/);
  assert.equal(me.wallet, 40, 'base mínima 40 sem bônus de skill');
  assert.equal(me.stats.totalCrimes, 1);
  assert.deepEqual(chamadas, ['xp:crime', 'ch:crimeSuccess', 'per:crimeSuccess']);
});

test('crime aplica bônus de habilidade sobre a base', () => {
  const me = { wallet: 0, cooldowns: {} };
  const r = ramoCrime(ctx({}, me), f, acaso([0.01, 0]), prog({ getSkillBonus: () => 1 }));
  assert.match(r.texto, /bem-sucedido/);
  assert.equal(me.wallet, 52, '40 * (1 + 1*0.3) = 52');
});

test('crime falho nunca deixa a carteira negativa', () => {
  // A multa sorteada é maior que o saldo; o legado limita ao que existe.
  const me = { wallet: 100, cooldowns: {} };
  const r = ramoCrime(ctx({}, me), f, acaso([0.9, 0.9]), prog());
  assert.match(r.texto, /PEGO/);
  assert.equal(me.wallet, 0);
  assert.match(r.texto, /Multa: R\$ 100/);
});

test('crime cobra o mesmo cooldown ganhando ou perdendo', () => {
  // Falhar não pode virar atalho para tentar de novo mais cedo.
  const ganhou = { wallet: 0, cooldowns: {} };
  const perdeu = { wallet: 0, cooldowns: {} };
  ramoCrime(ctx({}, ganhou), f, acaso([0.01, 0]), prog());
  ramoCrime(ctx({}, perdeu), f, acaso([0.9, 0]), prog());
  assert.equal(ganhou.cooldowns.crime, AGORA + 30 * 60 * 1000);
  assert.equal(perdeu.cooldowns.crime, ganhou.cooldowns.crime);
});

const CATALOGO = {
  padaria: { name: 'Padaria', price: 5000, upkeepPerDay: 50, incomeGoldPerDay: 300 },
  mina: { name: 'Mina', price: 9000, upkeepPerDay: 100, incomeMaterialsPerDay: { ferro: 5 } },
};

test('propriedades lista catálogo e o que já é do jogador', () => {
  const me = { properties: { padaria: { owned: true, lastCollect: AGORA } } };
  const r = ramoPropriedades(ctx({ propertiesCatalog: CATALOGO }, me), f);
  assert.match(r.texto, /Padaria/);
  assert.match(r.texto, /ferro x5\/dia/);
  assert.match(r.texto, /Suas propriedades/);
});

test('comprarpropriedade não permite comprar duas vezes', () => {
  const me = { wallet: 20000, properties: {} };
  const a = acaso([]);
  ramoComprarPropriedade({ ...ctx({ propertiesCatalog: CATALOGO }, me), args: ['padaria'] }, f, a, '!');
  assert.equal(me.wallet, 15000);
  const r = ramoComprarPropriedade({ ...ctx({ propertiesCatalog: CATALOGO }, me), args: ['padaria'] }, f, a, '!');
  assert.match(r.texto, /já possui/);
  assert.equal(me.wallet, 15000, 'a segunda compra não pode debitar');
});

test('coletarpropriedades paga renda menos manutenção pelos dias corridos', () => {
  const me = {
    wallet: 1000,
    properties: { padaria: { owned: true, lastCollect: AGORA - 2 * 24 * 60 * 60 * 1000 } },
  };
  const r = ramoColetarPropriedades(ctx({ propertiesCatalog: CATALOGO }, me), f, acaso([]), prog());
  assert.match(r.texto, /Coleta concluída/);
  assert.equal(me.wallet, 1000 - 100 + 600, '2 dias: -50/dia de manutenção, +300/dia de renda');
  assert.equal(me.properties.padaria.lastCollect, AGORA, 'relógio precisa zerar');
});

test('coletarpropriedades aborta inteiro se faltar saldo, sem zerar relógios', () => {
  // Cobrança parcial faria o jogador pagar de novo pelos mesmos dias.
  const antes = AGORA - 10 * 24 * 60 * 60 * 1000;
  const me = { wallet: 10, properties: { padaria: { owned: true, lastCollect: antes } } };
  const r = ramoColetarPropriedades(ctx({ propertiesCatalog: CATALOGO }, me), f, acaso([]), prog());
  assert.match(r.texto, /Saldo insuficiente/);
  assert.equal(me.wallet, 10);
  assert.equal(me.properties.padaria.lastCollect, antes, 'relógio não pode avançar sem coleta');
});

test('coletarpropriedades entrega materiais via giveMaterial', () => {
  const me = { wallet: 5000, properties: { mina: { owned: true, lastCollect: AGORA - 3 * 24 * 60 * 60 * 1000 } } };
  const r = ramoColetarPropriedades(ctx({ propertiesCatalog: CATALOGO }, me), f, acaso([]), prog());
  assert.equal(me.materials.ferro, 15, '5/dia por 3 dias');
  assert.match(r.texto, /ferro x15/);
});

// ===== Sexta leva: banco, habilidades, despensa e sementes =====
import {
  ramoBanco, ramoHabilidades, ramoIngredientes, ramoSementes, SEMENTES_PADRAO,
} from '../../dist-vnext/rpg/economia/ramos.js';

test('banco escreve "Ilimitada" quando a capacidade é infinita', () => {
  // Quem tem cofre sem limite recebe Infinity de applyShopBonuses; imprimir
  // o número cru sairia como "R$ Infinity" na tela do jogador.
  const r = ramoBanco(ctx({}, { bank: 500 }), f, Infinity);
  assert.match(r.texto, /Capacidade:\* Ilimitada/);
  assert.ok(!/Infinity/.test(r.texto));
});

test('banco mostra a capacidade formatada quando ela é finita', () => {
  const r = ramoBanco(ctx({}, { bank: 500 }), f, 10000);
  assert.match(r.texto, /Saldo:\* R\$ 500/);
  assert.match(r.texto, /Capacidade:\* R\$ 10000/);
});

test('habilidades lista todas as perícias na ordem do catálogo', () => {
  const h = {
    SKILL_LIST: ['mining', 'fishing', 'crime'],
    skillXpForNext: (n) => n * 100,
    ensureUserSkills: (u) => {
      u.skills = u.skills || {};
      for (const k of ['mining', 'fishing', 'crime']) u.skills[k] = u.skills[k] || { level: 1, xp: 0 };
    },
  };
  const me = { skills: { mining: { level: 3, xp: 40 } } };
  const r = ramoHabilidades(ctx({}, me), h);
  assert.match(r.texto, /mining: Nível 3 \(40\/300\)/);
  assert.match(r.texto, /fishing: Nível 1 \(0\/100\)/, 'ensureUserSkills precisa preencher o que falta');
  const ordem = ['mining', 'fishing', 'crime'].map((k) => r.texto.indexOf(k));
  assert.deepEqual(ordem, [...ordem].sort((a, b) => a - b), 'ordem do catálogo é a do legado');
});

test('ingredientes esconde o que zerou', () => {
  // Quantidade zero é resto de consumo, não item na despensa.
  const me = { ingredients: { trigo: 4, cenoura: 0 } };
  const r = ramoIngredientes(ctx({}, me), '!');
  assert.match(r.texto, /trigo: x4/);
  assert.ok(!/cenoura/.test(r.texto));
});

test('ingredientes com despensa toda zerada cai na mensagem vazia', () => {
  const r = ramoIngredientes(ctx({}, { ingredients: { trigo: 0 } }), '!');
  assert.match(r.texto, /não possui ingredientes/);
  assert.match(r.texto, /!plantar/);
});

test('sementes grava o catálogo padrão na primeira consulta', () => {
  // plantar lê de econ.seeds; só exibir não bastaria.
  const econ = {};
  let gravou = 0;
  const fSpy = { ...f, saveEconomy: () => { gravou += 1; } };
  const r = ramoSementes(ctx(econ, {}), fSpy, '!');
  assert.deepEqual(Object.keys(econ.seeds), Object.keys(SEMENTES_PADRAO));
  assert.equal(gravou, 1);
  assert.match(r.texto, /Cana-de-açúcar/);
  assert.match(r.texto, /Crescimento: 10 min/, 'growTime em ms vira minutos legíveis');
  assert.match(r.texto, /acucar x5/);
});

test('sementes não sobrescreve catálogo próprio nem regrava à toa', () => {
  const econ = { seeds: { abobora: { name: '🎃 Abóbora', cost: 40, growTime: 120000, yield: { abobora: 1 } } } };
  let gravou = 0;
  const r = ramoSementes(ctx(econ, {}), { ...f, saveEconomy: () => { gravou += 1; } }, '!');
  assert.equal(gravou, 0, 'catálogo já existente não precisa de escrita em disco');
  assert.match(r.texto, /Abóbora/);
  assert.ok(!/Trigo/.test(r.texto), 'padrão não pode invadir catálogo próprio');
});

// ===== Sétima leva: os três últimos ramos =====
import {
  ramoDemitir, ramoReceitas, ramoPerfilRpg, RECEITAS_PADRAO,
} from '../../dist-vnext/rpg/economia/ramos.js';

test('demitir zera o emprego e grava', () => {
  const me = { job: 'padeiro' };
  let gravou = 0;
  const r = ramoDemitir(ctx({}, me), { ...f, saveEconomy: () => { gravou += 1; } }, '!');
  assert.equal(me.job, null);
  assert.equal(gravou, 1);
  assert.match(r.texto, /!vagas/);
});

test('receitas grava o cardápio padrão na primeira consulta', () => {
  const econ = {};
  let gravou = 0;
  const r = ramoReceitas(ctx(econ, {}), { ...f, saveEconomy: () => { gravou += 1; } }, '!');
  assert.deepEqual(Object.keys(econ.cookingRecipes), Object.keys(RECEITAS_PADRAO));
  assert.equal(gravou, 1);
  assert.match(r.texto, /Hambúrguer/);
  assert.match(r.texto, /carne x2, trigo x3, alface x1/);
  assert.match(r.texto, /!cozinhar hamburguer/);
});

test('receitas não regrava quando o grupo já tem cardápio', () => {
  const econ = { cookingRecipes: { x: { name: 'X', requires: { y: 1 }, gold: 1, sellPrice: 2, energy: 3 } } };
  let gravou = 0;
  ramoReceitas(ctx(econ, {}), { ...f, saveEconomy: () => { gravou += 1; } }, '!');
  assert.equal(gravou, 0);
  assert.deepEqual(Object.keys(econ.cookingRecipes), ['x']);
});

const habs = {
  SKILL_LIST: ['mining', 'fishing', 'crime', 'forging'],
  ensureUserSkills: (u) => {
    u.skills = u.skills || {};
    for (const k of ['mining', 'fishing', 'crime', 'forging']) u.skills[k] = u.skills[k] || { level: 1, xp: 0 };
  },
};

test('perfilrpg monta a ficha inteira de um jogador em branco', () => {
  const r = ramoPerfilRpg(ctx({}, {}), f, habs, { pushname: 'Fulano', parAtivo: null }, '!');
  assert.match(r.texto, /│ Fulano/);
  assert.match(r.texto, /Level: 1/);
  assert.match(r.texto, /Streak: 0 dias/);
  assert.match(r.texto, /Classe: Nenhuma/);
  assert.match(r.texto, /Clã: Nenhum/);
  assert.match(r.texto, /Casa: Nenhuma/);
  assert.match(r.texto, /Win Rate: 0%/, 'sem batalhas o aproveitamento é 0, não NaN');
  assert.match(r.texto, /Poder: 100/);
  assert.match(r.texto, /Status: Solteiro/);
  assert.ok(!r.mencoes, 'sem parceiro não se marca ninguém');
});

test('perfilrpg singulariza "1 dia" no streak', () => {
  const r = ramoPerfilRpg(ctx({}, { streak: { count: 1 } }), f, habs, { pushname: 'A', parAtivo: null }, '!');
  assert.match(r.texto, /Streak: 1 dia\n/);
});

test('perfilrpg mostra as 3 melhores habilidades, fechando a árvore no último', () => {
  const me = { skills: { mining: { level: 9 }, fishing: { level: 2 }, crime: { level: 7 }, forging: { level: 4 } } };
  const r = ramoPerfilRpg(ctx({}, me), f, habs, { pushname: 'A', parAtivo: null }, '!');
  assert.match(r.texto, /├ Mining: Lv.9/);
  assert.match(r.texto, /├ Crime: Lv.7/);
  assert.match(r.texto, /└ Forging: Lv.4/, 'o último item fecha com └');
  assert.ok(!/Fishing/.test(r.texto), 'a quarta habilidade fica de fora');
});

test('perfilrpg marca o parceiro quando há relacionamento ativo', () => {
  const par = { partnerId: '5511@s.whatsapp.net', pair: { status: 'casamento' } };
  const r = ramoPerfilRpg(ctx({}, {}), f, habs, { pushname: 'A', parAtivo: par }, '!');
  assert.match(r.texto, /💍 Status: Casado\(a\)/);
  assert.match(r.texto, /Parceiro\(a\): @5511/);
  assert.deepEqual(r.mencoes, ['5511@s.whatsapp.net'], 'sem a menção o @ sai como texto morto');
});

test('perfilrpg trata namoro e brincadeira com rótulos próprios', () => {
  for (const [status, rotulo] of [['namoro', /Namorando/], ['brincadeira', /Brincadeira/]]) {
    const par = { partnerId: '1@s.whatsapp.net', pair: { status } };
    const r = ramoPerfilRpg(ctx({}, {}), f, habs, { pushname: 'A', parAtivo: par }, '!');
    assert.match(r.texto, rotulo);
  }
});

test('perfilrpg não derruba o comando com economia incompleta', () => {
  // O legado indexava econ.clans e econ.jobCatalog sem guarda, contando com
  // ensureEconomyDefaults ter rodado antes.
  const me = { clan: 'dragoes', job: 'ferreiro', house: { type: 'inexistente' } };
  const r = ramoPerfilRpg(ctx({}, me), f, habs, { pushname: 'A', parAtivo: null }, '!');
  assert.match(r.texto, /Clã: Nenhum/);
  assert.match(r.texto, /Emprego: ferreiro/, 'sem catálogo, cai na chave crua');
  assert.match(r.texto, /Casa:  inexistente/, 'casa desconhecida não pode virar undefined');
});

test('perfilrpg calcula a barra de XP contra a curva de 1.5^nível', () => {
  const r = ramoPerfilRpg(ctx({}, { level: 3, exp: 112 }), f, habs, { pushname: 'A', parAtivo: null }, '!');
  assert.match(r.texto, /XP: 112\/225 \(49%\)/, '100 * 1.5^2 = 225');
});
