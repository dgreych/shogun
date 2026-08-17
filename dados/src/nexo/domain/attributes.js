import { NexoValidationError } from '../errors.js';
import { NEXO_MVP_CONTENT } from '../content/index.js';

// Extraído de tutorialEncounter.js (era local, agora usado também por
// missionEncounter.js) -- seção 5.4 do PDF: "Todos os atributos começam
// em 1. O Impulso concede +2 ao atributo principal e +1 ao secundário."

function findImpulseDefinition(impulseId) {
  const impulse = NEXO_MVP_CONTENT.impulses.find(entry => entry.id === impulseId);
  if (!impulse) throw new NexoValidationError('Impulso do personagem não encontrado no conteúdo', { impulseId });
  return impulse;
}

function deriveAttributeValue(impulseDefinition, attributeCode) {
  const [primary, secondary] = impulseDefinition.favoredAttributes;
  let value = 1;
  if (attributeCode === primary) value += 2;
  else if (attributeCode === secondary) value += 1;
  return value;
}

export { deriveAttributeValue, findImpulseDefinition };
