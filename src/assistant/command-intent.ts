export interface AssistantAction { readonly command: string; readonly args: readonly string[]; readonly token: string }
export interface AssistantResponse { readonly actions?: unknown; readonly resp?: unknown; readonly erro?: unknown; readonly message?: unknown }
export type AssistantTurn = { readonly kind: 'action'; readonly action: AssistantAction }
  | { readonly kind: 'conversation'; readonly response: AssistantResponse }
  | { readonly kind: 'ignored' | 'failed' };
export interface PlanOptions {
  readonly key: string; readonly text: string; readonly prefix: string;
  readonly catalog: readonly string[]; readonly eligible: boolean;
  readonly transportTargets?: readonly string[];
  readonly transportTargetCommands?: readonly string[];
  readonly resolve: (token: string) => { readonly command: string; readonly matchedAlias?: { readonly fixedParams?: string } | null };
  readonly request: () => Promise<AssistantResponse>;
  readonly refresh: (signal: AbortSignal) => Promise<boolean>;
  readonly timeoutMs?: number;
}

const normalize = (text: string): string => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const tokenPattern = /^[\p{L}\p{N}_.-]{1,64}$/u;
const positiveRequest = /^(?:(?:por favor|pfv)\s+)?(?:(?:voce|vc)\s+)?(?:(?:pode|poderia|consegue|quero|queria|gostaria de)\s+)?(?:me\s+)?(?:da|de|diz|diga|execute|executa|executar|rode|roda|rodar|use|usa|usar|mande|manda|mandar|envie|envia|enviar|mostre|mostra|mostrar|veja|ver|faca|faz|fazer|crie|cria|criar|gere|gera|gerar|transforme|transforma|converta|converte|pesquise|pesquisa|pesquisar|procure|procura|procurar|busque|busca|buscar|consulte|consulta|consultar|liste|lista|listar|avise|avisa|avisar|anuncie|anuncia|anunciar|altere|altera|alterar|mude|muda|mudar|advirta|adverte|advertir|transfira|transfere|transferir|passe|passa|passar|pegue|pega|pegar|receba|recebe|receber|salve|salva|salvar|anote|anota|anotar|lembre|lembra|lembrar|bane|bana|banir|expulse|expulsa|remova|remove|promove|promova|rebaixa|rebaixe|muta|mute|silencia|silencie|desmuta|dessilencia|dessilencie|deleta|delete|exclui|apague|apaga|toque|toca|baixe|traduza|traduz|calcule|calcula|abra|abre|feche|fecha|minere|minera|minerar|role|rola|rolar|lance|lanca|lancar)\b/u;

function hasNegativeRequest(text: string): boolean {
  for (const negation of text.matchAll(/\b(?:nao|nunca|nem)\b\s*/gu)) {
    if (positiveRequest.test(text.slice(negation.index! + negation[0].length).trim())) return true;
  }
  return false;
}

function instructionText(text: string): string {
  // Mantém offsets para segmentar o texto original sem cortar títulos citados.
  return text.replace(/```[\s\S]*?```|`[^`]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gu,
    value => ' '.repeat(value.length));
}

