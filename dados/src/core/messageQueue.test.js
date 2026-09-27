import assert from 'node:assert/strict';
import test from 'node:test';

import { MessageQueue, chavesDeJustica } from './messageQueue.js';

/**
 * O dono definiu o alvo: até 4 comandos simultâneos por pessoa e por grupo.
 * O desenho anterior processava ondas com barreira, então um comando lento
 * segurava todo mundo que chegasse depois, inclusive de outros grupos.
 */

const PESSOA_A = '5511900000001@s.whatsapp.net';
const PESSOA_B = '5511900000002@s.whatsapp.net';
const GRUPO_1 = '120363000000000001@g.us';
const GRUPO_2 = '120363000000000002@g.us';

function msgGrupo(grupo, pessoa) {
  return { key: { remoteJid: grupo, participant: pessoa } };
}

function msgPrivado(pessoa) {
  return { key: { remoteJid: pessoa } };
}

/** Processor que só resolve quando o teste mandar, para observar simultaneidade. */
function processadorControlado() {
  const emVoo = [];
  const processor = () =>
    new Promise((resolve, reject) => {
      emVoo.push({ resolve, reject });
    });
  return { processor, emVoo };
}

const respiro = () => new Promise((r) => setTimeout(r, 0));

test('chavesDeJustica separa grupo de privado', () => {
  assert.deepEqual(chavesDeJustica(msgGrupo(GRUPO_1, PESSOA_A)), { pessoa: PESSOA_A, grupo: GRUPO_1 });
  // No privado o próprio chat identifica a pessoa e não há grupo a limitar.
  assert.deepEqual(chavesDeJustica(msgPrivado(PESSOA_A)), { pessoa: PESSOA_A, grupo: null });
});

test('uma pessoa executa no máximo 4 comandos ao mesmo tempo', async () => {
  const fila = new MessageQueue(20, 4, 4);
  const { processor, emVoo } = processadorControlado();

  for (let i = 0; i < 7; i++) fila.add(msgPrivado(PESSOA_A), processor);
  await respiro();

  assert.equal(emVoo.length, 4, 'só 4 podem estar em voo');
  assert.equal(fila.queue.length, 3, 'os outros 3 ficam na fila');

  emVoo[0].resolve('ok');
  await respiro();
  assert.equal(emVoo.length, 5, 'slot liberado precisa puxar o próximo na hora');
});

test('um grupo executa no máximo 4, mesmo com pessoas diferentes', async () => {
  const fila = new MessageQueue(20, 4, 4);
  const { processor, emVoo } = processadorControlado();

  for (let i = 0; i < 6; i++) {
    fila.add(msgGrupo(GRUPO_1, `55119000000${i}@s.whatsapp.net`), processor);
  }
  await respiro();

  assert.equal(emVoo.length, 4, 'o teto do grupo vale mesmo com remetentes distintos');
});

test('pessoa no limite NÃO bloqueia quem está atrás na fila', async () => {
  const fila = new MessageQueue(20, 4, 4);
  const { processor, emVoo } = processadorControlado();

  // A satura o próprio limite...
  for (let i = 0; i < 6; i++) fila.add(msgPrivado(PESSOA_A), processor);
  // ...e B chega depois dos excedentes de A.
  fila.add(msgPrivado(PESSOA_B), processor);
  await respiro();

  // 4 de A + 1 de B. Era exatamente isto que a barreira de ondas impedia:
  // B ficava esperando A terminar.
  assert.equal(emVoo.length, 5);
  assert.equal(fila.queue.length, 2, 'só os excedentes de A continuam esperando');
});

test('grupo saturado não impede outro grupo de andar', async () => {
  const fila = new MessageQueue(20, 4, 4);
  const { processor, emVoo } = processadorControlado();

  for (let i = 0; i < 6; i++) fila.add(msgGrupo(GRUPO_1, PESSOA_A), processor);
  fila.add(msgGrupo(GRUPO_2, PESSOA_B), processor);
  await respiro();

  // 4 do grupo 1 (limitado tanto por grupo quanto por pessoa) + 1 do grupo 2.
  assert.equal(emVoo.length, 5);
});

test('teto global protege o processo acima dos limites individuais', async () => {
  const fila = new MessageQueue(6, 4, 4);
  const { processor, emVoo } = processadorControlado();

  for (let g = 0; g < 4; g++) {
    for (let i = 0; i < 3; i++) {
      fila.add(msgGrupo(`12036300000000000${g}@g.us`, `5511900000${g}${i}@s.whatsapp.net`), processor);
    }
  }
  await respiro();

  assert.equal(emVoo.length, 6, 'o teto global corta antes dos limites por grupo');
});

test('falha do comando libera o slot', async () => {
  const fila = new MessageQueue(20, 4, 4);
  const { processor, emVoo } = processadorControlado();

  const promessas = [];
  for (let i = 0; i < 5; i++) promessas.push(fila.add(msgPrivado(PESSOA_A), processor).catch(() => 'falhou'));
  await respiro();
  assert.equal(emVoo.length, 4);

  emVoo[0].reject(new Error('erro proposital'));
  await respiro();

  assert.equal(emVoo.length, 5, 'erro precisa liberar o slot como sucesso libera');
  assert.equal(await promessas[0], 'falhou');
});

test('contadores voltam a zero e não vazam memória', async () => {
  const fila = new MessageQueue(20, 4, 4);
  const { processor, emVoo } = processadorControlado();

  fila.add(msgGrupo(GRUPO_1, PESSOA_A), processor);
  await respiro();
  assert.equal(fila.ativosPorPessoa.size, 1);
  assert.equal(fila.ativosPorGrupo.size, 1);

  emVoo[0].resolve('ok');
  await respiro();

  assert.equal(fila.ativosGlobais, 0);
  // Chave zerada precisa sair do Map, senão a memória cresce sem teto ao longo
  // de dias com cada pessoa e cada grupo que já falou uma vez.
  assert.equal(fila.ativosPorPessoa.size, 0);
  assert.equal(fila.ativosPorGrupo.size, 0);
});

test('mensagem sem chave utilizável responde só ao teto global', async () => {
  const fila = new MessageQueue(20, 4, 4);
  const { processor, emVoo } = processadorControlado();

  for (let i = 0; i < 6; i++) fila.add({ key: {} }, processor);
  await respiro();

  // Melhor deixar passar do que travar o bot por não conseguir classificar.
  assert.equal(emVoo.length, 6);
});

test('shutdown drena o que está em voo antes de encerrar', async () => {
  const fila = new MessageQueue(20, 4, 4);
  const { processor, emVoo } = processadorControlado();

  fila.add(msgPrivado(PESSOA_A), processor);
  await respiro();
  assert.equal(fila.ativosGlobais, 1);

  const encerrando = fila.shutdown();
  await respiro();
  assert.equal(fila.ativosGlobais, 1, 'não pode desistir enquanto há comando em voo');

  emVoo[0].resolve('ok');
  await encerrando;
  assert.equal(fila.ativosGlobais, 0);
});
