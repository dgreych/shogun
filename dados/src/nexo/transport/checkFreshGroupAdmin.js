import { convertIdsToLid, idInArray } from '../../utils/helpers.js';

// Mesma extração usada em dados/src/index.js para admins de grupo (LID
// preferencial, sufixo :XX removido). Duplicada aqui de propósito -- é uma
// função pura de 12 linhas e dados/src/index.js não exporta a sua própria
// cópia local para reuso.
function extractParticipantId(participant) {
  if (!participant) return null;
  let id = participant.lid || participant.id || null;
  if (id && id.includes(':')) {
    const suffix = id.includes('@lid') ? '@lid' : '@s.whatsapp.net';
    id = id.split(':')[0] + suffix;
  }
  return id;
}

/**
 * Verifica se `senderId` é admin/superadmin AGORA, buscando metadata fresca
 * do grupo (nunca o cache da mensagem). Seção 16 do PDF exige isso
 * especificamente para `!nexo ativar`/`confirmar`/`desativar` -- ações que
 * mutam estado do grupo não podem confiar em cache potencialmente velho.
 */
async function checkFreshGroupAdmin({ socket, groupChatId, senderId }) {
  const metadata = await socket.groupMetadata(groupChatId).catch(() => null);
  if (!metadata?.participants) return false;
  const rawAdmins = metadata.participants
    .filter(participant => participant.admin === 'admin' || participant.admin === 'superadmin')
    .map(extractParticipantId)
    .filter(Boolean);
  const admins = await convertIdsToLid(socket, rawAdmins);
  return idInArray(senderId, admins);
}

export { checkFreshGroupAdmin, extractParticipantId };