function currentRequestSegment(text: string): string | null {
  const masked = instructionText(text);
  const separators = [...masked.matchAll(/;|,(?=\s*(?:ele|ela|antes|depois|ou melhor|exemplo|por exemplo|mas|me |execute|mande|mostre))/giu)];
  let start = text.match(/^\s*(?:@?shogun\b[\s,:]*|[,:\s]+)/iu)?.[0].length || 0;
  for (const separator of separators.filter(separator => separator.index! >= start)) {
    const next = separator.index! + 1;
    if (/\bnao\b.*\b(?:consegui|conseguindo|consigo|estou)\b/u.test(normalize(masked.slice(0, separator.index)))
      && positiveRequest.test(normalize(masked.slice(next).trim()))) { start = next; break; }
  }
  for (const separator of masked.matchAll(/[.!?]\s+/gu)) {
    if (separator.index! < start) continue;
    const tail = normalize(masked.slice(separator.index! + separator[0].length))
      .replace(/^\s*(?:@?shogun\b[\s,:]*)?/u, '').trim();
    if (positiveRequest.test(tail)) return null;
  }
  const remaining = normalize(masked.slice(start));
  // Duas operações atuais exigem esclarecimento, em vez de mover operandos.
  for (const conjunction of remaining.matchAll(/\b(?:e(?: depois)?|mas|em seguida)\s+/gu)) {
    if (positiveRequest.test(remaining.slice(conjunction.index! + conjunction[0].length))) return null;
  }
  const end = separators.find(separator => separator.index! >= start)?.index ?? text.length;
  for (const separator of separators.filter(separator => separator.index! > end - 1)) {
    if (positiveRequest.test(normalize(masked.slice(separator.index! + 1).trim()))) return null;
  }
  return text.slice(start, end).trim();
}
// Revisados nos respectivos handlers: cada conjunto faz uma única operação,
// sem ramificação por command. Não derivar equivalência das macrofamílias.
const verifiedOperationAliases: readonly (readonly string[])[] = [
  ['ban', 'banir', 'b', 'kick'], ['s', 'st', 'stk', 'sticker'],
  ['calculadora', 'calc', 'calcular'], ['tradutor', 'translator'], ['lembrete', 'lembrar'],
];

export function isAssistantEligible(input: {
  readonly text: string; readonly prefix: string; readonly enabled: boolean;
  readonly fromMe: boolean; readonly fromPro: boolean; readonly isGroup: boolean;
  readonly botMentioned: boolean; readonly repliedToBot: boolean;
}): boolean {
  if (!input.enabled || input.fromMe || input.fromPro || !input.text.trim()
    || (input.prefix && input.text.trim().startsWith(input.prefix))) return false;
  return input.botMentioned || input.repliedToBot || /(?:^|\s|@)shogun(?:\s|[,!?:]|$)/iu.test(input.text);
}

