import type { VNextCommandDispatchTarget } from './compatibility-dispatch.js';

export type AtomicDomainState = 'staged' | 'active';

export interface AtomicDomainOptions<Context> {
  readonly name: string;
  readonly state: AtomicDomainState;
  readonly tokens: readonly string[];
  readonly target: VNextCommandDispatchTarget<Context>;
}

/**
 * Boundary de ativação all-or-nothing para domínios inteiros.
 *
 * Em staged, nenhum token é reclamado e o bridge legado continua responsável
 * pela superfície completa. Em active, todo token declarado passa a ser
 * responsabilidade obrigatória do domínio interno. Se o target recusar um
 * token owned, a falha é explícita e fail-closed em vez de voltar ao legado e
 * correr o risco de executar efeitos duas vezes.
 */
export class AtomicDomainDispatchTarget<Context>
implements VNextCommandDispatchTarget<Context> {
  private readonly name: string;
  private readonly state: AtomicDomainState;
  private readonly tokenSet: ReadonlySet<string>;
  private readonly target: VNextCommandDispatchTarget<Context>;

  constructor(options: AtomicDomainOptions<Context>) {
    this.name = options.name;
    this.state = options.state;
    this.target = options.target;
    this.tokenSet = new Set(
      options.tokens
        .map((token) => String(token || '').trim().toLowerCase())
        .filter(Boolean),
    );

    if (!this.name.trim()) throw new Error('AtomicDomain precisa de nome.');
    if (this.tokenSet.size === 0) throw new Error(`AtomicDomain ${this.name} não possui tokens.`);
  }

  async dispatch(command: string, context: Context): Promise<boolean> {
    const normalized = String(command || '').trim().toLowerCase();
    if (!normalized || !this.tokenSet.has(normalized)) return false;

    if (this.state === 'staged') return false;

    const handled = await this.target.dispatch(normalized, context);
    if (!handled) {
      throw new Error(
        `Domínio atômico ${this.name} está ativo, mas recusou o token owned ${normalized}.`,
      );
    }
    return true;
  }
}
