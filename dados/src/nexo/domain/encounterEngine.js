import { NexoConflictError, NexoNotFoundError } from '../errors.js';
import { createSeededRng } from './rng.js';
import { resolveRoll } from './combatFormulas.js';
import { detectResonance } from './resonance.js';

// Motor genérico de encontro (seção 8 do PDF: "rodadas por janela", "sem
// corrida por velocidade", "falha útil"). Não conhece missão, boss nem
// conteúdo específico -- quem chama (ex.: o tutorial, e depois missões e
// raids) decide dificuldade/atributo por submissão e o que cada resultado
// significa narrativamente. Nunca envia mensagem, nunca decide vitória ou
// derrota final do encontro.

const DEFAULT_ROUND_TTL_MS = 5 * 60 * 1000;
const RESONANCE_CHAIN_CAP = 20;

async function openEncounterRound({ repository, encounterId, now = new Date(), ttlMs = DEFAULT_ROUND_TTL_MS }) {
  const encounter = await repository.getEncounterById(encounterId);
  if (!encounter) throw new NexoNotFoundError('Encontro não encontrado', { encounterId });
  if (!['CREATED', 'RESOLVING'].includes(encounter.state)) {
    throw new NexoConflictError('Encontro não está pronto para abrir rodada', { state: encounter.state });
  }
  const nextRound = encounter.round + 1;
  const deadlineAt = new Date(now.getTime() + ttlMs).toISOString();
  return repository.transitionEncounter(encounter.id, encounter.version, {
    state: 'OPEN_ROUND',
    round: nextRound,
    deadlineAt
  });
}

/**
 * `!agir` -- reenviar antes do lock substitui a submissão anterior
 * (upsert já garante isso no repositório).
 */
async function submitAction({ repository, encounterId, playerId, payload }) {
  const encounter = await repository.getEncounterById(encounterId);
  if (!encounter) throw new NexoNotFoundError('Encontro não encontrado', { encounterId });
  if (encounter.state !== 'OPEN_ROUND') {
    throw new NexoConflictError('A rodada já foi travada ou o encontro não está aberto', { state: encounter.state });
  }
  return repository.upsertActionSubmission({ encounterId, round: encounter.round, playerId, payload });
}

async function lockEncounterRound({ repository, encounterId }) {
  const encounter = await repository.getEncounterById(encounterId);
  if (!encounter) throw new NexoNotFoundError('Encontro não encontrado', { encounterId });
  if (encounter.state !== 'OPEN_ROUND') {
    throw new NexoConflictError('Encontro não está em rodada aberta', { state: encounter.state });
  }
  return repository.transitionEncounter(encounter.id, encounter.version, { state: 'LOCKING' });
}

/**
 * Resolve a rodada travada. `difficultyFor`/`attributeFor` são callbacks
 * injetados por quem chama (mantém este módulo sem conhecer ficha/
 * técnica). `priorityFor` (opcional) decide a ORDEM de resolução -- sem
 * ele, a ordem cai no desempate por `submission.id` (opaco, nunca por
 * `created_at`). Achado de revisão corrigido aqui (GPT-NEXO-004,
 * severidade MÉDIA): resolver na ordem de chegada da mensagem contraria
 * a seção 8.1 ("sem corrida por velocidade... prioridade vem de
 * categoria e técnica"); agora quem chama decide a prioridade real
 * (ex.: por categoria de técnica), e o desempate nunca depende de
 * velocidade.
 *
 * O RNG é seedado por seasonSeed+encounterId+round+actionId, onde
 * `actionId` é `submission.id:submission.version` -- não mais
 * `playerId` (achado de revisão, severidade ALTA): usar só o jogador
 * como actionId fazia duas submissões DIFERENTES da mesma pessoa no
 * mesmo round (reenviada antes do lock, seção 16 do PDF permite isso)
 * derivarem a MESMA seed, mesmo com conteúdo diferente. Incluir a
 * versão da submissão resolve isso sem abrir mão de determinismo:
 * reprocessar a MESMA submissão (mesma versão) sempre rola igual.
 *
 * Cada rolagem é persistida em GameEvent (seção 17.6: "o valor sorteado
 * deve ser persistido no GameEvent") -- antes disso só existia em
 * memória e no state_json do encontro, sem registro auditável separado.
 */