// Estas associações são do produto, não palavras de autoridade produzidas pelo modelo.
// Tokens/aliases de todas as famílias continuam disponíveis sem paráfrase cadastrada.
const naturalOperations: readonly [string, RegExp][] = [
  ['ping', /\b(?:latencia|ping|tempo de resposta)\b/u], ['menu', /\b(?:menu principal|lista de comandos|menu)\b/u],
  ['s', /\b(?:figurinha|sticker|adesivo)\b/u], ['ban', /\b(?:bane|bana|banir|expulse|expulsa|expulsar)\b|\b(?:remova|remove)\b.*\b(?:pessoa|membro)\b/u],
  ['promover', /\b(?:promove|promova|promover|torne administrador)\b/u], ['rebaixar', /\b(?:rebaixa|rebaixe|rebaixar|retire o cargo de administrador)\b/u],
  ['mute', /\b(?:muta|mute|silencie|silencia|silenciar|mutar)\b/u], ['desmute', /\b(?:desmuta|dessilencia|dessilencie|desmutar|retire o silenciamento)\b/u],
  ['delete', /\b(?:delete|deleta|deletar|exclui|apague|apaga)\b.*\b(?:mensagem|isso)\b/u],
  ['play', /\b(?:toque|toca)\b|\bbaixe\b.*\b(?:musica|audio)\b/u],
  ['playvid', /\b(?:baixe|manda|envie)\b.*\bvideo\b/u], ['tradutor', /\b(?:traduza|traduz|traduzir)\b/u],
  ['clima', /\b(?:clima|previsao do tempo)\b/u], ['calculadora', /\b(?:calcule|calcula|calculadora)\b/u],
  ['criador', /\b(?:mostre|mostra|mande|manda)\b.*\bcriador\b/u],
  ['grupo', /\b(?:abra|abre|abrir|feche|fecha|fechar)\s+(?:o\s+)?grupo\b/u],
  ['qrcode', /\bqr\s*code\b/u],
  ['pesquisar', /\b(?:pesquise|pesquisa|pesquisar|procure|procura|procurar)\b(?![^.!?;]{0,80}\b(?:imagem|foto)\b)/u],
  ['pinterest', /\b(?:pesquise|pesquisa|pesquisar|busque|busca|buscar|procure|procura|procurar)\b[^.!?;]{0,80}\b(?:imagem|foto)\b/u],
  ['imagem', /\b(?:gere|gera|gerar|crie|cria|criar)\b[^.!?;]{0,80}\b(?:imagem|foto)\b/u],
  ['carteira', /\b(?:saldo|carteira)\b/u], ['hidetag', /\b(?:avise|avisa|anuncie|anuncia)\s+(?:a\s+)?(?:todo mundo|todos)\b/u],
  ['setdesc', /\b(?:altere|altera|mude|muda)\s+(?:a\s+)?descricao(?:\s+do\s+grupo)?\b/u],
  ['adv', /\b(?:advirta|adverte|advertir|advertencia)\b/u],
  ['pix', /\b(?:transfira|transfere|transferir|envie|envia|mandar|mande|passe|passa)\b[^.!?;]{0,80}\b(?:moedas?|gold|dinheiro)\b/u],
  ['daily', /\b(?:recompensa|premio)\s+diari[oa]\b/u], ['minerar', /\b(?:minere|minera|minerar)\b/u],
  ['lembrete', /\b(?:crie|cria|criar|agende|agenda|agendar)\s+(?:um\s+)?lembrete\b/u],
  ['nota', /\b(?:salve|salva|salvar|anote|anota|anotar|crie|cria|criar)\s+(?:uma\s+)?nota\b/u],
  ['dados', /\b(?:role|rola|lance|lanca)\s+(?:um\s+)?dad[oa]s?\b/u],
];

function catalogCommand(value: string, catalog: readonly string[], resolve: PlanOptions['resolve']): string | null {
  const resolved = resolve(value).command;
  if (catalog.includes(resolved)) return resolved;
  const comparable = normalize(resolved);
  return catalog.find(command => normalize(command) === comparable) || null;
}

function operationSignature(value: string, catalog: readonly string[], resolve: PlanOptions['resolve']): string {
  const result = resolve(value);
  const canonical = catalogCommand(value, catalog, resolve) || result.command;
  const operation = verifiedOperationAliases.find(aliases => aliases.includes(canonical))?.[0] || canonical;
  return JSON.stringify([operation, result.matchedAlias?.fixedParams || '']);
}

function deterministicNaturalOperation(text: string, catalog: readonly string[], resolve: PlanOptions['resolve']): string | null {
  const current = normalize(instructionText(text)).replace(/(?:^|\s|@)shogun\b[\s,:]*/gu, ' ').trim();
  if (!positiveRequest.test(current)) return null;
  const explicit = [...current.matchAll(/[\p{L}\p{N}_.-]+/gu)]
    .find(word => catalogCommand(word[0], catalog, resolve) !== null);
  const matches = naturalOperations
    .map(([command, pattern]) => ({ command: catalogCommand(command, catalog, resolve), match: pattern.exec(current) }))
    .filter((item): item is { command: string; match: RegExpExecArray } => Boolean(item.command && item.match))
    .sort((left, right) => left.match.index - right.match.index);
  if (!matches[0] || (matches[1]?.match.index === matches[0].match.index
    && operationSignature(matches[1].command, catalog, resolve) !== operationSignature(matches[0].command, catalog, resolve))) return null;
  if (explicit && explicit.index! <= matches[0].match.index) return null;
  if (matches[0].command === catalogCommand('grupo', catalog, resolve)
    && /\b(?:agende|agenda|programe|programa|amanha|horario|as\s+\d{1,2}(?::\d{2})?)\b/u.test(current)) return null;
  return matches[0].command;
}

