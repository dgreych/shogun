// Motor de Ressonância (seção 7 do PDF). Um combo exige ações de
// jogadores diferentes no mesmo encontro; a ordem importa; o motor
// registra a cadeia por encounterId, nunca globalmente no grupo (seção
// 7.2/7.4) -- por isso este módulo é puro (sem I/O): quem chama é
// responsável por passar só a cadeia do encontro atual.
//
// Nota de leitura da especificação: a seção 7.2 diz "o motor registra os
// últimos três tons válidos", mas a própria tabela de combos da mesma
// seção inclui uma linha de quatro tons distintos ("Convergência"). Uma
// janela de só 3 não permite detectar isso. Decisão de implementação:
// mantemos uma janela de 4 entradas válidas (suficiente para as duas
// checagens), verificando Convergência antes de Saturação antes do combo
// de par -- do mais específico pro menos específico.

const PAIR_COMBOS = Object.freeze({
  'FLAME>VEIL': { id: 'ambush', name: 'Emboscada' },
  'VEIL>ROOT': { id: 'containment', name: 'Contenção' },
  'ROOT>ECHO': { id: 'refuge', name: 'Refúgio' },
  'ECHO>FLAME': { id: 'summoning', name: 'Convocação' },
  'VEIL>ECHO': { id: 'revelation', name: 'Revelação' },
  'FLAME>ROOT': { id: 'impact_wall', name: 'Muralha de Impacto' }
});

const CHAIN_WINDOW = 4;

/**
 * `entries`: histórico de ações válidas do encontro, na ordem em que
 * ocorreram: `{ tone, playerId, hasRealEffect, techniqueId }`. Ações sem
 * alvo/efeito real (`hasRealEffect: false`) já devem ter sido filtradas
 * antes de chegar aqui -- este módulo não decide isso, só detecta o combo
 * na cauda da cadeia.
 */
function detectResonance(entries) {
  const valid = entries.filter(entry => entry.hasRealEffect);
  const window = valid.slice(-CHAIN_WINDOW);
  if (window.length < 2) return null;

  const lastTwo = window.slice(-2);
  if (lastTwo[0].playerId === lastTwo[1].playerId) return null; // não encadeia consigo mesma

  if (window.length >= 4) {
    const lastFour = window.slice(-4);
    const tones = lastFour.map(entry => entry.tone);
    const distinctTones = new Set(tones);
    const distinctPlayers = new Set(lastFour.map(entry => entry.playerId));
    if (distinctTones.size === 4 && distinctPlayers.size >= 2) {
      return Object.freeze({ id: 'convergence', name: 'Convergência', kind: 'CONVERGENCE', tones });
    }
  }

  if (window.length >= 3) {
    const lastThree = window.slice(-3);
    const tones = lastThree.map(entry => entry.tone);
    const distinctPlayers = new Set(lastThree.map(entry => entry.playerId));
    if (tones.every(tone => tone === tones[0]) && distinctPlayers.size >= 2) {
      return Object.freeze({ id: 'saturation', name: 'Saturação', kind: 'SATURATION', tone: tones[0] });
    }
  }

  const key = `${lastTwo[0].tone}>${lastTwo[1].tone}`;
  const pairCombo = PAIR_COMBOS[key];
  if (pairCombo) {
    return Object.freeze({ ...pairCombo, kind: 'PAIR_COMBO' });
  }
  return null;
}

/**
 * Custo de Foco extra quando a mesma técnica se repete em sequência
 * imediata (seção 7.4: "repetir uma técnica idêntica em sequência aumenta
 * custo de Foco e não concede Memória de cooperação").
 */
function isRepeatedTechnique(entries, techniqueId) {
  const last = entries.at(-1);
  return Boolean(last && last.techniqueId === techniqueId);
}

export { CHAIN_WINDOW, PAIR_COMBOS, detectResonance, isRepeatedTechnique };
