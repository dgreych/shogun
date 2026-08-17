import { validateContentPack } from '../contracts/contentContracts.js';
import { validateEstacaoZeroContentPack } from '../contracts/estacaoZeroContracts.js';
import { makeContentRef } from '../contracts/validation.js';
import { RAW_NEXO_MVP_CONTENT } from './initialContent.js';
import { RAW_ESTACAO_ZERO_CONTENT } from './estacaoZero.js';

export const NEXO_MVP_CONTENT = validateContentPack(RAW_NEXO_MVP_CONTENT);
export const ESTACAO_ZERO_CONTENT = validateEstacaoZeroContentPack(RAW_ESTACAO_ZERO_CONTENT);

export const IMPULSES_BY_ID = Object.freeze(Object.fromEntries(NEXO_MVP_CONTENT.impulses.map(item => [item.id, item])));
export const SCARS_BY_ID = Object.freeze(Object.fromEntries(NEXO_MVP_CONTENT.scars.map(item => [item.id, item])));
export const ORIGINS_BY_ID = Object.freeze(Object.fromEntries(NEXO_MVP_CONTENT.origins.map(item => [item.id, item])));
export const TECHNIQUES_BY_ID = Object.freeze(Object.fromEntries(NEXO_MVP_CONTENT.techniques.map(item => [item.id, item])));

export const ESTACAO_ZERO_LOCATIONS_BY_ID = Object.freeze(Object.fromEntries(
  ESTACAO_ZERO_CONTENT.map.locations.map(item => [item.id, item])
));
export const ESTACAO_ZERO_ENEMIES_BY_ID = Object.freeze(Object.fromEntries(
  [...ESTACAO_ZERO_CONTENT.enemies, ESTACAO_ZERO_CONTENT.boss].map(item => [item.id, item])
));
export const ESTACAO_ZERO_MISSIONS_BY_ID = Object.freeze(Object.fromEntries(
  ESTACAO_ZERO_CONTENT.missions.map(item => [item.id, item])
));

export function getContentRef(definition) {
  return makeContentRef(definition.id, definition.version);
}

export { RAW_NEXO_MVP_CONTENT } from './initialContent.js';
export { RAW_ESTACAO_ZERO_CONTENT } from './estacaoZero.js';