function currentInstruction(text: string, token: string, catalog: readonly string[], resolve: PlanOptions['resolve']): boolean {
  const current = normalize(instructionText(text))
    .replace(/(?:^|\s|@)shogun\b[\s,:]*/gu, ' ').trim();
  if (/^(?:como|o que|por que|quem|quando|explique|explica)\b|^qual\b.*\bcomando\b|\b(?:o que|como)\b.*\b(?:faz|funciona|significa)\b/u.test(current)) return false;
  if (/\bse\b[^.!?;]{0,160}\b(?:funciona|faz|serve|e perigoso|e seguro)\b/u.test(current)
    || /\b(?:explicacao|explicacoes|tutorial|passo a passo)\b[^.!?;]{0,80}\b(?:sobre|do|da|de)\b/u.test(current)) return false;
  if (/\b(?:ignore|ignora|desconsidere|burle)\b.*\b(?:regras|sistema|instrucoes|permissoes)\b/u.test(current)) return false;
  if (/\b(?:como usar|como executar|sintaxe|simulacao|simular|exemplo|perguntando|passo a passo|tutorial sobre|instrucoes sobre)\b/u.test(current)) return false;
  if (hasNegativeRequest(current)) return false;
  if (/\b(?:nao|nunca|nem)\s+(?:(?:me|o|a)\s+)?(?:execute|faca|faz|bana|banir|abra|abre|feche|fecha|promova|rebaixe|apague|remova|isso)\b/u.test(current)) return false;
  if (/\b(?:pode|consegue|sabe)\b.*\b(?:pessoas|alguem|comandos)\b/u.test(current)) return false;
  const words = [...current.matchAll(/[\p{L}\p{N}_.-]+/gu)];
  const explicit = words.find(word => tokenPattern.test(word[0]) && catalogCommand(word[0], catalog, resolve) !== null);
  const signature = (value: string): string => operationSignature(value, catalog, resolve);
  // O primeiro nome real de comando vincula a operação; argumentos podem conter outros.
  const natural = naturalOperations.map(([command, pattern]) => ({ command, match: pattern.exec(current) }))
    .filter(item => catalog.includes(item.command) && item.match !== null)
    .sort((left, right) => left.match!.index - right.match!.index);
  const firstNatural = natural[0];
  const operationIndex = Math.min(explicit?.index ?? Infinity, firstNatural?.match?.index ?? Infinity);
  if (/\b(?:nao|nunca|nem)\b/u.test(current.slice(0, operationIndex)) || /\bnao para\b/u.test(current)) return false;
  // O nome de uma operação em uma fala sobre ela não é uma solicitação.
  // Verbos só comprovam pedido atual; a operação continua vinculada abaixo.
  const request = positiveRequest.test(current);
  if (/^(?:(?:voce|vc)\s+)?(?:(?:pode|poderia|consegue)\s+)?(?:me\s+)?(?:mostre|mostra|mostrar|veja|ver|diz|diga)\b/u.test(current)
    && !['ping', 'menu', 'clima', 'criador', 'perfil', 'perfilrpg', 'carteira', 'regras', 'loja', 'inventario', 'notas'].includes(resolve(token).command)) return false;
  const latencyQuery = /^qual\b.*\b(?:latencia|tempo de resposta)\b/u.test(current);
  const direct = explicit?.index === 0 && !/\b(?:e|era|faz|funciona|significa|perigoso|seguro|ontem|mencionou|acha)\b/u.test(current)
    && !current.includes('?');
  if (!request && !latencyQuery && !direct) return false;
  if (firstNatural && (!explicit || firstNatural.match!.index < explicit.index!)) {
    if (natural[1]?.match!.index === firstNatural.match!.index) return false;
    return signature(firstNatural.command) === signature(token);
  }
  return Boolean(explicit && signature(explicit[0]) === signature(token));
}

