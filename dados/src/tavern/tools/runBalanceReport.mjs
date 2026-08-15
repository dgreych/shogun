import { runBalanceReport } from './balanceSimulator.js';

function formatPercent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

async function main() {
  const gamesPerMatchup = Number(process.argv[2]) || 100;
  const seedPrefix = process.argv[3] || 'balance';

  console.log(`Rodando harness de balanceamento (gamesPerMatchup=${gamesPerMatchup}, seed=${seedPrefix})...`);
  const start = Date.now();
  const report = await runBalanceReport({ gamesPerMatchup, seedPrefix });
  const elapsedSeconds = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`\n${report.totalGames} partidas simuladas em ${elapsedSeconds}s.\n`);
  console.log('Matchup'.padEnd(24), 'Win A'.padEnd(8), 'Win B'.padEnd(8), 'Turnos médios');
  for (const matchup of report.matchups) {
    console.log(
      matchup.matchup.padEnd(24),
      formatPercent(matchup.winRateA).padEnd(8),
      formatPercent(matchup.winRateB).padEnd(8),
      matchup.averageTurns.toFixed(1)
    );
  }

  console.log('\nMétricas globais:');
  console.log('  Vantagem do primeiro jogador:', formatPercent(report.firstPlayerWinRate));
  console.log('  Mão morta (turnos 1-3):', formatPercent(report.deadHandRateTurns1to3));
  console.log('  Mana não utilizada:', formatPercent(report.manaWasteRate));
  console.log('  Uso do poder de herói quando disponível:', formatPercent(report.powerUsageRate ?? 0));
  console.log('  Partidas que bateram no teto de turnos:', formatPercent(report.turnCapRate));

  console.log('\nJSON completo:');
  console.log(JSON.stringify(report, null, 2));
}

main().catch(error => {
  console.error('Falha ao rodar o harness de balanceamento:', error);
  process.exitCode = 1;
});
