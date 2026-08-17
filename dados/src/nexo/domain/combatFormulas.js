import { NexoValidationError } from '../errors.js';

// Fórmulas de resolução de combate (seções 8.3, 8.4, 8.5 do PDF).

const POSTURE_MODIFIERS = Object.freeze({
  CAUTION: { rollBonus: 2, effectMultiplier: 0.75, allowsCriticalRupture: false },
  PULSE: { rollBonus: 0, effectMultiplier: 1, allowsCriticalRupture: true },
  RUPTURE: { rollBonus: -2, effectMultiplier: 1.5, allowsCriticalRupture: true }
});

function classifyOutcome(margin) {
  if (margin <= -3) return 'SETBACK';
  if (margin <= 1) return 'TENSE';
  if (margin <= 5) return 'FULL';
  return 'RUPTURE';
}

/**
 * rolagem = d12 + atributo + rankTecnica + poderItem + modificadores (+
 * bônus/penalidade de postura). margem = rolagem - dificuldade.
 */
function resolveRoll({
  rng,
  attributeValue = 0,
  techniqueRank = 0,
  itemPower = 0,
  modifiers = 0,
  difficulty,
  stance = 'PULSE'
}) {
  const postureConfig = POSTURE_MODIFIERS[stance];
  if (!postureConfig) {
    throw new NexoValidationError('Postura inválida. Use CAUTION, PULSE ou RUPTURE.');
  }
  if (!Number.isFinite(difficulty)) {
    throw new NexoValidationError('Dificuldade inválida.');
  }

  const dieRoll = rng.rollD12();
  const roll = dieRoll + attributeValue + techniqueRank + itemPower + modifiers + postureConfig.rollBonus;
  const margin = roll - difficulty;
  const outcome = classifyOutcome(margin);
  const isCriticalRupture = outcome === 'RUPTURE' && postureConfig.allowsCriticalRupture;

  return Object.freeze({
    dieRoll,
    roll,
    margin,
    outcome,
    stance,
    effectMultiplier: postureConfig.effectMultiplier,
    isCriticalRupture
  });
}

function scaleEffect(baseValue, effectMultiplier) {
  return Math.max(0, Math.round(baseValue * effectMultiplier));
}

// dano = max(1, baseTecnica + Impacto + piso(margem / 2) - guardaAlvo)
function computeDamage({ baseTechnique, impact = 0, margin, guard = 0, effectMultiplier = 1 }) {
  const raw = baseTechnique + impact + Math.floor(margin / 2) - guard;
  return Math.max(1, scaleEffect(raw, effectMultiplier));
}

// escudo = baseTecnica + Sustento + bonusRessonancia
function computeShield({ baseTechnique, sustain = 0, resonanceBonus = 0, effectMultiplier = 1 }) {
  return scaleEffect(baseTechnique + sustain + resonanceBonus, effectMultiplier);
}

// cura = min(vitalidadeFaltante, baseTecnica + Conexao + piso(margem / 3))
function computeHeal({ baseTechnique, connection = 0, margin, missingVitality, effectMultiplier = 1 }) {
  const raw = baseTechnique + connection + Math.floor(margin / 3);
  return Math.max(0, Math.min(missingVitality, scaleEffect(raw, effectMultiplier)));
}

export {
  POSTURE_MODIFIERS,
  classifyOutcome,
  computeDamage,
  computeHeal,
  computeShield,
  resolveRoll
};