function groundedArguments(values: unknown[], text: string, exactPrefix = false): string[] | null {
  // Exemplos e código não fornecem operandos. Cada span só pode ser consumido
  // uma vez e na ordem original; a saída conserva caixa/acentos/links do usuário.
  const source = text.split(/\b(?:exemplo|por exemplo)\b/iu)[0]!.replace(/```[\s\S]*?```|`[^`]*`/gu, '');
  let normalized = '';
  const starts: number[] = [], ends: number[] = [];
  let offset = 0;
  for (const character of source) {
    const value = normalize(character);
    for (const char of value) { normalized += char; starts.push(offset); ends.push(offset + character.length); }
    offset += character.length;
  }
  const args: string[] = [];
  let cursor = 0;
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim() || value.length > 2000 || /[\u0000-\u001f\u007f]/u.test(value)) return null;
    const pattern = normalize(value.trim()).split(/\s+/u).map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('\\s+');
    const expression = new RegExp(`(?<![\\p{L}\\p{N}_@:/.-])${pattern}(?![\\p{L}\\p{N}_@:/.-])`, 'gu');
    expression.lastIndex = cursor;
    const match = expression.exec(normalized);
    if (!match) return null;
    const skipped = normalized.slice(cursor, match.index).replace(/["']/gu, ' ').replace(/\s+/gu, ' ').trim();
    if (exactPrefix && skipped && !/^(?:(?:de|do|da|dos|das|para|por|com|em|no|na|nos|nas|o|a|os|as|um|uma|ao|aos|valor)\s*)+$/u.test(skipped)) return null;
    const end = match.index + match[0].length;
    args.push(source.slice(starts[match.index], ends[end - 1]));
    cursor = end;
  }
  return args.join(' ').length <= 6000 ? args : null;
}

function transportTargetDigits(_text: string, transportTargets: readonly string[] = []): Set<string> {
  const targets = [...new Set(transportTargets.filter(value => typeof value === 'string' && value.trim()))];
  const allowed = new Set<string>();
  if (targets.length !== 1) return allowed;
  const identityDigits = (value: string): string | null => {
    const match = value.trim().toLowerCase().match(/^@?(\d+)(?::\d+)?(?:@(s\.whatsapp\.net|lid))?$/u);
    return match?.[1] || null;
  };
  for (const target of targets) {
    const digits = identityDigits(target);
    if (digits) allowed.add(digits);
  }
  return allowed;
}

function withoutTransportTargets(values: unknown[], text: string, transportTargets: readonly string[] = []): unknown[] {
  const allowed = transportTargetDigits(text, transportTargets);
  if (!allowed.size) return values;
  const identityDigits = (value: string): string | null => value.trim().toLowerCase()
    .match(/^@?(\d+)(?::\d+)?(?:@(s\.whatsapp\.net|lid))?$/u)?.[1] || null;
  return values.filter(value => typeof value !== 'string' || !allowed.has(identityDigits(value) || ''));
}

function maskTransportTargets(value: string, fullText: string, transportTargets: readonly string[] = []): string {
  const allowed = transportTargetDigits(fullText, transportTargets);
  if (!allowed.size) return value;
  return value.replace(/@?(\d+)(?::\d+)?@(s\.whatsapp\.net|lid)|@(\d{3,})\b/gu, match => {
    const digits = match.match(/\d+/u)?.[0] || '';
    return allowed.has(digits) ? ' '.repeat(match.length) : match;
  });
}

export function validateAssistantAction(actions: unknown, text: string, catalog: readonly string[],
  resolve: PlanOptions['resolve'], context: {
    readonly transportTargets?: readonly string[];
    readonly transportTargetCommands?: readonly string[];
  } = {}): AssistantAction | null {
  if (!Array.isArray(actions) || actions.length !== 1) return null;
  const candidate: unknown = actions[0];
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;
  const item = candidate as Record<string, unknown>;
  if (Object.keys(item).length !== 2 || typeof item['command'] !== 'string' || !tokenPattern.test(item['command'])
    || !Array.isArray(item['args']) || item['args'].length > 32) return null;
  let token = item['command'];
  let canonical = catalogCommand(token, catalog, resolve);
  // Cancelamentos/qualificadores posteriores também revogam a solicitação;
  // a segmentação de operandos não pode escondê-los.
  const instruction = normalize(instructionText(text));
  if (/\b(?:como usar|como executar|sintaxe|simulacao|simular|exemplo|perguntando|passo a passo|tutorial sobre|instrucoes sobre)\b/u.test(instruction)
    || hasNegativeRequest(instruction)
    || /\b(?:nao|nunca|nem)\s+(?:(?:me|o|a)\s+)?(?:execute|faca|faz|bana|banir|abra|abre|feche|fecha|promova|rebaixe|apague|remova|isso)\b/u.test(instruction)) return null;
  const currentText = currentRequestSegment(text);
  if (currentText === null || !canonical) return null;
  const deterministic = deterministicNaturalOperation(currentText, catalog, resolve);
  if (deterministic && operationSignature(deterministic, catalog, resolve) !== operationSignature(token, catalog, resolve)) {
    canonical = deterministic;
    token = deterministic;
  }
  if (!currentInstruction(currentText, token, catalog, resolve)) return null;
  const current = normalize(currentText.replace(/```[\s\S]*?```|`[^`]*`|"[^"]*"|'[^']*'/gu, '')).split(/\bexemplo\b/u)[0]!;
  const maskedCurrentText = instructionText(currentText);
  const explicitCurrent = [...maskedCurrentText.matchAll(/[\p{L}\p{N}_.-]+/gu)]
    .find(word => catalog.includes(resolve(normalize(word[0])).command));
  const naturalCurrent = deterministicNaturalOperation(currentText, catalog, resolve);
  const leadsExplicit = (match: RegExpExecArray | null): match is RegExpExecArray => Boolean(match
    && (!explicitCurrent || match.index! < explicitCurrent.index!
      || (naturalCurrent && operationSignature(naturalCurrent, catalog, resolve) === operationSignature(canonical, catalog, resolve))));
  const groupRequests = [...current.matchAll(/\b(abra|abre|abrir|feche|fecha|fechar)\s+(?:o\s+)?grupo\b/gu)];
  if (canonical === 'grupo' && groupRequests.length > 1) return null;
  const groupOperand = canonical === 'grupo' && groupRequests.length === 1
    ? (/^(?:abra|abre|abrir)$/u.test(groupRequests[0]![1]!) ? 'abrir' : 'fechar') : null;
  if (groupOperand) {
    if (item['args'].length > 1 || (item['args'].length === 1 && item['args'][0] !== groupOperand)) return null;
    return { command: canonical, args: [groupOperand], token };
  }
  const reminderRequest = ['lembrete', 'lembrar'].includes(canonical)
    ? /\b(?:crie|cria|criar|agende|agenda|agendar)\s+(?:um\s+)?lembrete\b/iu.exec(maskedCurrentText)
    : null;
  if (leadsExplicit(reminderRequest)) {
    const payload = currentText.slice(reminderRequest.index + reminderRequest[0].length).trim()
      .replace(/^(?:para|de)\s+/iu, '');
    if (!payload) return null;
    return { command: canonical, args: [payload], token };
  }
  const imageRequest = ['imagem', 'pinterest'].includes(canonical)
    ? /\b(?:imagem|foto)\s+(?:de\s+)?(.+)$/iu.exec(maskedCurrentText)
    : null;
  if (leadsExplicit(imageRequest)) {
    const payload = imageRequest[1]?.trim();
    if (payload) {
      const payloadStart = imageRequest.index! + imageRequest[0].length - imageRequest[1]!.length;
      return { command: canonical, args: [currentText.slice(payloadStart).trim()], token };
    }
  }
  // O handler de notas exige o subcomando `add`, embora a fala natural não o
  // contenha. Só o sintetizamos quando o próprio pedido atual diz salvar uma
  // nota; o conteúdo ainda precisa estar literalmente presente na mensagem.
  const noteAdd = canonical === 'nota'
    ? /\b(?:salve|salva|salvar|anote|anota|anotar|crie|cria|criar)\s+(?:uma\s+)?nota\b/iu.exec(maskedCurrentText)
    : null;
  if (leadsExplicit(noteAdd)) {
    const values = (item['args'] as unknown[]).filter((value, index) => index !== 0
      || typeof value !== 'string' || !/^(?:add|criar)$/iu.test(value.trim()));
    const noteArgs = groundedArguments(values, currentText.slice(noteAdd.index + noteAdd[0].length));
    if (!noteArgs?.length) return null;
    return { command: canonical, args: ['add', ...noteArgs], token };
  }
  // Para tokens explícitos, o modelo não pode pular o primeiro operando e
  // escolher outra subação. O trecho pertence ao parser comum do comando.
  const masked = maskedCurrentText;
  const explicit = explicitCurrent;
  const naturalIndex = Math.min(...naturalOperations.filter(([command]) => catalog.includes(command))
    .map(([, pattern]) => pattern.exec(normalize(masked))?.index ?? Infinity));
  const explicitOperands = explicit && explicit.index! <= naturalIndex;
  const argumentSource = explicitOperands ? currentText.slice(explicit.index! + explicit[0].length) : currentText;
  const usesTransportTarget = context.transportTargetCommands?.includes(canonical) === true;
  const transportTargets = usesTransportTarget ? context.transportTargets : undefined;
  const proposedArgs = withoutTransportTargets(item['args'] as unknown[], currentText, transportTargets);
  const args = groundedArguments(proposedArgs,
    maskTransportTargets(argumentSource, currentText, transportTargets), Boolean(explicitOperands));
  if (!args) return null;
  return { command: canonical, args, token };
}

