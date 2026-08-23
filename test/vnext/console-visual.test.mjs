import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  larguraVisual,
  renderEventoFeed,
  textoSeguroParaTerminal,
} from '../../dist-vnext/console/feed.js';
import { renderConnectionPanel, renderShogun } from '../../dist-vnext/console/shogunPanel.js';

const ANSI = /\u001b\[[0-?]*[ -/]*[@-~]/g;
const semAnsi = (texto) => texto.replace(ANSI, '');

test('pixel art do Shogun fecha 64 colunas em todas as 25 linhas', () => {
  const arte = renderShogun();
  assert.equal(arte.length, 25);
  assert.ok(arte.every((linha) => larguraVisual(linha) === 64));
  assert.match(arte.join('\n'), /\u001b\[38;2;222;176;84m/); // chifres
  assert.match(arte.join('\n'), /\u001b\[38;2;22;40;58m/); // placas em aço azulado
  assert.match(arte.join('\n'), /\u001b\[38;2;52;88;116m/); // arestas horizontais
  assert.match(arte.join('\n'), /\u001b\[38;2;48;7;11m/); // profundidade curta da colina
  const fioKatana = arte.join('\n').match(/\u001b\[(?:38|48);2;72;82;94m/g) ?? [];
  assert.ok(fioKatana.length >= 1 && fioKatana.length <= 4,
    `katana voltou a dominar a composição: ${fioKatana.length} pixels claros`);
  const ocupacao = arte.map((linha) => semAnsi(linha).replaceAll(' ', '').length);
  const primeiraPintada = ocupacao.findIndex((total) => total > 0);
  const topoLua = ocupacao[primeiraPintada] ?? 0;
  assert.ok(primeiraPintada >= 1 && primeiraPintada <= 2,
    `lua sem margem superior: primeira pintura na linha ${primeiraPintada}`);
  assert.ok(topoLua < (ocupacao[primeiraPintada + 1] ?? 0),
    `lua sem curva crescente no topo: ${topoLua} células`);
});

test('painel preserva estado e instrucao fora da arte', () => {
  const painelColorido = renderConnectionPanel({
    titulo: 'SHOGUN',
    estado: 'conectado',
    detalhe: 'QR permanece fora desta composição',
  });
  const painel = semAnsi(painelColorido);
  assert.match(painelColorido, /\u001b\[38;2;222;176;84m/);
  assert.match(painelColorido, /\u001b\[38;2;104;170;126m/);
  assert.match(painel, /CONECTADO/);
  assert.match(painel, /QR permanece fora desta composição/);
  const arte = painel.split('\n').slice(1, 26);
  assert.ok(arte.every((linha) => !/^▀{64}$/.test(linha)));
});

test('painel saneia e limita textos sem perder semântica de estado', () => {
  const painel = renderConnectionPanel({
    titulo: 'SHŌGUN',
    estado: 'erro\nforçado',
    detalhe: '\u001b[2J' + 'detalhe muito longo '.repeat(8),
  });
  assert.equal(painel.includes('\u001b[2J'), false);
  assert.match(painel, /\u001b\[38;2;206;20;26m/);
  assert.ok(semAnsi(painel).split('\n').every((linha) => larguraVisual(linha) <= 64));
  assert.match(semAnsi(painel), /ERRO FORÇADO/);
});

test('cartoes de grupo e privado fecham a mesma largura visual', () => {
  const eventos = [
    {
      comando: true,
      emGrupo: true,
      conteudo: '!play música para concentração 🎧 com um nome bastante comprido',
      grupo: 'Quartel do Shogun ⚔️',
      usuario: 'Maurício',
      horario: '18:12:30',
    },
    {
      comando: false,
      emGrupo: false,
      conteudo: 'boa noite',
      usuario: 'Alaska',
      numero: '5511999999999',
      horario: '18:13:02',
    },
  ];

  for (const evento of eventos) {
    const linhas = renderEventoFeed(evento).split('\n');
    assert.equal(linhas.length, 7);
    assert.ok(linhas.every((linha) => larguraVisual(linha) === 62),
      linhas.map((linha) => `${larguraVisual(linha)} ${semAnsi(linha)}`).join('\n'));
  }
});

test('conteudo externo nao injeta ANSI nem quebra a geometria do terminal', () => {
  const hostil = '\u001b[2Jlinha 1\nlinha 2\t\u0007';
  assert.equal(textoSeguroParaTerminal(hostil), 'linha 1 linha 2');

  const cartao = renderEventoFeed({
    comando: false,
    emGrupo: false,
    conteudo: hostil,
    usuario: 'teste',
    numero: '0',
    horario: '18:13:02',
  });
  assert.equal(cartao.includes('\u001b[2J'), false);
  assert.equal(cartao.split('\n').length, 7);
});

test('fluxo legado usa o renderer novo e nao conserva a caixa antiga', () => {
  const fonte = fs.readFileSync('dados/src/index.js', 'utf8');
  assert.match(fonte, /import \{ renderEventoFeed \} from '\.\.\/\.\.\/dist-vnext\/console\/feed\.js';/);
  assert.match(fonte, /console\.log\(renderEventoFeed\(\{/);
  assert.doesNotMatch(fonte, /console\.log\('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓'\)/);
  assert.doesNotMatch(fonte, /messagePreview\.padEnd\(28\)/);
});
