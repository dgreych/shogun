import type { VNextCommandDispatchTarget } from './compatibility-dispatch.js';

/**
 * Agrega domínios vNext sem recriar um switch monolítico.
 * Cada domínio declara ownership de famílias inteiras e a cadeia para no
 * primeiro que aceitar o comando. Exceções propagam: domínio que aceitou e
 * falhou não autoriza outro domínio ou o legado a executar a mesma mensagem.
 */
export class CompositeVNextDispatchTarget<TContext>
  implements VNextCommandDispatchTarget<TContext>
{
  constructor(private readonly targets: readonly VNextCommandDispatchTarget<TContext>[]) {}

  async dispatch(command: string, context: TContext): Promise<boolean> {
    for (const target of this.targets) {
      if (await target.dispatch(command, context)) return true;
    }
    return false;
  }
}
