import { NexoValidationError } from '../errors.js';
import { createMessageViewModel } from './messageContracts.js';
import { assertOnboardingContentProvider } from './onboardingContentProvider.js';

function labelFor(options, id, fallback = id) {
  if (!id) return fallback;
  return options.find(option => option.id === id)?.label || fallback;
}

/**
 * `!ficha` -- só leitura, nunca cria personagem por quem não tem (isso é
 * `!entrar`). Traduz impulse/scar (IDs internos) para os nomes reais via
 * o mesmo content provider do onboarding.
 */
async function getCharacterSheet({ repository, context, contentProvider }) {
  assertOnboardingContentProvider(contentProvider);
  const group = await repository.getGroupByTransportChatId(
    context.incoming.groupId || context.incoming.chatId
  );
  if (!group || group.status !== 'ACTIVE') {
    throw new NexoValidationError('O NEXO não está ativo neste grupo.', { code: 'RPG_NOT_ACTIVE' });
  }

  const player = await repository.getPlayerByUserAndGroup(context.actor.canonicalUserId, group.id);
  const character = player ? await repository.getCharacterByPlayerId(player.id) : null;
  if (!player || !character) {
    throw new NexoValidationError('Você ainda não tem personagem aqui. Use !entrar.', { code: 'PLAYER_NOT_JOINED' });
  }

  const impulses = contentProvider.listImpulses();
  const scars = contentProvider.listScars();
  const origins = contentProvider.listOrigins();

  return createMessageViewModel({
    kind: 'CARD',
    title: `NEXO // Ficha${character.name ? ` -- ${character.name}` : ''}`,
    sections: [{
      lines: [
        `Patamar ${character.tier} | Memória ${character.memory}`,
        `Impulso: ${labelFor(impulses, character.impulse)}`,
        `Cicatriz: ${labelFor(scars, character.scar)}`,
        `Origem: ${labelFor(origins, character.origin, 'ainda não definida')}`
      ]
    }],
    privacy: 'PRIVATE_IF_CONSENTED',
    priority: 'NORMAL'
  });
}

export { getCharacterSheet };