export function createAssistantTurnPlanner({ maxEntries = 4096, ttlMs = 300000 } = {}) {
  const seen = new Map<string, number>();
  return {
    async plan(options: PlanOptions): Promise<AssistantTurn> {
      if (!options.eligible) return { kind: 'ignored' };
      const now = Date.now();
      for (const [key, expires] of seen) if (expires <= now) seen.delete(key);
      // Sem identidade estável da mensagem, não há execução/replay seguro.
      if (!options.key || seen.has(options.key)) return { kind: 'ignored' };
      if (seen.size >= maxEntries) return { kind: 'ignored' };
      seen.set(options.key, now + ttlMs);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const controller = new AbortController();
      try {
        const timeout = new Promise<never>((_resolve, reject) => {
          timer = setTimeout(() => { controller.abort(); reject(new Error('ASSISTANT_TIMEOUT')); }, options.timeoutMs ?? 45000);
        });
        const response = await Promise.race([
          options.request(),
          timeout,
        ]);
        if (!(await Promise.race([options.refresh(controller.signal), timeout]))) return { kind: 'ignored' };
        const action = validateAssistantAction(response.actions, options.text, options.catalog, options.resolve,
          { ...(options.transportTargets ? { transportTargets: options.transportTargets } : {}),
            ...(options.transportTargetCommands ? { transportTargetCommands: options.transportTargetCommands } : {}) });
        if (action) return { kind: 'action', action };
        if (Array.isArray(response.actions) && response.actions.length) return {
          kind: 'conversation', response: { resp: [{ resp: 'Não consegui identificar esse pedido com segurança. Diga o comando e os argumentos que quer usar.', react: '' }] },
        };
        return { kind: 'conversation', response };
      } catch { return { kind: 'failed' }; }
      finally { controller.abort(); if (timer) clearTimeout(timer); }
    },
  };
}

export const assistantTurnPlanner = createAssistantTurnPlanner();
