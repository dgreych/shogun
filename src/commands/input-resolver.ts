export const BUILTIN_COMMAND_ALIASES = Object.freeze({
  d: 'delete',
  del: 'delete',
  deletar: 'delete',
  delete: 'delete',
} as const);

export type CommandResolutionSource = 'builtin' | 'custom' | 'direct';

export interface NormalizedCommandAlias extends Record<string, unknown> {
  readonly alias: string;
  readonly command: string;
  readonly fixedParams: string;
}

export interface ResolvedCommandInput {
  readonly command: string;
  readonly matchedAlias: NormalizedCommandAlias | null;
  readonly source: CommandResolutionSource;
}

function normalizeLegacyText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export function normalizeCommandToken(value: unknown): string {
  const legacyTruthyValue = value ? value : '';
  return normalizeLegacyText(String(legacyTruthyValue).trim()).replace(/\s+/g, '');
}

export function normalizeCommandAliases(rawData: unknown): readonly NormalizedCommandAlias[] {
  const rawRecord = rawData && typeof rawData === 'object'
    ? rawData as Record<string, unknown>
    : null;
  const source = Array.isArray(rawData)
    ? rawData
    : Array.isArray(rawRecord?.aliases)
      ? rawRecord.aliases
      : [];

  const seen = new Set<string>();
  const aliases: NormalizedCommandAlias[] = [];

  for (const item of source) {
    if (!item || typeof item !== 'object') continue;

    const record = item as Record<string, unknown>;
    const alias = normalizeCommandToken(record.alias);
    const command = normalizeCommandToken(record.command);
    if (!alias || !command || seen.has(alias)) continue;

    if (Object.prototype.hasOwnProperty.call(BUILTIN_COMMAND_ALIASES, alias)) continue;

    seen.add(alias);
    aliases.push({
      ...record,
      alias,
      command,
      fixedParams: typeof record.fixedParams === 'string' ? record.fixedParams.trim() : '',
    });
  }

  return aliases;
}

export function resolveCommandInput(
  rawToken: unknown,
  rawAliases: unknown = [],
): ResolvedCommandInput {
  const token = normalizeCommandToken(rawToken);
  const builtinCommand = BUILTIN_COMMAND_ALIASES[
    token as keyof typeof BUILTIN_COMMAND_ALIASES
  ];

  if (builtinCommand) {
    return {
      command: builtinCommand,
      matchedAlias: null,
      source: 'builtin',
    };
  }

  const aliases = normalizeCommandAliases(rawAliases);
  const matchedAlias = aliases.find((item) => item.alias === token) ?? null;

  return {
    command: matchedAlias?.command ?? token,
    matchedAlias,
    source: matchedAlias ? 'custom' : 'direct',
  };
}
