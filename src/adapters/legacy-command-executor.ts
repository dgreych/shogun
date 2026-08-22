import { URL } from 'node:url';

import type { LegacyFallbackExecutor } from '../runtime/compatibility-dispatch.js';

export interface LegacyCommandExecutionInput {
  readonly socket: unknown;
  readonly message: unknown;
  readonly mediaPath?: unknown;
  readonly messagesCache: unknown;
  readonly rentalExpirationManager: unknown;
}

type LegacyCommandFunction = (
  socket: unknown,
  message: unknown,
  mediaPath: unknown,
  messagesCache: unknown,
  rentalExpirationManager: unknown,
) => Promise<unknown> | unknown;

type LegacyModuleLoader = () => Promise<unknown>;

async function defaultLegacyModuleLoader(): Promise<unknown> {
  const moduleUrl = new URL('../../dados/src/index.js', import.meta.url);
  return import(moduleUrl.href);
}

function resolveLegacyExecutor(moduleValue: unknown): LegacyCommandFunction {
  if (!moduleValue || typeof moduleValue !== 'object') {
    throw new Error('Módulo legado de comandos inválido.');
  }
  const record = moduleValue as Record<string, unknown>;
  const candidate = record.default ?? record.NazuninhaBotExec;
  if (typeof candidate !== 'function') {
    throw new Error('dados/src/index.js não exporta executor de comandos compatível.');
  }
  return candidate as LegacyCommandFunction;
}

/**
 * Único ponto autorizado do vNext para alcançar o dispatcher monolítico
 * durante a migração. O módulo é carregado uma vez e permanece isolado atrás
 * do contrato LegacyFallbackExecutor até a cobertura legada chegar a zero.
 */
export class LegacyCommandExecutorAdapter
  implements LegacyFallbackExecutor<LegacyCommandExecutionInput>
{
  #executorPromise?: Promise<LegacyCommandFunction>;

  constructor(private readonly loader: LegacyModuleLoader = defaultLegacyModuleLoader) {}

  async #executor(): Promise<LegacyCommandFunction> {
    if (!this.#executorPromise) {
      this.#executorPromise = this.loader().then(resolveLegacyExecutor);
    }
    return this.#executorPromise;
  }

  async execute(input: LegacyCommandExecutionInput): Promise<void> {
    const executor = await this.#executor();
    await executor(
      input.socket,
      input.message,
      input.mediaPath ?? null,
      input.messagesCache,
      input.rentalExpirationManager,
    );
  }
}
