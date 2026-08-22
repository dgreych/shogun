import { ensureAdminAccess } from './access.js';
import { adminAccess } from './contracts.js';
import { BaileysAdminGroupPort } from './group-port.js';
import { isRecord, JsonGroupStateStore } from './state.js';
async function sendX9(context, text, mentions) {
    if (context.groupData.x9 !== true)
        return;
    try {
        await new BaileysAdminGroupPort(context.socket).send(context.groupId, {
            text,
            mentions: [...mentions],
        });
    }
    catch (error) {
        console.error('[vnext:admin:x9] falha ao enviar relatório:', error);
    }
}
async function linkGroup(context) {
    if (!(await ensureAdminAccess(context, adminAccess({ botAdmin: true }))))
        return;
    const port = new BaileysAdminGroupPort(context.socket);
    try {
        const [code, metadata] = await Promise.all([
            port.inviteCode(context.groupId),
            port.metadata(context.groupId),
        ]);
        const admins = metadata.participants.filter((participant) => participant.admin === 'admin' || participant.admin === 'superadmin').length;
        const text = [
            '*🔗 LINK DO GRUPO 🔗*',
            '',
            '📋 *Informações:*',
            '',
            `👥 *Grupo:* ${metadata.subject}`,
            `👤 *Membros:* ${metadata.participants.length}`,
            `👑 *Admins:* ${admins}`,
            `🕒 *Gerado em:* ${new Date().toLocaleString('pt-BR')}`,
            '',
            '_🔗 *Link de convite:*_',
            `https://chat.whatsapp.com/${code}`,
            '',
            '_⚠️ *Avisos:*_',
            '• Compartilhe apenas com quem confia',
            '• Administradores podem revogar o link nas configurações do grupo',
            '_✨ *Compartilhe com responsabilidade!* ✨_',
        ].join('\n');
        await port.send(context.groupId, { text, mentions: [context.sender] }, { quoted: context.message });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('[vnext:admin:linkgp] falha:', error);
        if (message.includes('not-authorized')) {
            await context.reply('❌ Não tenho permissão para gerar o link. Verifique se sou administrador do grupo.');
        }
        else if (message.includes('group-invite-link-disabled')) {
            await context.reply('❌ Os links de convite estão desativados neste grupo. Ative nas configurações do grupo.');
        }
        else {
            await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
        }
    }
}
async function listRequests(context) {
    if (!(await ensureAdminAccess(context, adminAccess({ botAdmin: true }))))
        return;
    try {
        const requests = await new BaileysAdminGroupPort(context.socket).listJoinRequests(context.groupId);
        if (requests.length === 0) {
            await context.reply('📭 Não há solicitações pendentes neste grupo.');
            return;
        }
        const lines = requests.map((request, index) => `${index + 1}. @${request.jid.split('@')[0]}`);
        const text = `📨 *Solicitações Pendentes* (${requests.length})\n\n${lines.join('\n')}\n\n💡 Comandos disponíveis:\n• ${context.prefix}aprovar @usuario - Aceitar uma solicitação\n• ${context.prefix}aprovar all - Aceitar TODAS\n• ${context.prefix}recusarsolic @usuario - Recusar solicitação`;
        await context.reply(text, { mentions: requests.map((request) => request.jid) });
    }
    catch (error) {
        console.error('[vnext:admin:solicitacoes] falha:', error);
        await context.reply('❌ Este recurso não está disponível na versão atual do WhatsApp ou não há solicitações pendentes.');
    }
}
async function setGroupName(context) {
    if (!(await ensureAdminAccess(context, adminAccess({ realAdmin: true, botAdmin: true }))))
        return;
    const name = context.query.trim();
    if (!name) {
        await context.reply(`❌ Digite um novo nome para o grupo.\n\n📝 *Uso:* ${context.prefix}nomegp Nome do Grupo`);
        return;
    }
    const port = new BaileysAdminGroupPort(context.socket);
    try {
        const metadata = await port.metadata(context.groupId);
        await port.setSubject(context.groupId, name);
        await sendX9(context, `✏️ *X9 Report:* Nome do grupo alterado por @${context.sender.split('@')[0]}\n\n🔹 Anterior: *${metadata.subject || 'Nome anterior'}*\n🔸 Novo: *${name}*`, [context.sender]);
        await context.reply(`✅ Nome do grupo alterado para: *${name}*`);
    }
    catch (error) {
        console.error('[vnext:admin:setname] falha:', error);
        await context.reply('ocorreu um erro 💔');
    }
}
async function setGroupDescription(context) {
    if (!(await ensureAdminAccess(context, adminAccess({ botAdmin: true }))))
        return;
    const description = context.query.trim();
    if (!description) {
        await context.reply(`❌ Digite uma nova descrição para o grupo.\n\n📝 *Uso:* ${context.prefix}descgrupo Descrição do grupo aqui`);
        return;
    }
    try {
        await new BaileysAdminGroupPort(context.socket).setDescription(context.groupId, description);
        await sendX9(context, `📝 *X9 Report:* Descrição do grupo alterada por @${context.sender.split('@')[0]}`, [context.sender]);
        await context.reply('✅ Descrição do grupo alterada!');
    }
    catch (error) {
        console.error('[vnext:admin:setdesc] falha:', error);
        await context.reply('ocorreu um erro 💔');
    }
}
async function setGroupMode(context) {
    if (!(await ensureAdminAccess(context, adminAccess({ botAdmin: true }))))
        return;
    const value = context.query.trim().toLowerCase();
    const open = ['a', 'o', 'open', 'abrir'].includes(value);
    const close = ['f', 'c', 'close', 'fechar'].includes(value);
    if (!open && !close)
        return;
    try {
        await new BaileysAdminGroupPort(context.socket).setAnnouncement(context.groupId, close);
        if (open) {
            await sendX9(context, `🔓 *X9 Report:* Grupo aberto por @${context.sender.split('@')[0]}. Agora todos podem enviar mensagens.`, [context.sender]);
            await context.reply('Grupo aberto.');
        }
        else {
            await sendX9(context, `🔒 *X9 Report:* Grupo fechado por @${context.sender.split('@')[0]}. Apenas ADMs podem enviar mensagens.`, [context.sender]);
            await context.reply('Grupo fechado.');
        }
    }
    catch (error) {
        console.error('[vnext:admin:grupo] falha:', error);
        await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }
}
async function clearChat(context) {
    if (!(await ensureAdminAccess(context, adminAccess({ botAdmin: true }))))
        return;
    try {
        const blank = Array.from({ length: 500 }, () => '‎ ').join('\n');
        await context.reply(`${blank}\n🧹 Limpeza concluída!`);
    }
    catch (error) {
        console.error('[vnext:admin:limpar] falha:', error);
        await context.reply('Ocorreu um erro ao limpar o chat 💔');
    }
}
async function resetRank(context) {
    if (!(await ensureAdminAccess(context, adminAccess())))
        return;
    try {
        const store = new JsonGroupStateStore(context.groupFile, context.groupData);
        const state = store.read();
        const count = Array.isArray(state.contador) ? state.contador.length : 0;
        state.contador = [];
        store.write(state);
        Object.assign(context.groupData, state);
        await context.reply(`🔄 Reset do rank de atividade concluído!\n\nRemovidas ${count} entradas de usuários. O rank agora está vazio.`);
    }
    catch (error) {
        console.error('[vnext:admin:resetrank] falha:', error);
        await context.reply('Ocorreu um erro ao resetar o rank 💔');
    }
}
async function drawMembers(context) {
    if (!context.isGroup) {
        await context.reply('Este comando só pode ser usado em grupos 💔');
        return;
    }
    try {
        const state = new JsonGroupStateStore(context.groupFile, context.groupData).read();
        const marks = isRecord(state.mark) ? state.mark : {};
        const candidates = context.groupMembers.filter((member) => !['0', 'marca'].includes(String(marks[member] ?? '')));
        if (candidates.length < 2) {
            await context.reply('❌ Preciso de pelo menos 2 membros válidos no grupo para realizar o sorteio!');
            return;
        }
        const count = Number.parseInt(context.query.trim(), 10) || 1;
        if (count < 1) {
            await context.reply('❌ O número de vencedores deve ser maior que 0!');
            return;
        }
        if (count > candidates.length) {
            await context.reply(`❌ Não há membros suficientes! O grupo tem apenas ${candidates.length} membros válidos.`);
            return;
        }
        const available = [...candidates];
        const winners = [];
        while (winners.length < count && available.length > 0) {
            const index = Math.floor(Math.random() * available.length);
            const [winner] = available.splice(index, 1);
            if (winner)
                winners.push(winner);
        }
        const text = winners.map((winner, index) => `🏆 *#${index + 1}* - @${context.getUserName(winner)}`).join('\n');
        await context.reply(`🎉 *Resultado do Sorteio* 🎉\n\n${text}`, { mentions: winners });
    }
    catch (error) {
        console.error('[vnext:admin:sorteio] falha:', error);
        await context.reply('❌ Ocorreu um erro interno. Tente novamente em alguns minutos.');
    }
}
const HANDLERS = new Map();
function register(tokens, handler) {
    for (const token of tokens) {
        if (HANDLERS.has(token))
            throw new Error(`Token administrativo duplicado: ${token}`);
        HANDLERS.set(token, handler);
    }
}
register(['linkgp', 'linkgroup'], linkGroup);
register(['solicitacoes', 'pendentes', 'requests'], listRequests);
register(['setname', 'nomegp', 'mudarnome', 'alterarnome', 'renomeargrupo'], setGroupName);
register(['setdesc', 'descgrupo', 'mudardesc', 'alterardesc', 'descricao'], setGroupDescription);
register(['grupo', 'gp', 'group'], setGroupMode);
register(['limpar', 'clean'], clearChat);
register(['resetrank'], resetRank);
register(['sorteio'], drawMembers);
export const ADMIN_GROUP_COMMAND_TOKENS = Object.freeze([...HANDLERS.keys()]);
export class AdminGroupDispatchTarget {
    async dispatch(command, context) {
        const handler = HANDLERS.get(String(command || '').trim().toLowerCase());
        if (!handler)
            return false;
        await handler(context);
        return true;
    }
}
//# sourceMappingURL=group-domain.js.map