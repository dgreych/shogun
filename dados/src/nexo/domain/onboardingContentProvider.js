import { NexoValidationError } from '../errors.js';

// Fronteira entre a máquina de onboarding (minha) e o conteúdo declarativo
// real (Impulsos, Cicatrizes, Origens -- área reservada ao GPT em
// dados/src/nexo/content/**). Este arquivo NUNCA deve conter um Impulso,
// Cicatriz ou Origem de verdade -- só o contrato que dados/src/nexo/content/**
// vai satisfazer quando publicado e integrado.
//
// Formato esperado de cada opção: { id: string, label: string }.

function assertOnboardingContentProvider(provider) {
  const requiredMethods = ['listImpulses', 'listScars', 'listOrigins'];
  for (const method of requiredMethods) {
    if (typeof provider?.[method] !== 'function') {
      throw new NexoValidationError(`Content provider de onboarding precisa implementar ${method}()`);
    }
  }
  return provider;
}

export { assertOnboardingContentProvider };
