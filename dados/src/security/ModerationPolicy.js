const ADMIN_PROTECTED_ACTIONS = new Set(['ban', 'mute', 'mute-delete', 'block']);

const MODERATOR_GRANTABLE_COMMANDS = Object.freeze([
  'deletar', 'delete', 'del', 'd',
  'mute', 'mutar',
  'desmute', 'desmutar', 'unmute',
  'mute2', 'mutar2',
  'desmute2', 'desmutar2', 'unmute2',
  'blockuser', 'unblockuser', 'listblocksgp', 'blocklist'
]);
const moderatorGrantableCommandSet = new Set(MODERATOR_GRANTABLE_COMMANDS);

const DENIAL_MESSAGES = Object.freeze({
  TARGET_REQUIRED: 'Marque ou responda a mensagem da pessoa que será afetada.',
  TARGET_NOT_MEMBER: 'O alvo não pertence a este grupo.',
  SELF_TARGET: 'Por segurança, este comando não pode ser usado em você mesmo.',
  BOT_TARGET: 'Este comando não pode ter o próprio bot como alvo.',
  OWNER_TARGET: 'O dono do bot está protegido contra ações de moderação.',
  SUPERADMIN_TARGET: 'O criador do grupo está protegido contra esta ação.',
  ADMIN_TARGET: 'Administradores do grupo estão protegidos contra esta ação.',
  ALREADY_ADMIN: 'Esta pessoa já é administradora do grupo.',
  NOT_ADMIN: 'Esta pessoa não é administradora do grupo.'
});

function identityBase(value) {
  if (typeof value !== 'string' || !value) return null;
  return value.split('@')[0].split(':')[0] || null;
}

function sameIdentity(first, second) {
  const firstBase = identityBase(first);
  const secondBase = identityBase(second);
  return Boolean(firstBase && secondBase && firstBase === secondBase);
}

function includesIdentity(identities, targetId, matcher = sameIdentity) {
  if (!targetId || !Array.isArray(identities)) return false;
  return identities.some(identity => identity && matcher(identity, targetId));
}

function normalizeCommandName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function canGrantModeratorCommand(command) {
  return moderatorGrantableCommandSet.has(normalizeCommandName(command));
}

function decision(code, targetId = null) {
  return {
    allowed: !code,
    code: code || 'ALLOWED',
    message: code ? DENIAL_MESSAGES[code] : null,
    targetId
  };
}

function evaluateModerationTarget({
  action,
  actorId,
  targetId,
  memberIds = [],
  adminIds = [],
  superAdminIds = [],
  ownerIds = [],
  botIds = [],
  matcher = sameIdentity
}) {
  const normalizedAction = String(action || '').trim().toLowerCase();
  if (!targetId) return decision('TARGET_REQUIRED');
  if (actorId && matcher(actorId, targetId)) return decision('SELF_TARGET', targetId);
  if (includesIdentity(botIds, targetId, matcher)) return decision('BOT_TARGET', targetId);
  if (includesIdentity(ownerIds, targetId, matcher)) return decision('OWNER_TARGET', targetId);
  if (includesIdentity(superAdminIds, targetId, matcher)) {
    return decision('SUPERADMIN_TARGET', targetId);
  }
  if (memberIds.length && !includesIdentity(memberIds, targetId, matcher)) {
    return decision('TARGET_NOT_MEMBER', targetId);
  }

  const targetIsAdmin = includesIdentity(adminIds, targetId, matcher);
  if (ADMIN_PROTECTED_ACTIONS.has(normalizedAction) && targetIsAdmin) {
    return decision('ADMIN_TARGET', targetId);
  }
  if (normalizedAction === 'promote' && targetIsAdmin) {
    return decision('ALREADY_ADMIN', targetId);
  }
  if (normalizedAction === 'demote' && !targetIsAdmin) {
    return decision('NOT_ADMIN', targetId);
  }
  return decision(null, targetId);
}

export {
  ADMIN_PROTECTED_ACTIONS,
  DENIAL_MESSAGES,
  MODERATOR_GRANTABLE_COMMANDS,
  canGrantModeratorCommand,
  evaluateModerationTarget,
  identityBase,
  includesIdentity,
  normalizeCommandName,
  sameIdentity
};
