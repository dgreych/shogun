export type ModerationCommandKind =
  | 'delete-message'
  | 'ban'
  | 'promote'
  | 'demote'
  | 'mute'
  | 'unmute'
  | 'mute-delete'
  | 'unmute-delete'
  | 'block'
  | 'unblock'
  | 'block-list';

export interface ModerationCommandDescriptor {
  readonly id: string;
  readonly kind: ModerationCommandKind;
  readonly tokens: readonly string[];
  readonly requiresRealAdmin: boolean;
  readonly requiresBotAdmin: boolean;
}

function descriptor(input: ModerationCommandDescriptor): ModerationCommandDescriptor {
  return Object.freeze({ ...input, tokens: Object.freeze([...input.tokens]) });
}

/**
 * Kernel coeso de moderação extraído do switch(command) legado.
 *
 * Cada descritor corresponde a uma família top-level completa do dispatcher.
 * O domínio preserva a distinção histórica entre administrador real/dono e
 * moderador com permissão concedida, sem ampliar privilégios por acidente.
 */
export const MODERATION_COMMAND_DESCRIPTORS = Object.freeze([
  descriptor({
    id: 'delete-message',
    kind: 'delete-message',
    tokens: ['deletar', 'delete', 'del', 'd'],
    requiresRealAdmin: false,
    requiresBotAdmin: false,
  }),
  descriptor({
    id: 'ban',
    kind: 'ban',
    tokens: ['banir', 'ban', 'b', 'kick'],
    requiresRealAdmin: true,
    requiresBotAdmin: true,
  }),
  descriptor({
    id: 'promote',
    kind: 'promote',
    tokens: ['promover', 'promote'],
    requiresRealAdmin: true,
    requiresBotAdmin: true,
  }),
  descriptor({
    id: 'demote',
    kind: 'demote',
    tokens: ['rebaixar', 'demote'],
    requiresRealAdmin: true,
    requiresBotAdmin: true,
  }),
  descriptor({
    id: 'mute',
    kind: 'mute',
    tokens: ['mute', 'mutar'],
    requiresRealAdmin: false,
    requiresBotAdmin: true,
  }),
  descriptor({
    id: 'unmute',
    kind: 'unmute',
    tokens: ['desmute', 'desmutar', 'unmute'],
    requiresRealAdmin: false,
    requiresBotAdmin: false,
  }),
  descriptor({
    id: 'mute-delete',
    kind: 'mute-delete',
    tokens: ['mute2', 'mutar2'],
    requiresRealAdmin: false,
    requiresBotAdmin: true,
  }),
  descriptor({
    id: 'unmute-delete',
    kind: 'unmute-delete',
    tokens: ['desmute2', 'desmutar2', 'unmute2'],
    requiresRealAdmin: false,
    requiresBotAdmin: false,
  }),
  descriptor({
    id: 'block',
    kind: 'block',
    tokens: ['blockuser'],
    requiresRealAdmin: false,
    requiresBotAdmin: false,
  }),
  descriptor({
    id: 'unblock',
    kind: 'unblock',
    tokens: ['unblockuser'],
    requiresRealAdmin: false,
    requiresBotAdmin: false,
  }),
  descriptor({
    id: 'block-list',
    kind: 'block-list',
    tokens: ['listblocksgp', 'blocklist'],
    requiresRealAdmin: false,
    requiresBotAdmin: false,
  }),
] satisfies readonly ModerationCommandDescriptor[]);

export const MODERATION_COMMAND_TOKENS = Object.freeze(
  MODERATION_COMMAND_DESCRIPTORS.flatMap((item) => item.tokens),
);

const byToken = new Map<string, ModerationCommandDescriptor>();
for (const item of MODERATION_COMMAND_DESCRIPTORS) {
  for (const token of item.tokens) {
    if (byToken.has(token)) throw new Error(`Token duplicado no domínio de moderação: ${token}`);
    byToken.set(token, item);
  }
}

export function findModerationCommandDescriptor(
  command: string,
): ModerationCommandDescriptor | undefined {
  return byToken.get(String(command || '').trim().toLowerCase());
}
