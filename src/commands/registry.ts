import type { CommandHandler } from './contracts.js';

/**
 * Registry estrutural do vNext. Tokens entram já normalizados pela futura
 * camada de adapter/domain; R0 não redefine a normalização do legado.
 */
export class CommandRegistry {
  readonly #byToken = new Map<string, CommandHandler>();

  constructor(handlers: readonly CommandHandler[] = []) {
    for (const handler of handlers) this.register(handler);
  }

  register(handler: CommandHandler): void {
    for (const token of [handler.name, ...handler.aliases]) {
      if (this.#byToken.has(token)) {
        throw new Error(`Duplicate vNext command token: ${token}`);
      }
      this.#byToken.set(token, handler);
    }
  }

  resolve(token: string): CommandHandler | undefined {
    return this.#byToken.get(token);
  }

  list(): readonly CommandHandler[] {
    return [...new Set(this.#byToken.values())];
  }
}
