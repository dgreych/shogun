import { assertCharacterRenderView, assertCircleRenderView } from './nexoRenderViewContracts.js';
import { IMPULSES_BY_ID, ORIGINS_BY_ID, SCARS_BY_ID } from '../content/index.js';

// Converte estado REAL de domínio (nunca dado inventado) para o formato
// Render View v1 que a BunnyFy espera. Autovalida a própria saída via
// nexoRenderViewContracts.js -- pega cedo um bug de mapeamento (ex.:
// passar um campo errado) em vez de deixar a validação espelhada em
// services/bunnyfy/contracts.js ser a primeira a reclamar.
//
// Só `circle` existe por enquanto. `character` fica pendente: o
// onboarding atual (CL-NEXO-002/003) só coleta Impulso e Cicatriz --
// Origem (originLabel, campo obrigatório no contrato) nunca foi ligada
// a uma etapa real de criação de personagem, embora o conteúdo já
// exista (dados/src/nexo/content -- 8 Origens). Fabricar um valor pra
// esse campo só pra fechar o card seria inventar dado de jogo que não
// existe -- fica registrado como bloqueio real, não escondido.

const SEASON_STATUS_LABELS = Object.freeze({
  DRAFT: 'Rascunho',
  SCHEDULED: 'Agendada',
  ACTIVE: 'Ativa',
  FINALE: 'Final',
  ENDED: 'Encerrada',
  ARCHIVED: 'Arquivada'
});

const GROUP_STATUS_LABELS = Object.freeze({
  INACTIVE: 'Inativo',
  ACTIVE: 'Ativo',
  PAUSED: 'Pausado'
});

function worldMetrics(world) {
  if (!world) return [];
  return [
    { label: 'Pulso', value: world.pulse, max: 100 },
    { label: 'Coesão', value: world.cohesion, max: 100 },
    { label: 'Lucidez', value: world.lucidity, max: 100 },
    { label: 'Entropia', value: world.entropy, max: 100 }
  ];
}

const TONE_LABELS = Object.freeze({ FLAME: 'Chama', VEIL: 'Véu', ROOT: 'Raiz', ECHO: 'Eco' });

/**
 * `techniqueLabels`/`traitLabels` ficam vazios de propósito: a seção 5.4
 * do PDF descreve técnicas iniciais e equipamento gerados no onboarding
 * (`starterTechniques`/`starterItems` do CharacterSeed), mas isso nunca
 * foi persistido em nexo_characters -- gap real, documentado no
 * checkpoint, não inventado aqui com dado falso.
 */
function buildCharacterRenderView({ character }) {
  const impulse = IMPULSES_BY_ID[character.impulse];
  const scar = SCARS_BY_ID[character.scar];
  const origin = ORIGINS_BY_ID[character.origin];
  if (!impulse || !scar || !origin) return null;

  const metrics = [{ label: 'Patamar', value: character.tier, max: 20 }];
  if (character.memory > 0) metrics.push({ label: 'Memória', value: character.memory });

  const view = {
    schemaVersion: 1,
    kind: 'character',
    titleLabel: (character.name || '').trim() || 'Andarilho sem nome',
    originLabel: origin.name,
    toneLabel: impulse.signature.map(tone => TONE_LABELS[tone] || tone).join(' + '),
    impulseLabel: impulse.name,
    scarLabel: scar.name,
    metrics,
    techniqueLabels: [],
    traitLabels: []
  };
  return assertCharacterRenderView(view);
}

function buildCircleRenderView({ group, season, world }) {
  const view = {
    schemaVersion: 1,
    kind: 'circle',
    titleLabel: (group.name || '').trim() || 'Círculo',
    modeLabel: season ? (SEASON_STATUS_LABELS[season.status] || 'Temporada') : 'Sem temporada',
    statusLabel: GROUP_STATUS_LABELS[group.status] || 'Círculo',
    metrics: worldMetrics(world),
    highlights: []
  };
  return assertCircleRenderView(view);
}

export { buildCharacterRenderView, buildCircleRenderView };
