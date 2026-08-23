import test from 'node:test';
import assert from 'node:assert/strict';
import { reacaoDoComando, temaDoComando, reacoesDistintas } from '../../dist-vnext/voice/reacoes.js';

test('a mesma reação sai sempre para o mesmo comando', () => {
  // Reação que muda a cada chamada é pior que reação repetida: o usuário
  // percebe o sorteio e ela deixa de significar alguma coisa.
  for (const cmd of ['play', 'ban', 'perfil', 'minerar']) {
    const primeira = reacaoDoComando(cmd);
    for (let i = 0; i < 20; i += 1) assert.equal(reacaoDoComando(cmd), primeira);
  }
});

test('comandos do mesmo assunto não recebem todos a mesma reação', () => {
  // Era o defeito antigo: um emoji por intenção fazia toda a família sair
  // idêntica.
  const familia = ['play', 'musica', 'song', 'audio', 'letra'];
  const distintas = new Set(familia.map(reacaoDoComando));
  assert.ok(distintas.size >= 3, `esperado variedade dentro do tema, veio ${distintas.size}`);
});

test('radical curto não sequestra comando de outro assunto', () => {
  // "banco" contém "ban". Antes disso ser tratado, saldo bancário reagia com
  // martelo de banimento.
  assert.notEqual(reacaoDoComando('banco'), reacaoDoComando('ban'));
  assert.deepEqual(temaDoComando('banco'), temaDoComando('carteira'));
  assert.deepEqual(temaDoComando('ban'), temaDoComando('kick'));
});

test('assunto mais específico vence o mais genérico', () => {
  // playvid é vídeo, embora contenha "play"; forca é jogo, embora "forj" seja RPG.
  assert.deepEqual(temaDoComando('playvid'), temaDoComando('video'));
  assert.deepEqual(temaDoComando('forca'), temaDoComando('quiz'));
  assert.deepEqual(temaDoComando('tiktok'), temaDoComando('kwai'));
});

test('comando desconhecido recebe reação neutra em vez de falhar', () => {
  // Reação é enfeite; enfeite não derruba comando.
  for (const cmd of ['', 'xyzabc123', null, undefined]) {
    const r = reacaoDoComando(cmd);
    assert.equal(typeof r, 'string');
    assert.ok(r.length > 0);
  }
});

test('o catálogo cobre muito mais que o mapa por intenção', () => {
  // O mapa anterior tinha 19 emojis para mais de 500 famílias de comando.
  assert.ok(reacoesDistintas() >= 90, `catálogo pequeno demais: ${reacoesDistintas()}`);
});
