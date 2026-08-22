import {
  resolveCommandInput,
  type ResolvedCommandInput,
} from './input-resolver.js';

export interface ParsedCommandText {
  readonly isCommand: boolean;
  readonly prefix: string;
  readonly bodyWithoutPrefix: string;
  readonly rawCommandToken: string;
  readonly command: string | null;
  readonly args: readonly string[];
  readonly query: string;
  readonly resolution: ResolvedCommandInput;
}

/**
 * Replica a semântica central do parsing hoje embutido em dados/src/index.js:
 * prefixo por contexto, suporte a "! comando", aliases customizados com
 * fixedParams e aliases builtin. No-prefix continua fora deste parser e cai no
 * compatibility seam até a migração do subsistema correspondente.
 */
export function parseCommandText(
  body: string,
  prefix: string,
  rawAliases: unknown = [],
): ParsedCommandText {
  const normalizedBody = typeof body === 'string' ? body : String(body ?? '');
  const normalizedPrefix = typeof prefix === 'string' ? prefix : String(prefix ?? '');
  if (!normalizedPrefix) throw new Error('Prefixo vazio não é aceito pelo parser vNext.');

  const trimmed = normalizedBody.trim();
  const isCommand = trimmed.startsWith(normalizedPrefix);
  const bodyWithoutPrefix = trimmed.slice(normalizedPrefix.length).trimStart();
  const rawCommandToken = bodyWithoutPrefix.split(/ +/).shift()?.trim() ?? '';
  const resolution = resolveCommandInput(rawCommandToken, rawAliases);
  const userArgs = bodyWithoutPrefix.split(/ +/).slice(1);

  let args = userArgs;
  let query = userArgs.join(' ');

  if (resolution.matchedAlias?.fixedParams) {
    const combinedParams = resolution.matchedAlias.fixedParams + (query ? ` ${query}` : '');
    args = combinedParams.split(/ +/);
    query = combinedParams;
  }

  return Object.freeze({
    isCommand,
    prefix: normalizedPrefix,
    bodyWithoutPrefix,
    rawCommandToken,
    command: isCommand ? resolution.command : null,
    args: Object.freeze([...args]),
    query,
    resolution,
  });
}
