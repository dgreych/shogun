const normalize = value => String(value || '').replace(/:\d+(?=@)/, '');
const addresses = participant => [participant?.id, participant?.jid, participant?.lid, participant?.phoneNumber].filter(Boolean);

async function findParticipant(participants, aliases, match) {
  for (const participant of participants) {
    for (const address of addresses(participant)) {
      for (const alias of aliases.filter(Boolean)) {
        if (normalize(address) === normalize(alias) || (match && await match(address, alias))) return participant;
      }
    }
  }
  return null;
}

export async function changeSelfGroupRole({ socket, groupId, aliases, action, isOwner, match }) {
  if (!isOwner) return { ok: false, message: 'Este comando é exclusivo dos donos do Shogun.' };
  if (!String(groupId).endsWith('@g.us')) return { ok: false, message: 'Use este comando dentro do grupo.' };
  if (!['promote', 'demote'].includes(action)) throw new Error('Ação de grupo inválida.');
  const metadata = await socket.groupMetadata(groupId);
  const participants = Array.isArray(metadata?.participants) ? metadata.participants : [];
  const target = await findParticipant(participants, aliases, match);
  if (!target) return { ok: false, message: 'Não encontrei seu participante na lista atual do grupo. Tente novamente.' };
  const admin = ['admin', 'superadmin'].includes(target.admin);
  if (action === 'demote' && target.admin === 'superadmin') {
    return { ok: false, message: 'Você é o criador deste grupo. O WhatsApp não permite rebaixar o criador.' };
  }
  if ((action === 'demote' && !admin) || (action === 'promote' && admin)) {
    return { ok: true, changed: false, message: action === 'demote' ? 'Você já é membro deste grupo.' : 'Você já é administrador deste grupo.' };
  }
  const bot = await findParticipant(participants, [socket.user?.id, socket.user?.lid, socket.user?.phoneNumber], match);
  if (!bot || !['admin', 'superadmin'].includes(bot.admin)) {
    return { ok: false, message: 'O Shogun precisa ser administrador do grupo para alterar sua função.' };
  }
  const targetId = target.id || target.jid || target.lid || target.phoneNumber;
  const result = await socket.groupParticipantsUpdate(groupId, [targetId], action);
  if (!Array.isArray(result) || !result.length || result.some(item => String(item.status) !== '200')) {
    return { ok: false, message: 'O WhatsApp recusou a alteração. Confira as permissões do Shogun e tente novamente.' };
  }
  return { ok: true, changed: true, message: action === 'demote' ? 'Pronto. Você agora é membro deste grupo.' : 'Pronto. Você agora é administrador deste grupo.' };
}
