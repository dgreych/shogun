import assert from 'node:assert/strict';
import test from 'node:test';

import { runBalanceReport } from '../tools/balanceSimulator.js';

// O harness é determinístico por seed: a mesma configuração produz sempre o
// mesmo relatório, então os limites abaixo não são um teste estatístico
// flutuante — são uma trava de regressão contra extremos já observados e
// corrigidos nesta rodada (ver docs/TAVERN_VNEXT_RELATORIO_INTEGRACAO_2026-08-14.md).
test('harness de balanceamento: nenhum matchup introdutório é extremo e a partida sempre termina', async () => {
  const report = await runBalanceReport({ gamesPerMatchup: 20, seedPrefix: 'ci-sanity' });

  assert.equal(report.totalGames, 240);
  assert.equal(report.turnCapRate, 0, 'nenhuma simulação deveria bater no teto de turnos (bot travado)');

  for (const matchup of report.matchups) {
    assert.ok(
      matchup.winRateA <= 0.8 && matchup.winRateB <= 0.8,
      `${matchup.matchup} está fora da faixa aceitável: A=${matchup.winRateA} B=${matchup.winRateB}`
    );
    assert.ok(matchup.averageTurns > 3, `${matchup.matchup} terminou rápido demais para ser plausível`);
    assert.ok(matchup.averageTurns < 45, `${matchup.matchup} demorou turnos demais, possível travamento`);
  }

  assert.ok(
    report.firstPlayerWinRate > 0.35 && report.firstPlayerWinRate < 0.65,
    `vantagem do primeiro jogador fora da faixa saudável: ${report.firstPlayerWinRate}`
  );
  assert.ok(
    report.deadHandRateTurns1to3 < 0.35,
    `mão morta nos turnos 1-3 acima do aceitável: ${report.deadHandRateTurns1to3}`
  );
  assert.ok(
    report.manaWasteRate < 0.4,
    `mana não utilizada acima do aceitável: ${report.manaWasteRate}`
  );
});

test('mirrors dos três arquétipos introdutórios ficam próximos de 50/50', async () => {
  const report = await runBalanceReport({ gamesPerMatchup: 20, seedPrefix: 'ci-sanity' });
  const mirrors = report.matchups.filter(matchup => matchup.matchup.split(' x ')[0] === matchup.matchup.split(' x ')[1]);
  assert.equal(mirrors.length, 3);
  for (const mirror of mirrors) {
    assert.ok(
      Math.abs(mirror.winRateA - 0.5) < 0.2,
      `mirror ${mirror.matchup} deveria ficar perto de 50/50, veio ${mirror.winRateA}`
    );
  }
});
