const COMMANDS_WITH_PRIVATE_ARGUMENTS = new Set(['play', 'setnvidia', 'ytmp3']);

export function buildSafeMessagePreview({ isCommand, prefix, command, query, body }) {
  if (isCommand) {
    const commandName = String(command || '');
    const commandLabel = `${String(prefix || '')}${commandName}`;

    if (COMMANDS_WITH_PRIVATE_ARGUMENTS.has(commandName.toLowerCase())) {
      return `${commandLabel} [argumentos omitidos]`;
    }

    const commandQuery = String(query || '');
    return `${commandLabel}${commandQuery ? ` ${commandQuery.substring(0, 25)}${commandQuery.length > 25 ? '...' : ''}` : ''}`;
  }

  const messageBody = String(body || '');
  return messageBody.substring(0, 35) + (messageBody.length > 35 ? '...' : '');
}
