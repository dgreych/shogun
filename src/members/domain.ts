import {
  MembersGeneratedDomainDispatchTarget,
  MEMBERS_GENERATED_COMMAND_TOKENS,
  type MembersGeneratedExecutionContext,
  type MembersGeneratedScope,
} from './generated-domain.js';
import {
  AtomicDomainDispatchTarget,
  type AtomicDomainState,
} from '../runtime/atomic-domain.js';
import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';

export interface MembersHostExecutionContext {
  readonly buildMembersScope?: () => MembersGeneratedScope;
}

export interface MembersDomainOptions {
  readonly state?: AtomicDomainState;
  readonly reportError?: (message: string, error: unknown) => void;
}

/**
 * Boundary resiliente do domínio Members.
 *
 * O domínio inteiro é reconhecido como uma unidade de 32 famílias / 152 tokens
 * (29 famílias-base + 3 famílias exigidas pelo fechamento de aliases
 * duplicados). Em `staged`, nenhum token é interceptado. Em `active`, a scope
 * legada necessária é montada antes de qualquer handler executar.
 *
 * Se a montagem da scope falhar, ainda não houve efeito colateral do domínio.
 * Portanto é seguro devolver false e deixar o bridge/switch legado executar
 * uma única vez. ReferenceError abre um circuit breaker exclusivo de Members,
 * sem derrubar Menu, Tools, Admin ou qualquer outro domínio vNext.
 *
 * Depois que o handler gerado começa, a execução volta a ser fail-closed:
 * qualquer erro propaga e nunca dispara o legado novamente.
 */
export class MembersDomainDispatchTarget<HostContext extends MembersHostExecutionContext>
implements VNextCommandDispatchTarget<HostContext> {
  private readonly state: AtomicDomainState;
  private readonly tokens = new Set(MEMBERS_GENERATED_COMMAND_TOKENS);
  private readonly atomic: AtomicDomainDispatchTarget<MembersGeneratedExecutionContext>;
  private readonly reportError: (message: string, error: unknown) => void;
  private scopeCircuitOpen = false;

  constructor(options: MembersDomainOptions = {}) {
    this.state = options.state ?? 'staged';
    this.reportError = options.reportError ?? ((message, error) => console.error(message, error));
    this.atomic = new AtomicDomainDispatchTarget<MembersGeneratedExecutionContext>({
      name: 'members',
      state: this.state,
      tokens: MEMBERS_GENERATED_COMMAND_TOKENS,
      target: new MembersGeneratedDomainDispatchTarget(),
    });
  }

  async dispatch(command: string, context: HostContext): Promise<boolean> {
    const normalized = String(command || '').trim().toLowerCase();
    if (!normalized || !this.tokens.has(normalized)) return false;
    if (this.state === 'staged') return false;
    if (this.scopeCircuitOpen) return false;

    let membersScope: MembersGeneratedScope;
    try {
      if (typeof context.buildMembersScope !== 'function') {
        throw new ReferenceError('buildMembersScope não está disponível no runtime.');
      }
      membersScope = context.buildMembersScope();
    } catch (error) {
      const structural = error instanceof ReferenceError;
      if (structural) this.scopeCircuitOpen = true;
      this.reportError(
        structural
          ? '[VNEXT/MEMBERS] Falha estrutural antes do handler; circuit breaker de Members aberto e legado preservado.'
          : '[VNEXT/MEMBERS] Falha ao montar scope antes do handler; legado preservado para esta mensagem.',
        error,
      );
      return false;
    }

    return this.atomic.dispatch(normalized, { membersScope });
  }
}

export { MEMBERS_GENERATED_COMMAND_TOKENS };