async function resolveEncounterRound({
  repository,
  encounterId,
  difficultyFor,
  attributeFor,
  seasonSeed,
  priorityFor = () => 0
}) {
  const encounter = await repository.getEncounterById(encounterId);
  if (!encounter) throw new NexoNotFoundError('Encontro não encontrado', { encounterId });
  if (encounter.state !== 'LOCKING') {
    throw new NexoConflictError('Encontro não está travado para resolução', { state: encounter.state });
  }

  const submissions = await repository.listActionSubmissions(encounterId, encounter.round);
  const orderedSubmissions = [...submissions].sort((a, b) => {
    const priorityDiff = priorityFor(a) - priorityFor(b);
    if (priorityDiff !== 0) return priorityDiff;
    // Desempate estável e determinístico -- nunca por velocidade de chegada.
    if (a.id < b.id) return -1;
    if (a.id > b.id) return 1;
    return 0;
  });

  const chainSoFar = Array.isArray(encounter.stateData.resonanceChain)
    ? encounter.stateData.resonanceChain
    : [];

  const results = [];
  const newChainEntries = [];
  for (const submission of orderedSubmissions) {
    const actionId = `${submission.id}:${submission.version}`;
    const rng = createSeededRng({ seasonSeed, encounterId, round: encounter.round, actionId });
    const roll = resolveRoll({
      rng,
      attributeValue: attributeFor(submission),
      difficulty: difficultyFor(submission),
      stance: submission.payload.stance || 'PULSE'
    });

    await repository.recordGameEvent({
      aggregateType: 'ENCOUNTER',
      aggregateId: encounterId,
      eventType: 'ActionResolved',
      payload: {
        playerId: submission.playerId,
        round: encounter.round,
        actionId,
        techniqueId: submission.payload.techniqueId,
        stance: submission.payload.stance || 'PULSE',
        dieRoll: roll.dieRoll,
        roll: roll.roll,
        margin: roll.margin,
        outcome: roll.outcome
      }
    });

    const chainEntry = {
      tone: submission.payload.tone,
      playerId: submission.playerId,
      techniqueId: submission.payload.techniqueId,
      hasRealEffect: roll.outcome !== 'SETBACK'
    };
    newChainEntries.push(chainEntry);
    const combo = detectResonance([...chainSoFar, ...newChainEntries]);
    results.push({ playerId: submission.playerId, submission, roll, combo });
  }

  const updatedChain = [...chainSoFar, ...newChainEntries].slice(-RESONANCE_CHAIN_CAP);

  const updatedEncounter = await repository.transitionEncounter(encounterId, encounter.version, {
    state: 'RESOLVING',
    stateDataPatch: {
      resonanceChain: updatedChain,
      lastResults: results.map(result => ({ playerId: result.playerId, outcome: result.roll.outcome }))
    }
  });

  return { encounter: updatedEncounter, results };
}

async function finalizeEncounter({ repository, encounterId, finalState, stateDataPatch = {} }) {
  const encounter = await repository.getEncounterById(encounterId);
  if (!encounter) throw new NexoNotFoundError('Encontro não encontrado', { encounterId });
  if (!['VICTORY', 'DEFEAT', 'ESCAPED', 'CANCELLED'].includes(finalState)) {
    throw new NexoConflictError('Estado final inválido', { finalState });
  }
  return repository.transitionEncounter(encounter.id, encounter.version, {
    state: finalState,
    stateDataPatch
  });
}

export {
  DEFAULT_ROUND_TTL_MS,
  finalizeEncounter,
  lockEncounterRound,
  openEncounterRound,
  resolveEncounterRound,
  submitAction
};
