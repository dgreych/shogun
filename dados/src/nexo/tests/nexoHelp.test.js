import assert from 'node:assert/strict';
import test from 'node:test';

import { handleNexoAction, helpViewModel } from '../commands/NexoCommandController.js';

test('helpViewModel() sem tópico mostra a visão geral com as quatro categorias', () => {
  const view = helpViewModel();
  assert.equal(view.title, 'NEXO // Ajuda');
  const lines = view.sections[0].lines.join(' ');
  assert.match(lines, /jogador/);
  assert.match(lines, /tutorial/);
  assert.match(lines, /combate/);
  assert.match(lines, /admin/);
});

test('helpViewModel("jogador") lista os comandos de jogador reais, não "chegam nos próximos marcos"', () => {
  const view = helpViewModel('jogador');
  const lines = view.sections[0].lines.join(' ');
  assert.match(lines, /entrar/);
  assert.match(lines, /painel/);
  assert.match(lines, /ficha/);
  assert.match(lines, /privado/);
  assert.doesNotMatch(JSON.stringify(view), /próximos marcos/);
});

test('helpViewModel("tutorial") e helpViewModel("combate") mostram os comandos reais', () => {
  const tutorial = helpViewModel('tutorial');
  assert.match(tutorial.sections[0].lines.join(' '), /analisar/);
  assert.match(tutorial.sections[0].lines.join(' '), /agir/);

  const combat = helpViewModel('combate');
  assert.match(combat.sections[0].lines.join(' '), /combate <inimigoId>/);
});

test('helpViewModel aceita índice numérico (1-4) como atalho pra categoria', () => {
  assert.equal(helpViewModel('1').title, helpViewModel('jogador').title);
  assert.equal(helpViewModel('2').title, helpViewModel('tutorial').title);
  assert.equal(helpViewModel('3').title, helpViewModel('combate').title);
  assert.equal(helpViewModel('4').title, helpViewModel('admin').title);
});

test('helpViewModel com categoria desconhecida devolve erro claro, não lança', () => {
  const view = helpViewModel('inexistente');
  assert.equal(view.kind, 'ERROR');
  assert.match(view.sections[0].lines[0], /não existe/);
});

test('!nexo ajuda <categoria> via handleNexoAction roteia pro submenu certo', async () => {
  const repository = {};
  const context = {};
  const overview = await handleNexoAction({ repository, context, action: 'ajuda', args: [] });
  assert.equal(overview.title, 'NEXO // Ajuda');

  const jogador = await handleNexoAction({ repository, context, action: 'ajuda', args: ['jogador'] });
  assert.equal(jogador.title, 'NEXO // Ajuda -- Jogador');

  const admin = await handleNexoAction({ repository, context, action: 'ajuda', args: ['admin'] });
  assert.equal(admin.title, 'NEXO // Ajuda -- Administração');
});
