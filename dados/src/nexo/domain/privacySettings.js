import { NexoValidationError } from '../errors.js';
import { createMessageViewModel } from './messageContracts.js';

/**
 * `!privado on|off` -- consentimento para DM (seção 3.2 do PDF: "nenhum
 * DM espontâneo... exige adesão"). Exige personagem existente: sem
 * personagem não há nada pessoal a proteger ainda.
 */
async function setPrivacyPreference({ repository, context, enabled }) {
  const group = await repository.getGroupByTransportChatId(
    context.incoming.groupId || context.incoming.chatId
  );
  if (!group || group.status !== 'ACTIVE') {
    throw new NexoValidationError('O NEXO não está ativo neste grupo.', { code: 'RPG_NOT_ACTIVE' });
  }
  const player = await repository.getPlayerByUserAndGroup(context.actor.canonicalUserId, group.id);
  if (!player) {
    throw new NexoValidationError('Você ainda não tem personagem aqui. Use !entrar.', { code: 'PLAYER_NOT_JOINED' });
  }

  const updated = await repository.setPlayerPrivateOptIn(player.id, enabled);

  return createMessageViewModel({
    kind: 'CONFIRMATION',
    title: 'NEXO // Privacidade',
    sections: [{
      lines: [updated.privateOptIn
        ? 'Saídas pessoais (como !ficha) agora chegam no privado quando possível.'
        : 'Saídas pessoais voltam a aparecer no grupo.']
    }],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

export { setPrivacyPreference };
