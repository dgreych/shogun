import { createHash } from 'node:crypto';

// RNG injetável com seed derivada (seção 17.6 do PDF): "Toda rolagem usa
// um RNG injetável com seed derivada de seasonSeed, encounterId, round e
// actionId... o valor sorteado deve ser persistido no GameEvent. Testes
// usam seed fixa. Reprocessar uma mensagem idempotente nunca rola
// novamente." A persistência do valor sorteado (não só da seed) é
// responsabilidade de quem chama isto e grava o GameEvent -- este módulo
// só gera o número de forma determinística e reproduzível.

function deriveNumericSeed({ seasonSeed, encounterId, round, actionId }) {
  const composite = [seasonSeed, encounterId, round, actionId].join(':');
  const hash = createHash('sha256').update(composite).digest();
  return hash.readUInt32BE(0);
}

// mulberry32: PRNG determinístico, rápido, sem dependência nova.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * `seedInput` pode ser um número (seed direta, útil em testes) ou um
 * objeto `{ seasonSeed, encounterId, round, actionId }` (uso real).
 */
function createSeededRng(seedInput) {
  const numericSeed = typeof seedInput === 'number'
    ? seedInput >>> 0
    : deriveNumericSeed(seedInput);
  const next = mulberry32(numericSeed);
  return Object.freeze({
    next,
    rollD12: () => Math.floor(next() * 12) + 1
  });
}

export { createSeededRng, deriveNumericSeed };
