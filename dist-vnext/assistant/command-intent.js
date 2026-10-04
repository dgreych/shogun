const normalize = (text) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const tokenPattern = /^[\p{L}\p{N}_.-]{1,64}$/u;
const positiveRequest = /^(?:(?:por favor|pfv)\s+)?(?:(?:voce|vc)\s+)?(?:(?:pode|poderia|consegue|quero|queria|gostaria de)\s+)?(?:me\s+)?(?:da|de|execute|executa|executar|rode|roda|rodar|use|usa|usar|mande|manda|mandar|envie|envia|enviar|mostre|mostra|mostrar|faca|faz|fazer|transforme|transforma|converta|converte|bane|bana|banir|expulse|expulsa|remova|remove|promove|promova|rebaixa|rebaixe|muta|mute|silencia|silencie|desmuta|dessilencia|dessilencie|deleta|delete|exclui|apague|apaga|toque|toca|baixe|traduza|traduz|calcule|calcula|abra|abre|feche|fecha)\b/u;
function instructionText(text) {
    // Mantém offsets para segmentar o texto original sem cortar títulos citados.
    return text.replace(/```[\s\S]*?```|`[^`]*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/gu, value => ' '.repeat(value.length));
}
function currentRequestSegment(text) {
    const masked = instructionText(text);
    const separators = [...masked.matchAll(/;|,(?=\s*(?:ele|ela|antes|depois|ou melhor|exemplo|por exemplo|mas|me |execute|mande|mostre))/giu)];
    let start = text.match(/^\s*(?:@?shogun\b[\s,:]*|[,:\s]+)/iu)?.[0].length || 0;
    for (const separator of separators.filter(separator => separator.index >= start)) {
        const next = separator.index + 1;
        if (/\bnao\b.*\b(?:consegui|conseguindo|consigo|estou)\b/u.test(normalize(masked.slice(0, separator.index)))
            && positiveRequest.test(normalize(masked.slice(next).trim()))) {
            start = next;
            break;
        }
    }
    const remaining = normalize(masked.slice(start));
    // Duas operações atuais exigem esclarecimento, em vez de mover operandos.
    for (const conjunction of remaining.matchAll(/\b(?:e(?: depois)?|mas|em seguida)\s+/gu)) {
        if (positiveRequest.test(remaining.slice(conjunction.index + conjunction[0].length)))
            return null;
    }
    const end = separators.find(separator => separator.index >= start)?.index ?? text.length;
    for (const separator of separators.filter(separator => separator.index > end - 1)) {
        if (positiveRequest.test(normalize(masked.slice(separator.index + 1).trim())))
            return null;
    }
    return text.slice(start, end).trim();
}
// Revisados nos respectivos handlers: cada conjunto faz uma única operação,
// sem ramificação por command. Não derivar equivalência das macrofamílias.
const verifiedOperationAliases = [
    ['ban', 'banir', 'b', 'kick'], ['s', 'st', 'stk', 'sticker'],
    ['calculadora', 'calc', 'calcular'], ['tradutor', 'translator'],
];
export function isAssistantEligible(input) {
    if (!input.enabled || input.fromMe || input.fromPro || !input.text.trim()
        || (input.prefix && input.text.trim().startsWith(input.prefix)))
        return false;
    return input.botMentioned || input.repliedToBot || /(?:^|\s|@)shogun(?:\s|[,!?:]|$)/iu.test(input.text);
}
// Estas associações são do produto, não palavras de autoridade produzidas pelo modelo.
// Tokens/aliases de todas as famílias continuam disponíveis sem paráfrase cadastrada.
const naturalOperations = [
    ['ping', /\b(?:latencia|ping|tempo de resposta)\b/u], ['menu', /\b(?:menu principal|lista de comandos|menu)\b/u],
    ['s', /\b(?:figurinha|sticker|adesivo)\b/u], ['ban', /\b(?:bane|bana|banir|expulse|expulsa|expulsar)\b|\b(?:remova|remove)\b.*\b(?:pessoa|membro)\b/u],
    ['promover', /\b(?:promove|promova|promover|torne administrador)\b/u], ['rebaixar', /\b(?:rebaixa|rebaixe|rebaixar|retire o cargo de administrador)\b/u],
    ['mute', /\b(?:muta|mute|silencie|silencia|silenciar|mutar)\b/u], ['desmute', /\b(?:desmuta|dessilencia|dessilencie|desmutar|retire o silenciamento)\b/u],
    ['delete', /\b(?:delete|deleta|deletar|exclui|apague|apaga)\b.*\b(?:mensagem|isso)\b/u], ['play', /\b(?:toque|toca|baixe)\b.*\b(?:musica|audio)\b/u],
    ['playvid', /\b(?:baixe|manda|envie)\b.*\bvideo\b/u], ['tradutor', /\b(?:traduza|traduz|traduzir)\b/u],
    ['clima', /\b(?:clima|previsao do tempo)\b/u], ['calculadora', /\b(?:calcule|calcula|calculadora)\b/u],
    ['criador', /\b(?:mostre|mostra|mande|manda)\b.*\bcriador\b/u],
    ['grupo', /\b(?:abra|abre|abrir|feche|fecha|fechar)\s+(?:o\s+)?grupo\b/u],
];
function catalogCommand(value, catalog, resolve) {
    const resolved = resolve(value).command;
    if (catalog.includes(resolved))
        return resolved;
    const comparable = normalize(resolved);
    return catalog.find(command => normalize(command) === comparable) || null;
}
function operationSignature(value, catalog, resolve) {
    const result = resolve(value);
    const canonical = catalogCommand(value, catalog, resolve) || result.command;
    const operation = verifiedOperationAliases.find(aliases => aliases.includes(canonical))?.[0] || canonical;
    return JSON.stringify([operation, result.matchedAlias?.fixedParams || '']);
}
function deterministicNaturalOperation(text, catalog, resolve) {
    const current = normalize(instructionText(text)).replace(/(?:^|\s|@)shogun\b[\s,:]*/gu, ' ').trim();
    if (!positiveRequest.test(current))
        return null;
    const explicit = [...current.matchAll(/[\p{L}\p{N}_.-]+/gu)]
        .find(word => catalogCommand(word[0], catalog, resolve) !== null);
    const matches = naturalOperations
        .map(([command, pattern]) => ({ command: catalogCommand(command, catalog, resolve), match: pattern.exec(current) }))
        .filter((item) => Boolean(item.command && item.match))
        .sort((left, right) => left.match.index - right.match.index);
    if (!matches[0] || (matches[1]?.match.index === matches[0].match.index
        && operationSignature(matches[1].command, catalog, resolve) !== operationSignature(matches[0].command, catalog, resolve)))
        return null;
    if (explicit && explicit.index <= matches[0].match.index)
        return null;
    if (matches[0].command === catalogCommand('grupo', catalog, resolve)
        && /\b(?:agende|agenda|programe|programa|amanha|horario|as\s+\d{1,2}(?::\d{2})?)\b/u.test(current))
        return null;
    return matches[0].command;
}
function currentInstruction(text, token, catalog, resolve) {
    const current = normalize(instructionText(text))
        .replace(/(?:^|\s|@)shogun\b[\s,:]*/gu, ' ').trim();
    if (/^(?:como|o que|por que|quem|quando|explique|explica)\b|^qual\b.*\bcomando\b|\b(?:o que|como)\b.*\b(?:faz|funciona|significa)\b/u.test(current))
        return false;
    if (/\b(?:ignore|ignora|desconsidere|burle)\b.*\b(?:regras|sistema|instrucoes|permissoes)\b/u.test(current))
        return false;
    if (/\b(?:como usar|como executar|sintaxe|simulacao|simular|exemplo|perguntando|passo a passo|tutorial sobre|instrucoes sobre)\b/u.test(current))
        return false;
    if (/\b(?:nao|nunca|nem)\s+(?:(?:me|o|a)\s+)?(?:execute|faca|faz|bana|banir|abra|abre|feche|fecha|promova|rebaixe|apague|remova|isso)\b/u.test(current))
        return false;
    if (/\b(?:pode|consegue|sabe)\b.*\b(?:pessoas|alguem|comandos)\b/u.test(current))
        return false;
    const words = [...current.matchAll(/[\p{L}\p{N}_.-]+/gu)];
    const explicit = words.find(word => tokenPattern.test(word[0]) && catalogCommand(word[0], catalog, resolve) !== null);
    const signature = (value) => operationSignature(value, catalog, resolve);
    // O primeiro nome real de comando vincula a operação; argumentos podem conter outros.
    const natural = naturalOperations.map(([command, pattern]) => ({ command, match: pattern.exec(current) }))
        .filter(item => catalog.includes(item.command) && item.match !== null)
        .sort((left, right) => left.match.index - right.match.index);
    const firstNatural = natural[0];
    const operationIndex = Math.min(explicit?.index ?? Infinity, firstNatural?.match?.index ?? Infinity);
    if (/\b(?:nao|nunca|nem)\b/u.test(current.slice(0, operationIndex)) || /\bnao para\b/u.test(current))
        return false;
    // O nome de uma operação em uma fala sobre ela não é uma solicitação.
    // Verbos só comprovam pedido atual; a operação continua vinculada abaixo.
    const request = positiveRequest.test(current);
    if (/^(?:(?:voce|vc)\s+)?(?:(?:pode|poderia|consegue)\s+)?(?:me\s+)?(?:mostre|mostra|mostrar)\b/u.test(current)
        && !['ping', 'menu', 'clima', 'criador', 'perfilrpg', 'loja'].includes(resolve(token).command))
        return false;
    const latencyQuery = /^qual\b.*\b(?:latencia|tempo de resposta)\b/u.test(current);
    const direct = explicit?.index === 0 && !/\b(?:e|era|faz|funciona|significa|perigoso|seguro|ontem|mencionou|acha)\b/u.test(current)
        && !current.includes('?');
    if (!request && !latencyQuery && !direct)
        return false;
    if (firstNatural && (!explicit || firstNatural.match.index < explicit.index)) {
        if (natural[1]?.match.index === firstNatural.match.index)
            return false;
        return signature(firstNatural.command) === signature(token);
    }
    return Boolean(explicit && signature(explicit[0]) === signature(token));
}
function groundedArguments(values, text, exactPrefix = false) {
    // Exemplos e código não fornecem operandos. Cada span só pode ser consumido
    // uma vez e na ordem original; a saída conserva caixa/acentos/links do usuário.
    const source = text.split(/\b(?:exemplo|por exemplo)\b/iu)[0].replace(/```[\s\S]*?```|`[^`]*`/gu, '');
    let normalized = '';
    const starts = [], ends = [];
    let offset = 0;
    for (const character of source) {
        const value = normalize(character);
        for (const char of value) {
            normalized += char;
            starts.push(offset);
            ends.push(offset + character.length);
        }
        offset += character.length;
    }
    const args = [];
    let cursor = 0;
    for (const value of values) {
        if (typeof value !== 'string' || !value.trim() || value.length > 2000 || /[\u0000-\u001f\u007f]/u.test(value))
            return null;
        const pattern = normalize(value.trim()).split(/\s+/u).map(part => part.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('\\s+');
        const expression = new RegExp(`(?<![\\p{L}\\p{N}_@:/.-])${pattern}(?![\\p{L}\\p{N}_@:/.-])`, 'gu');
        expression.lastIndex = cursor;
        const match = expression.exec(normalized);
        if (!match)
            return null;
        const skipped = normalized.slice(cursor, match.index).replace(/["']/gu, ' ').replace(/\s+/gu, ' ').trim();
        if (exactPrefix && skipped && !/^(?:(?:de|do|da|dos|das|para|por|com|em|no|na|nos|nas|o|a|os|as|um|uma|ao|aos|valor)\s*)+$/u.test(skipped))
            return null;
        const end = match.index + match[0].length;
        args.push(source.slice(starts[match.index], ends[end - 1]));
        cursor = end;
    }
    return args.join(' ').length <= 6000 ? args : null;
}
function transportTargetDigits(_text, transportTargets = []) {
    const targets = [...new Set(transportTargets.filter(value => typeof value === 'string' && value.trim()))];
    const allowed = new Set();
    if (targets.length !== 1)
        return allowed;
    const identityDigits = (value) => {
        const match = value.trim().toLowerCase().match(/^@?(\d+)(?::\d+)?(?:@(s\.whatsapp\.net|lid))?$/u);
        return match?.[1] || null;
    };
    for (const target of targets) {
        const digits = identityDigits(target);
        if (digits)
            allowed.add(digits);
    }
    return allowed;
}
function withoutTransportTargets(values, text, transportTargets = []) {
    const allowed = transportTargetDigits(text, transportTargets);
    if (!allowed.size)
        return values;
    const identityDigits = (value) => value.trim().toLowerCase()
        .match(/^@?(\d+)(?::\d+)?(?:@(s\.whatsapp\.net|lid))?$/u)?.[1] || null;
    return values.filter(value => typeof value !== 'string' || !allowed.has(identityDigits(value) || ''));
}
function maskTransportTargets(value, fullText, transportTargets = []) {
    const allowed = transportTargetDigits(fullText, transportTargets);
    if (!allowed.size)
        return value;
    return value.replace(/@?(\d+)(?::\d+)?@(s\.whatsapp\.net|lid)|@(\d{3,})\b/gu, match => {
        const digits = match.match(/\d+/u)?.[0] || '';
        return allowed.has(digits) ? ' '.repeat(match.length) : match;
    });
}
export function validateAssistantAction(actions, text, catalog, resolve, context = {}) {
    if (!Array.isArray(actions) || actions.length !== 1)
        return null;
    const candidate = actions[0];
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate))
        return null;
    const item = candidate;
    if (Object.keys(item).length !== 2 || typeof item['command'] !== 'string' || !tokenPattern.test(item['command'])
        || !Array.isArray(item['args']) || item['args'].length > 32)
        return null;
    let token = item['command'];
    let canonical = catalogCommand(token, catalog, resolve);
    // Cancelamentos/qualificadores posteriores também revogam a solicitação;
    // a segmentação de operandos não pode escondê-los.
    const instruction = normalize(instructionText(text));
    if (/\b(?:como usar|como executar|sintaxe|simulacao|simular|exemplo|perguntando|passo a passo|tutorial sobre|instrucoes sobre)\b/u.test(instruction)
        || /\b(?:nao|nunca|nem)\s+(?:(?:me|o|a)\s+)?(?:execute|faca|faz|bana|banir|abra|abre|feche|fecha|promova|rebaixe|apague|remova|isso)\b/u.test(instruction))
        return null;
    const currentText = currentRequestSegment(text);
    if (currentText === null || !canonical)
        return null;
    const deterministic = deterministicNaturalOperation(currentText, catalog, resolve);
    if (deterministic && operationSignature(deterministic, catalog, resolve) !== operationSignature(token, catalog, resolve)) {
        canonical = deterministic;
        token = deterministic;
    }
    if (!currentInstruction(currentText, token, catalog, resolve))
        return null;
    const current = normalize(currentText.replace(/```[\s\S]*?```|`[^`]*`|"[^"]*"|'[^']*'/gu, '')).split(/\bexemplo\b/u)[0];
    const groupRequests = [...current.matchAll(/\b(abra|abre|abrir|feche|fecha|fechar)\s+(?:o\s+)?grupo\b/gu)];
    if (canonical === 'grupo' && groupRequests.length > 1)
        return null;
    const groupOperand = canonical === 'grupo' && groupRequests.length === 1
        ? (/^(?:abra|abre|abrir)$/u.test(groupRequests[0][1]) ? 'abrir' : 'fechar') : null;
    if (groupOperand) {
        if (item['args'].length > 1 || (item['args'].length === 1 && item['args'][0] !== groupOperand))
            return null;
        return { command: canonical, args: [groupOperand], token };
    }
    // Para tokens explícitos, o modelo não pode pular o primeiro operando e
    // escolher outra subação. O trecho pertence ao parser comum do comando.
    const masked = instructionText(currentText);
    const explicit = [...masked.matchAll(/[\p{L}\p{N}_.-]+/gu)]
        .find(word => catalog.includes(resolve(normalize(word[0])).command));
    const naturalIndex = Math.min(...naturalOperations.filter(([command]) => catalog.includes(command))
        .map(([, pattern]) => pattern.exec(normalize(masked))?.index ?? Infinity));
    const explicitOperands = explicit && explicit.index <= naturalIndex;
    const argumentSource = explicitOperands ? currentText.slice(explicit.index + explicit[0].length) : currentText;
    const usesTransportTarget = context.transportTargetCommands?.includes(canonical) === true;
    const transportTargets = usesTransportTarget ? context.transportTargets : undefined;
    const proposedArgs = withoutTransportTargets(item['args'], currentText, transportTargets);
    const args = groundedArguments(proposedArgs, maskTransportTargets(argumentSource, currentText, transportTargets), Boolean(explicitOperands));
    if (!args)
        return null;
    return { command: canonical, args, token };
}
export function createAssistantTurnPlanner({ maxEntries = 4096, ttlMs = 300000 } = {}) {
    const seen = new Map();
    return {
        async plan(options) {
            if (!options.eligible)
                return { kind: 'ignored' };
            const now = Date.now();
            for (const [key, expires] of seen)
                if (expires <= now)
                    seen.delete(key);
            // Sem identidade estável da mensagem, não há execução/replay seguro.
            if (!options.key || seen.has(options.key))
                return { kind: 'ignored' };
            if (seen.size >= maxEntries)
                return { kind: 'ignored' };
            seen.set(options.key, now + ttlMs);
            let timer;
            const controller = new AbortController();
            try {
                const timeout = new Promise((_resolve, reject) => {
                    timer = setTimeout(() => { controller.abort(); reject(new Error('ASSISTANT_TIMEOUT')); }, options.timeoutMs ?? 45000);
                });
                const response = await Promise.race([
                    options.request(),
                    timeout,
                ]);
                if (!(await Promise.race([options.refresh(controller.signal), timeout])))
                    return { kind: 'ignored' };
                const action = validateAssistantAction(response.actions, options.text, options.catalog, options.resolve, { ...(options.transportTargets ? { transportTargets: options.transportTargets } : {}),
                    ...(options.transportTargetCommands ? { transportTargetCommands: options.transportTargetCommands } : {}) });
                if (action)
                    return { kind: 'action', action };
                if (Array.isArray(response.actions) && response.actions.length)
                    return {
                        kind: 'conversation', response: { resp: [{ resp: 'Não consegui identificar esse pedido com segurança. Diga o comando e os argumentos que quer usar.', react: '' }] },
                    };
                return { kind: 'conversation', response };
            }
            catch {
                return { kind: 'failed' };
            }
            finally {
                controller.abort();
                if (timer)
                    clearTimeout(timer);
            }
        },
    };
}
export const assistantTurnPlanner = createAssistantTurnPlanner();
//# sourceMappingURL=command-intent.js.map