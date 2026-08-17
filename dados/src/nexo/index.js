// Barrel do módulo NEXO -- fundação (CL-NEXO-001), kernel de ativação
// (CL-NEXO-002) e onboarding/painel/ficha com conteúdo real (CL-NEXO-003)
// por um único ponto, no mesmo espírito de dados/src/tavern/index.js.

export * from './errors.js';
export * from './domain/messageContracts.js';
export { IdentityService, ADDRESS_TYPES, classifyAddress } from './identity/IdentityService.js';
export { normalizeIncomingMessage } from './transport/normalizeIncomingMessage.js';
export { checkFreshGroupAdmin } from './transport/checkFreshGroupAdmin.js';
export { NexoRepository } from './persistence/NexoRepository.js';
export { NexoSqliteStore } from './persistence/NexoSqliteStore.js';
export { assertOnboardingContentProvider } from './domain/onboardingContentProvider.js';
export { createOnboardingContentProvider } from './domain/onboardingContentAdapter.js';
export {
  answerOnboardingStep,
  cancelOnboarding,
  getCurrentOnboardingPrompt,
  startOnboarding
} from './domain/onboarding.js';
export { getGroupDashboard } from './domain/dashboard.js';
export { getCharacterSheet } from './domain/characterSheet.js';
export { setPrivacyPreference } from './domain/privacySettings.js';
export { createSeededRng, deriveNumericSeed } from './domain/rng.js';
export {
  classifyOutcome,
  computeDamage,
  computeHeal,
  computeShield,
  resolveRoll
} from './domain/combatFormulas.js';
export { detectResonance, isRepeatedTechnique } from './domain/resonance.js';
export {
  finalizeEncounter,
  lockEncounterRound,
  openEncounterRound,
  resolveEncounterRound,
  submitAction as submitEncounterAction
} from './domain/encounterEngine.js';
export {
  ensureTutorialEncounter,
  previewTutorialStage,
  submitTutorialAction,
  submitTutorialAnalysis,
  submitTutorialChoice
} from './domain/tutorialEncounter.js';
export {
  createNexoRuntime,
  getNexoRuntime,
  handleNexoCommand,
  handleNexoPlayerCommand,
  shouldHandleNexoCommand,
  shouldHandleNexoNumericReply,
  shouldHandleNexoPlayerCommand,
  warmupNexoRuntime
} from './runtime.js';
