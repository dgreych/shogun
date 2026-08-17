import { NEXO_MVP_CONTENT } from '../content/index.js';

// Adaptador pequeno prometido no quadro NEXO enquanto GPT-NEXO-001 rodava:
// converte o conteúdo real e validado do GPT (dados/src/nexo/content/**)
// para a interface que domain/onboarding.js espera
// (domain/onboardingContentProvider.js). Nenhum dado é inventado aqui --
// só reformatado.

function toOption(definition) {
  return Object.freeze({ id: definition.id, label: definition.name });
}

function createOnboardingContentProvider() {
  const impulses = Object.freeze(NEXO_MVP_CONTENT.impulses.map(toOption));
  const scars = Object.freeze(NEXO_MVP_CONTENT.scars.map(toOption));
  const origins = Object.freeze(NEXO_MVP_CONTENT.origins.map(toOption));
  return Object.freeze({
    listImpulses: () => impulses,
    listScars: () => scars,
    listOrigins: () => origins
  });
}

export { createOnboardingContentProvider };
