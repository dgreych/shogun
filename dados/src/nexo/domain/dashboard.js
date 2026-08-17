import { createMessageViewModel } from './messageContracts.js';

/**
 * `!painel` -- estado atual do Círculo. Só leitura, nunca cria nada.
 */
async function getGroupDashboard({ repository, context }) {
  const group = await repository.getGroupByTransportChatId(
    context.incoming.groupId || context.incoming.chatId
  );
  if (!group || group.status !== 'ACTIVE') {
    return createMessageViewModel({
      kind: 'CARD',
      title: 'NEXO // Painel',
      sections: [{ lines: ['O NEXO não está ativo neste grupo. Um admin pode usar !nexo ativar.'] }],
      privacy: 'GROUP',
      priority: 'NORMAL'
    });
  }

  const season = await repository.getActiveSeasonForGroup(group.id);
  const world = season ? await repository.getWorldStateBySeasonId(season.id) : null;

  return createMessageViewModel({
    kind: 'CARD',
    title: 'NEXO // Painel do Círculo',
    sections: [
      {
        heading: group.name || 'Círculo',
        lines: world
          ? [`Pulso ${world.pulse} | Coesão ${world.cohesion}`, `Lucidez ${world.lucidity} | Entropia ${world.entropy}`]
          : ['Sem temporada ativa ainda.']
      },
      {
        heading: 'Navegação',
        lines: ['!ficha -- sua ficha', '!entrar -- criar personagem, se ainda não tiver']
      }
    ],
    privacy: 'GROUP',
    priority: 'NORMAL'
  });
}

export { getGroupDashboard };
