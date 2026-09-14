async function member_001_roles(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { ROLE_GOING_BASE, ROLE_NOT_GOING_BASE, args, formatRoleSummary, from, groupData, groupPrefix, isGroup, isGroupAdmin, nazu, normalizar, reply, sender } = scope;
    try {
        switch (command) {
            case 'roles':
            case 'role.lista':
            case 'listaroles': {
                try {
                    if (!isGroup) {
                        await reply('⚠️ Este comando só pode ser usado em grupos.');
                        break;
                    }
                    const roleEntries = Object.entries(groupData.roles || {});
                    if (!roleEntries.length) {
                        await reply('🪩 Nenhum rolê ativo no momento.');
                        break;
                    }
                    const wantsPv = normalizar(args[0] || '') === 'pv';
                    const sendInPv = !isGroupAdmin || wantsPv;
                    const sendTarget = sendInPv ? sender : from;
                    const listLines = roleEntries.map(([roleCode, roleData], index) => formatRoleSummary(roleCode, roleData, roleEntries.length > 1 ? index : null));
                    const listText = `🪩 *Rolês ativos*\n\n${listLines.join('\n\n')}\n\n🙋 Reaja com ${ROLE_GOING_BASE} ou use ${groupPrefix}role.vou CODIGO\n🤷 Reaja com ${ROLE_NOT_GOING_BASE} ou use ${groupPrefix}role.nvou CODIGO`;
                    try {
                        await nazu.sendMessage(sendTarget, { text: listText });
                        if (sendInPv && sendTarget !== from) {
                            await reply('📬 Enviei a lista de rolês no seu privado!', { mentions: [sender] });
                        }
                    }
                    catch (listError) {
                        console.error('Erro ao enviar lista de rolês:', listError);
                        await reply('❌ Não consegui enviar a lista de rolês agora. Tente novamente mais tarde.');
                    }
                }
                catch (e) {
                    console.error('Erro em listaroles:', e);
                    await reply('❌ Ocorreu um erro ao listar os rolês.');
                }
                break;
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_005_role_vou(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { args, ensureRoleParticipants, groupData, groupPrefix, isGroup, persistGroupData, refreshRoleAnnouncement, reply, sanitizeRoleCode, sender } = scope;
    try {
        switch (command) {
            case 'role.vou': {
                try {
                    if (!isGroup) {
                        await reply('⚠️ Este comando só pode ser usado em grupos.');
                        break;
                    }
                    const code = sanitizeRoleCode(args[0] || '');
                    if (!code) {
                        await reply(`📋 Informe o código do rolê. Exemplo: ${groupPrefix}role.vou CODIGO`);
                        break;
                    }
                    const roleData = groupData.roles[code];
                    if (!roleData) {
                        await reply('❌ Não encontrei nenhum rolê com esse código.');
                        break;
                    }
                    const participants = ensureRoleParticipants(roleData);
                    if (participants.going.includes(sender)) {
                        await reply(`🙋 Você já confirmou presença no rolê *${roleData.title || code}*.`);
                        break;
                    }
                    participants.going.push(sender);
                    participants.notGoing = participants.notGoing.filter(id => id !== sender);
                    participants.updatedAt = new Date().toISOString();
                    groupData.roles[code] = roleData;
                    persistGroupData();
                    await reply(`✅ Presença confirmada no rolê *${roleData.title || code}*.`);
                    // Atualiza anúncio principal
                    await refreshRoleAnnouncement(code, roleData);
                }
                catch (e) {
                    console.error('Erro em role.vou:', e);
                    await reply('❌ Ocorreu um erro ao confirmar sua presença.');
                }
                break;
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_006_role_nvou(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { args, ensureRoleParticipants, groupData, groupPrefix, isGroup, persistGroupData, refreshRoleAnnouncement, reply, sanitizeRoleCode, sender } = scope;
    try {
        switch (command) {
            case 'role.nvou': {
                try {
                    if (!isGroup) {
                        await reply('⚠️ Este comando só pode ser usado em grupos.');
                        break;
                    }
                    const code = sanitizeRoleCode(args[0] || '');
                    if (!code) {
                        await reply(`📋 Informe o código do rolê. Exemplo: ${groupPrefix}role.nvou CODIGO`);
                        break;
                    }
                    const roleData = groupData.roles[code];
                    if (!roleData) {
                        await reply('❌ Não encontrei nenhum rolê com esse código.');
                        break;
                    }
                    const participants = ensureRoleParticipants(roleData);
                    const wasGoing = participants.going.includes(sender);
                    participants.going = participants.going.filter(id => id !== sender);
                    if (!participants.notGoing.includes(sender)) {
                        participants.notGoing.push(sender);
                    }
                    participants.updatedAt = new Date().toISOString();
                    groupData.roles[code] = roleData;
                    persistGroupData();
                    await reply(wasGoing ? `🤷 Presença removida do rolê *${roleData.title || code}*.` : `🤷 Você já estava marcado como ausente para o rolê *${roleData.title || code}*.`);
                    // Atualiza anúncio principal
                    await refreshRoleAnnouncement(code, roleData);
                }
                catch (e) {
                    console.error('Erro em role.nvou:', e);
                    await reply('❌ Ocorreu um erro ao atualizar sua presença.');
                }
                break;
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_007_role(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { args, ensureRoleParticipants, from, getUserName, groupData, groupPrefix, info, isGroup, nazu, reply, sanitizeRoleCode } = scope;
    try {
        switch (command) {
            case 'role':
            case 'role.confirmados':
            case 'role.participantes':
            case 'role.info': {
                try {
                    if (!isGroup) {
                        await reply('⚠️ Este comando só pode ser usado em grupos.');
                        break;
                    }
                    const code = sanitizeRoleCode(args[0] || '');
                    if (!code) {
                        await reply(`📋 Informe o código do rolê. Exemplo: ${groupPrefix}role CODIGO`);
                        break;
                    }
                    const roleData = groupData.roles[code];
                    if (!roleData) {
                        await reply('❌ Não encontrei nenhum rolê com esse código.');
                        break;
                    }
                    const parts = ensureRoleParticipants(roleData);
                    const going = parts.going || [];
                    const notGoing = parts.notGoing || [];
                    const lines = [];
                    lines.push(`🪩 *${roleData.title || code}*`);
                    lines.push(`🎫 Código: ${code}`);
                    if (roleData.when)
                        lines.push(`🗓️ Quando: ${roleData.when}`);
                    if (roleData.where)
                        lines.push(`📍 Onde: ${roleData.where}`);
                    if (roleData.description)
                        lines.push(`📝 Descrição: ${roleData.description}`);
                    lines.push('');
                    lines.push(`🙋 Confirmados (${going.length}):`);
                    lines.push(going.length ? going.map(id => `• @${getUserName(id)}`).join('\n') : '• —');
                    lines.push('');
                    lines.push(`🤷 Desistiram (${notGoing.length}):`);
                    lines.push(notGoing.length ? notGoing.map(id => `• @${getUserName(id)}`).join('\n') : '• —');
                    // Envia com a mídia salva se disponível
                    if (roleData.media) {
                        try {
                            const buffer = Buffer.from(roleData.media.buffer, 'base64');
                            const payload = {
                                caption: lines.join('\n'),
                                mentions: [...going, ...notGoing]
                            };
                            if (roleData.media.type === 'image') {
                                payload.image = buffer;
                                payload.mimetype = roleData.media.mimetype;
                            }
                            else if (roleData.media.type === 'video') {
                                payload.video = buffer;
                                payload.mimetype = roleData.media.mimetype;
                                if (roleData.media.gifPlayback) {
                                    payload.gifPlayback = true;
                                }
                            }
                            await nazu.sendMessage(from, payload, { quoted: info });
                        }
                        catch (mediaError) {
                            console.log('Erro ao enviar mídia do rolê:', mediaError.message);
                            // Se falhar, envia apenas texto
                            await nazu.sendMessage(from, { text: lines.join('\n'), mentions: [...going, ...notGoing] }, { quoted: info });
                        }
                    }
                    else {
                        // Se não tiver mídia, envia apenas texto
                        await nazu.sendMessage(from, { text: lines.join('\n'), mentions: [...going, ...notGoing] }, { quoted: info });
                    }
                }
                catch (e) {
                    console.error('Erro em role.info:', e);
                    await reply('❌ Ocorreu um erro ao buscar informações do rolê.');
                }
                break;
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_014_perfilrpg(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { AllgroupMembers, PICKAXE_TIER_MULT, SKILL_LIST, addSkillXP, applyShopBonuses, despacharEconomiaRpg, ensureEconomyDefaults, ensureUserChallenge, ensureUserPeriodChallenges, ensureUserSkills, findKeyIgnoringAccents, fmt, getActivePickaxe, getEcoUser, getSkillBonus, getUserName, giveMaterial, groupData, isBotSender, isChallengeCompleted, isGroup, isOwner, isPeriodCompleted, isSubOwner, loadEconomy, loadLevelingSafe, menc_jid2, nmrdn, normalizeParam, parseAmount, prefix, pushname, q, relationshipManager, reply, saveEconomy, sender, skillXpForNext, timeLeft, updateChallenge, updatePeriodChallenge, updateQuestProgress } = scope;
    try {
        switch (command) {
            case 'perfilrpg':
            case 'carteira':
            case 'banco':
            case 'depositar':
            case 'dep':
            case 'sacar':
            case 'saque':
            case 'transferir':
            case 'pix':
            case 'loja':
            case 'lojarps':
            case 'comprar':
            case 'buy':
            case 'inventario':
            case 'inv':
            case 'apostar':
            case 'bet':
            case 'slots':
            case 'minerar':
            case 'mine':
            case 'trabalhar':
            case 'work':
            case 'emprego':
            case 'vagas':
            case 'demitir':
            case 'pescar':
            case 'fish':
            case 'explorar':
            case 'explore':
            case 'cacar':
            case 'caçar':
            case 'hunt':
            case 'mercado':
            case 'listar':
            case 'comprarmercado':
            case 'cmerc':
            case 'meusanuncios':
            case 'meusan':
            case 'cancelar':
            case 'propriedades':
            case 'comprarpropriedade':
            case 'cprop':
            case 'coletarpropriedades':
            case 'cprops':
            case 'habilidades':
            case 'desafiosemanal':
            case 'desafiomensal':
            case 'materiais':
            case 'precos':
            case 'preços':
            case 'vender':
            case 'reparar':
            case 'desafio':
            case 'forjar':
            case 'forge':
            case 'crime':
            case 'assaltar':
            case 'roubar':
            case 'cozinhar':
            case 'cook':
            case 'receitas':
            case 'plantar':
            case 'cultivar':
            case 'plant':
            case 'farm':
            case 'colher':
            case 'coletar':
            case 'harvest':
            case 'plantacao':
            case 'plantação':
            case 'horta':
            case 'comer':
            case 'eat':
            case 'vendercomida':
            case 'ingredientes':
            case 'sementes':
            case 'toprpg':
            case 'ranklevel':
            case 'ranklvl':
            case 'rankinglevel':
            case 'levels':
            case 'toplevels':
            case 'diario':
            case 'daily':
            case 'resetrpg':
                {
                    if (!isGroup)
                        return reply('⚔️ Os comandos RPG funcionam apenas em grupos.');
                    if (!groupData.modorpg)
                        return reply(`⚔️ *Modo RPG desativado!*\n\n🔒 Este recurso está disponível apenas quando o Modo RPG está ativado.\n🔐 *Administradores* podem ativar com: ${prefix}modorpg\n\n💡 Use ${prefix}menurpg para ver todos os comandos!`);
                    const econ = loadEconomy();
                    const changedEconomy = ensureEconomyDefaults(econ);
                    const me = getEcoUser(econ, sender);
                    ensureUserChallenge(me);
                    const { mineBonus, workBonus, bankCapacity, fishBonus, exploreBonus, huntBonus, forgeBonus } = applyShopBonuses(me, econ);
                    if (changedEconomy)
                        saveEconomy(econ);
                    const sub = command;
                    const args = q ? q.trim().toLowerCase().split(/\s+/) : [];
                    // Ramos de economia ja nativos no vNext. Atende aqui e sai; os corpos
                    // legados abaixo so rodam para o que ainda nao migrou. Ver
                    // src/rpg/economia/despachante.ts.
                    {
                        const respostaVNext = despacharEconomiaRpg({ econ, usuario: me, bonus: { mineBonus, workBonus, bankCapacity, fishBonus, exploreBonus, huntBonus, forgeBonus }, sub, args }, {
                            economia: { fmt, getUserName, saveEconomy },
                            acaso: { agora: () => Date.now(), aleatorio: () => Math.random(), timeLeft },
                            texto: { parseAmount, findKeyIgnoringAccents, normalizeParam },
                            progressao: { getSkillBonus, addSkillXP, updateChallenge, updatePeriodChallenge, isChallengeCompleted, giveMaterial },
                            habilidade: { SKILL_LIST, skillXpForNext, ensureUserSkills },
                        }, {
                            prefixo: prefix,
                            remetente: sender,
                            pushname,
                            mencionado: (menc_jid2 && menc_jid2[0]) || null,
                            membrosDoGrupo: AllgroupMembers || [],
                            consultaBruta: q || '',
                            permissaoReset: { isOwner, isSubOwner, remetente: sender, donoPrincipal: nmrdn, enviadoPeloBot: isBotSender },
                            parAtivo: relationshipManager?.getActivePairForUser?.(sender) || null,
                            capacidadeBanco: bankCapacity,
                        });
                        if (respostaVNext) {
                            return reply(respostaVNext.texto, respostaVNext.mencoes?.length ? { mentions: [...respostaVNext.mencoes] } : undefined);
                        }
                    }
                    // Tratamento especial para ranklevel/ranklvl/levels etc.
                    if (['ranklevel', 'ranklvl', 'rankinglevel', 'levels', 'toplevels'].includes(sub)) {
                        // Se estiver em grupo, usamos o ranking do grupo (RPG)
                        if (isGroup) {
                            if (!groupData.modorpg)
                                return reply(`⚔️ Modo RPG desativado! Use ${prefix}modorpg para ativar.`);
                            const levelingData = loadLevelingSafe();
                            const userEntries = Object.entries(levelingData.users || {});
                            const groupUsers = userEntries.filter(([id, data]) => AllgroupMembers.includes(id));
                            if (groupUsers.length === 0)
                                return reply('📊 Nenhum usuário do grupo encontrado no sistema de levels.');
                            const sortedUsers = groupUsers
                                .map(([id, userData]) => ({ id, level: userData?.level || 1, xp: userData?.xp || 0, messages: userData?.messages || 0, commands: userData?.commands || 0, patent: userData?.patent || 'Iniciante' }))
                                .sort((a, b) => (b.level !== a.level ? b.level - a.level : b.xp - a.xp))
                                .slice(0, 15);
                            let text = '🏆 *RANKING DE LEVELS DO GRUPO* 🏆\n\n';
                            const mentions = [];
                            sortedUsers.forEach((user, i) => {
                                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                                const userName = user.id.split('@')[0];
                                const xpNeeded = (user.level * 100) - (user.level - 1) * 100;
                                const progress = user.xp > 0 ? ` (${user.xp}/${xpNeeded} XP)` : '';
                                text += `${medal} @${userName} — *Level ${user.level}*${progress}\n`;
                                text += `   🏅 ${user.patent} | 💬 ${user.messages} msgs | ⚡ ${user.commands} cmds\n`;
                                mentions.push(user.id);
                            });
                            text += '\n✨ Continue jogando e interagindo para subir no ranking!';
                            return reply(text, { mentions });
                        }
                        // Se não for grupo, serve como ranking global
                        const levelingDataRank = loadLevelingSafe();
                        const sortedUsers = Object.entries(levelingDataRank.users || {}).sort((a, b) => (b[1]?.level || 1) - (a[1]?.level || 1) || (b[1]?.xp || 0) - (a[1]?.xp || 0)).slice(0, 15);
                        let rankMessage = '🏆 *Ranking Global de Níveis*\n\n';
                        const mentionsG = [];
                        sortedUsers.forEach(([userId, data], index) => { rankMessage += `${index + 1}. @${getUserName(userId)} - Nível ${data?.level || 1} (XP: ${data?.xp || 0})\n`; mentionsG.push(userId); });
                        return reply(rankMessage, { mentions: mentionsG });
                    }
                    const mentioned = (menc_jid2 && menc_jid2[0]) || (q.includes('@') ? q.split(' ')[0].replace('@', '') : null);
                    if (sub === 'resetrpg') {
                        if (!(isOwner && !isSubOwner && (sender === nmrdn || isBotSender)))
                            return reply('Apenas o Dono principal pode resetar usuários.');
                        const target = (menc_jid2 && menc_jid2[0]) || null;
                        const scope = (q || '').toLowerCase();
                        if (scope.includes('all') || scope.includes('todos')) {
                            let count = 0;
                            for (const p of (AllgroupMembers || [])) {
                                if (econ.users[p]) {
                                    delete econ.users[p];
                                    count++;
                                }
                            }
                            saveEconomy(econ);
                            return reply(`✅ Resetado os dados RPG de ${count} membros do grupo.`);
                        }
                        if (!target)
                            return reply('Marque um usuário para resetar ou use "all".');
                        delete econ.users[target];
                        saveEconomy(econ);
                        return reply(`✅ Dados RPG resetados para @${getUserName(target)}.`, { mentions: [target] });
                    }
                    if (sub === 'perfilrpg') {
                        // Perfil completo do RPG
                        const total = (me.wallet || 0) + (me.bank || 0);
                        const level = me.level || 1;
                        const exp = me.exp || 0;
                        const nextLevelXp = 100 * Math.pow(1.5, level - 1);
                        const expProgress = `${exp}/${Math.floor(nextLevelXp)}`;
                        const expPercent = Math.min(100, Math.floor((exp / nextLevelXp) * 100));
                        // Skills
                        ensureUserSkills(me);
                        const topSkills = SKILL_LIST.map(sk => ({ name: sk, level: me.skills[sk]?.level || 1 }))
                            .sort((a, b) => b.level - a.level).slice(0, 3);
                        // Estatísticas gerais
                        const battlesWon = me.battlesWon || 0;
                        const battlesLost = me.battlesLost || 0;
                        const totalBattles = battlesWon + battlesLost;
                        const winRate = totalBattles > 0 ? Math.floor((battlesWon / totalBattles) * 100) : 0;
                        const achievements = Object.keys(me.achievements || {}).length;
                        const pets = (me.pets || []).length;
                        const premiumItems = Object.keys(me.premiumItems || {}).length;
                        // Progresso de prestige
                        const prestigeLevel = me.prestige?.level || 0;
                        const prestigeMultiplier = me.prestige?.bonusMultiplier || 1;
                        // Reputação
                        const reputation = me.reputation?.points || 0;
                        const karma = me.reputation?.karma || 0;
                        // Streak diário
                        const streak = me.streak?.count || 0;
                        // Classe
                        const classes = {
                            'guerreiro': { emoji: '⚔️', name: 'Guerreiro' },
                            'mago': { emoji: '🧙', name: 'Mago' },
                            'arqueiro': { emoji: '🏹', name: 'Arqueiro' },
                            'curandeiro': { emoji: '💚', name: 'Curandeiro' },
                            'ladino': { emoji: '🗡️', name: 'Ladino' },
                            'paladino': { emoji: '🛡️', name: 'Paladino' }
                        };
                        const classeInfo = me.classe ? `${classes[me.classe]?.emoji} ${classes[me.classe]?.name}` : 'Nenhuma';
                        // Clã
                        let clanInfo = 'Nenhum';
                        if (me.clan && econ.clans[me.clan]) {
                            const myClan = econ.clans[me.clan];
                            clanInfo = myClan.name || 'Sem nome';
                        }
                        // Casa
                        const casas = {
                            'barraca': { emoji: '⛺', name: 'Barraca' },
                            'cabana': { emoji: '🏚️', name: 'Cabana' },
                            'casa': { emoji: '🏠', name: 'Casa' },
                            'mansao': { emoji: '🏰', name: 'Mansão' },
                            'castelo': { emoji: '🏯', name: 'Castelo' }
                        };
                        const houseInfo = me.house?.type ? `${casas[me.house.type]?.emoji || ''} ${casas[me.house.type]?.name || me.house.type}` : 'Nenhuma';
                        // Família e Relacionamento
                        if (!me.family)
                            me.family = { spouse: null, children: [], parents: [], siblings: [] };
                        const familyChildren = (me.family.children || []).length;
                        // Buscar relacionamento ativo do sistema de relacionamentos
                        let familySpouse = 'Solteiro(a)';
                        let relationshipType = '';
                        let relationshipEmoji = '';
                        const mentions = [];
                        const activePair = relationshipManager.getActivePairForUser(sender);
                        if (activePair && activePair.partnerId) {
                            familySpouse = `@${activePair.partnerId.split('@')[0]}`;
                            mentions.push(activePair.partnerId);
                            // Determinar tipo de relacionamento
                            if (activePair.pair?.status === 'casamento') {
                                relationshipType = 'Casado(a)';
                                relationshipEmoji = '💍';
                            }
                            else if (activePair.pair?.status === 'namoro') {
                                relationshipType = 'Namorando';
                                relationshipEmoji = '💞';
                            }
                            else if (activePair.pair?.status === 'brincadeira') {
                                relationshipType = 'Brincadeira';
                                relationshipEmoji = '🎈';
                            }
                        }
                        let text = `╭━━━⊱ ⚔️ *PERFIL RPG* ⚔️ ⊱━━━╮\n`;
                        text += `│ ${pushname}\n`;
                        text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                        text += `📊 *NÍVEL & EXPERIÊNCIA*\n`;
                        text += `├ Level: ${level}\n`;
                        text += `├ XP: ${expProgress} (${expPercent}%)\n`;
                        text += `├ Prestige: ${prestigeLevel}x (${prestigeMultiplier.toFixed(2)}x)\n`;
                        text += `└ Streak: ${streak} dia${streak !== 1 ? 's' : ''}\n\n`;
                        text += `💰 *FINANÇAS*\n`;
                        text += `├ Carteira: ${fmt(me.wallet)}\n`;
                        text += `├ Banco: ${fmt(me.bank)}\n`;
                        text += `├ Total: ${fmt(total)}\n`;
                        text += `└ Emprego: ${me.job ? econ.jobCatalog[me.job]?.name || me.job : 'Desempregado(a)'}\n\n`;
                        text += `🎭 *PERSONALIZAÇÃO*\n`;
                        text += `├ Classe: ${classeInfo}\n`;
                        text += `├ Clã: ${clanInfo}\n`;
                        text += `└ Casa: ${houseInfo}\n\n`;
                        text += `⚔️ *COMBATE*\n`;
                        text += `├ Vitórias: ${battlesWon}\n`;
                        text += `├ Derrotas: ${battlesLost}\n`;
                        text += `├ Win Rate: ${winRate}%\n`;
                        text += `└ Poder: ${me.power || 100}\n\n`;
                        text += `🛠️ *HABILIDADES (TOP 3)*\n`;
                        topSkills.forEach((sk, i) => {
                            const prefixChar = i === topSkills.length - 1 ? '└' : '├';
                            const skillName = sk.name.charAt(0).toUpperCase() + sk.name.slice(1);
                            text += `${prefixChar} ${skillName}: Lv.${sk.level}\n`;
                        });
                        text += `\n`;
                        text += `👨‍👩‍👧‍👦 *FAMÍLIA & RELACIONAMENTO*\n`;
                        if (relationshipEmoji) {
                            text += `├ ${relationshipEmoji} Status: ${relationshipType}\n`;
                            text += `├ Parceiro(a): ${familySpouse}\n`;
                        }
                        else {
                            text += `├ 💔 Status: Solteiro(a)\n`;
                        }
                        text += `└ Filhos: ${familyChildren}\n\n`;
                        text += `🏆 *COLECIONÁVEIS*\n`;
                        text += `├ Conquistas: ${achievements}\n`;
                        text += `├ Pets: ${pets}\n`;
                        text += `└ Itens Premium: ${premiumItems}\n\n`;
                        text += `⭐ *REPUTAÇÃO*\n`;
                        text += `├ Pontos: ${reputation}\n`;
                        text += `└ Karma: ${karma}\n\n`;
                        text += `💎 Use ${prefix}meustats para ver estatísticas detalhadas`;
                        return reply(text, mentions.length > 0 ? { mentions } : undefined);
                    }
                    if (sub === 'carteira') {
                        const total = (me.wallet || 0) + (me.bank || 0);
                        return reply(`╭━━━⊱ 👤 *PERFIL FINANCEIRO* 👤 ⊱━━━╮
      │
      │   *Carteira:* ${fmt(me.wallet)}
      │ 🏦 *Banco:* ${fmt(me.bank)}
      │   *Total:* ${fmt(total)}
      │
      │ 💼 *Emprego:* ${me.job ? econ.jobCatalog[me.job]?.name || me.job : 'Desempregado(a)'}
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'banco') {
                        const cap = isFinite(bankCapacity) ? bankCapacity : '∞';
                        return reply(`╭━━━⊱ 🏦 *BANCO* 🏦 ⊱━━━╮
      │
      │ 💰 *Saldo:* ${fmt(me.bank)}
      │ 📦 *Capacidade:* ${cap === '∞' ? 'Ilimitada' : fmt(cap)}
      │
      ╰━━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'depositar' || sub === 'dep') {
                        const amount = parseAmount(q.split(' ')[0], me.wallet);
                        if (!isFinite(amount) || amount <= 0)
                            return reply('❌ Informe um valor válido (ou "all").');
                        if (amount > me.wallet)
                            return reply('❌ Você não tem tudo isso na carteira.');
                        const cap = isFinite(bankCapacity) ? bankCapacity : Infinity;
                        const space = cap - me.bank;
                        if (space <= 0)
                            return reply('⚠️ Seu banco está cheio. Compre um Cofre na loja para aumentar a capacidade.');
                        const toDep = Math.min(amount, space);
                        me.wallet -= toDep;
                        me.bank += toDep;
                        saveEconomy(econ);
                        return reply(`╭━━━⊱ 💰 *DEPÓSITO* 💰 ⊱━━━╮
      │
      │ ✅ Depositado: ${fmt(toDep)}
      │
      │ 🏦 Banco: ${fmt(me.bank)}
      │ 💼 Carteira: ${fmt(me.wallet)}
      │
      ╰━━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'sacar' || sub === 'saque') {
                        const amount = parseAmount(q.split(' ')[0], me.bank);
                        if (!isFinite(amount) || amount <= 0)
                            return reply('❌ Informe um valor válido (ou "all").');
                        if (amount > me.bank)
                            return reply('❌ Saldo insuficiente no banco.');
                        // TAXA DE SAQUE: 5%
                        const taxa = Math.floor(amount * 0.05);
                        const received = amount - taxa;
                        me.bank -= amount;
                        me.wallet += received;
                        saveEconomy(econ);
                        return reply(`╭━━━⊱ 💳 *SAQUE* 💳 ⊱━━━╮
      │
      │ 💰 Valor sacado: ${fmt(amount)}
      │ 💸 Taxa (5%): ${fmt(taxa)}
      │ ✅ Recebido: ${fmt(received)}
      │
      │ 🏦 Banco: ${fmt(me.bank)}
      │ 💼 Carteira: ${fmt(me.wallet)}
      │
      ╰━━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'transferir' || sub === 'pix') {
                        if (!mentioned)
                            return reply(`╭━━━⊱ 💸 *TRANSFERÊNCIA* 💸 ⊱━━━╮
      │
      │ 👥 Marque um usuário e informe
      │    o valor a transferir
      │
      │ ⚠️ *Taxa de transferência: 15%*
      │
      │ 📝 *Exemplo:*
      │ ${prefix}${sub} @user 100
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━╯`);
                        const amount = parseAmount(args.slice(-1)[0], me.wallet);
                        if (!isFinite(amount) || amount <= 0)
                            return reply('❌ Informe um valor válido.');
                        // TAXA DE TRANSFERÊNCIA: 15%
                        const taxa = Math.floor(amount * 0.15);
                        const totalNeeded = amount + taxa;
                        if (totalNeeded > me.wallet)
                            return reply(`❌ Você não tem saldo suficiente.\n💰 Valor: ${fmt(amount)}\n💸 Taxa (15%): ${fmt(taxa)}\n📊 Total necessário: ${fmt(totalNeeded)}\n💼 Seu saldo: ${fmt(me.wallet)}`);
                        const other = getEcoUser(econ, mentioned);
                        if (mentioned === sender)
                            return reply('❌ Você não pode transferir para si mesmo.');
                        me.wallet -= totalNeeded; // Desconta valor + taxa
                        other.wallet += amount; // Destinatário recebe valor sem taxa
                        saveEconomy(econ);
                        return reply(`╭━━━⊱ ✅ *TRANSFERÊNCIA* ✅ ⊱━━━╮
      │
      │ 💸 Transferido: ${fmt(amount)}
      │ 💰 Taxa (15%): ${fmt(taxa)}
      │ 📊 Total debitado: ${fmt(totalNeeded)}
      │ 👤 Para: @${getUserName(mentioned)}
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━━╯`, { mentions: [mentioned] });
                    }
                    if (sub === 'loja' || sub === 'lojarps') {
                        const items = Object.entries(econ.shop || {});
                        if (items.length === 0)
                            return reply('❌ A loja está vazia no momento.');
                        let text = '╭━━━⊱ 🛍️ *LOJA DE ITENS* 🛍️ ⊱━━━╮\n│\n';
                        for (const [k, it] of items) {
                            text += `│ 🔹 *${k}*\n│   ${it.name} — ${fmt(it.price)}\n│\n`;
                        }
                        text += `╰━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n💡 Compre com: ${prefix}comprar <item>`;
                        return reply(text);
                    }
                    if (sub === 'comprar' || sub === 'buy') {
                        const rawKey = (args[0] || '');
                        if (!rawKey)
                            return reply(`╭━━━⊱ 🛒 *COMPRAR* 🛒 ⊱━━━╮
      │
      │ ❌ Informe o item desejado
      │
      │ 📝 *Exemplo:*
      │ ${prefix}comprar pickaxe_bronze
      │
      │ 🛍️ Ver loja: ${prefix}loja
      │
      ╰━━━━━━━━━━━━━━━━━━━━╯`);
                        // Normaliza a busca do item ignorando acentos e underscores
                        const key = findKeyIgnoringAccents(econ.shop || {}, rawKey) || normalizeParam(rawKey).replace(/\s+/g, '_');
                        const it = (econ.shop || {})[key];
                        if (!it)
                            return reply(`❌ Item não encontrado.\n\n🛍️ Veja a loja com ${prefix}loja`);
                        if (me.wallet < it.price)
                            return reply('❌ Saldo insuficiente na carteira.');
                        me.wallet -= it.price;
                        // Se for ferramenta (picareta), equipa automaticamente
                        if (it.type === 'tool' && it.toolType === 'pickaxe') {
                            me.tools = me.tools || {};
                            me.tools.pickaxe = { tier: it.tier, dur: it.durability, max: it.durability, key };
                            saveEconomy(econ);
                            return reply(`╭━━━⊱ ✅ *COMPRA* ✅ ⊱━━━╮
      │
      │ 🛠️ Você comprou e equipou:
      │ ${it.name}
      │
      │ ⚙️ Durabilidade: ${it.durability}
      │
      ╰━━━━━━━━━━━━━━━━━━━━╯`);
                        }
                        // Caso contrário, vai para o inventário
                        me.inventory[key] = (me.inventory[key] || 0) + 1;
                        saveEconomy(econ);
                        return reply(`╭━━━⊱ ✅ *COMPRA* ✅ ⊱━━━╮
      │
      │ 🎒 Você comprou:
      │ ${it.name}
      │
      │ 💰 Preço: ${fmt(it.price)}
      │
      ╰━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'inventario' || sub === 'inv') {
                        const entries = Object.entries(me.inventory || {}).filter(([, q]) => q > 0);
                        let text = '╭━━━⊱ 🎒 *INVENTÁRIO* 🎒 ⊱━━━╮\n│\n';
                        if (entries.length > 0) {
                            for (const [k, q] of entries) {
                                const it = (econ.shop || {})[k];
                                text += `│ 📦 ${it?.name || k} x${q}\n`;
                            }
                        }
                        else {
                            text += '│ 📭 (vazio)\n';
                        }
                        text += '│\n';
                        // Ferramentas
                        const pk = me.tools?.pickaxe;
                        text += '╠━━━⊱ 🛠️ *FERRAMENTAS* 🛠️ ⊱━━━╣\n│\n';
                        if (pk) {
                            const tierName = pk.tier || 'desconhecida';
                            const dur = pk.dur ?? 0;
                            const max = pk.max ?? (pk.tier === 'bronze' ? 20 : pk.tier === 'ferro' ? 60 : pk.tier === 'diamante' ? 150 : 0);
                            text += `│ ⛏️ Picareta ${tierName}\n│    Durabilidade: ${dur}/${max}\n`;
                        }
                        else {
                            text += '│ ⛏️ Picareta — nenhuma\n';
                        }
                        text += '│\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯';
                        return reply(text);
                    }
                    // Materiais e preços
                    if (sub === 'materiais') {
                        const mats = me.materials || {};
                        const keys = Object.keys(mats).filter(k => mats[k] > 0);
                        if (keys.length === 0)
                            return reply('╭━━━⊱ ⛏️ *MATERIAIS* ⛏️ ⊱━━━╮\n│\n│ 📭 Você não possui materiais\n│\n│ ⛏️ Mine para coletar!\n│ Use: ' + prefix + 'minerar\n│\n╰━━━━━━━━━━━━━━━━━━━━━━╯');
                        let text = '╭━━━⊱ ⛏️ *MATERIAIS* ⛏️ ⊱━━━╮\n│\n';
                        for (const k of keys)
                            text += `│ 💎 ${k}: ${mats[k]}\n`;
                        text += '│\n╰━━━━━━━━━━━━━━━━━━━━━━╯';
                        return reply(text);
                    }
                    if (sub === 'precos' || sub === 'preços') {
                        const mp = econ.materialsPrices || {};
                        let text = '╭━━━⊱ 💱 *PREÇOS* 💱 ⊱━━━╮\n│\n│ 💎 *MATERIAIS (unidade)*\n│\n';
                        for (const [k, v] of Object.entries(mp))
                            text += `│ 🔸 ${k}: ${fmt(v)}\n`;
                        // Receitas básicas
                        const r = econ.recipes || {};
                        if (Object.keys(r).length > 0) {
                            text += '│\n│ 📜 *RECEITAS*\n│\n';
                            for (const [key, rec] of Object.entries(r)) {
                                const shopItem = econ.shop?.[key];
                                const name = shopItem?.name || key;
                                const req = Object.entries(rec.requires || {}).map(([mk, mq]) => `${mk} x${mq}`).join(', ');
                                text += `│ 🔨 ${name}\n│    ${req} + ${fmt(rec.gold || 0)}\n`;
                            }
                        }
                        text += '│\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯';
                        return reply(text);
                    }
                    if (sub === 'vender') {
                        const matKey = (args[0] || '').toLowerCase();
                        if (!matKey)
                            return reply(`╭━━━⊱ 💰 *VENDER MATERIAIS* 💰 ⊱━━━╮
      │
      │ 📝 *Uso:*
      │ ${prefix}vender <material> <qtd|all>
      │
      │ 💡 *Exemplo:*
      │ ${prefix}vender ferro 10
      │ ${prefix}vender ouro all
      │
      │ 💱 Ver preços: ${prefix}precos
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━━━╯`);
                        const price = (econ.materialsPrices || {})[matKey];
                        if (!price)
                            return reply(`❌ Material inválido.\n\n💱 Veja preços com ${prefix}precos`);
                        const have = me.materials?.[matKey] || 0;
                        if (have <= 0)
                            return reply('❌ Você não possui esse material.');
                        const qtyArg = args[1] || 'all';
                        const qty = ['all', 'tudo', 'max'].includes((qtyArg || '').toLowerCase()) ? have : parseAmount(qtyArg, have);
                        if (!isFinite(qty) || qty <= 0)
                            return reply('❌ Quantidade inválida.');
                        const gain = qty * price;
                        me.materials[matKey] = have - qty;
                        me.wallet += gain;
                        saveEconomy(econ);
                        return reply(`╭━━━⊱ ✅ *VENDA* ✅ ⊱━━━╮
      │
      │   Vendeu: ${qty}x ${matKey}
      │ 💰 Ganhou: ${fmt(gain)}
      │
      ╰━━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'reparar') {
                        const pk = getActivePickaxe(me) || me.tools?.pickaxe;
                        if (!pk)
                            return reply(`╭━━━⊱ 🛠️ *REPARAR* 🛠️ ⊱━━━╮
      │
      │ ❌ Você não tem picareta equipada
      │
      │ 🛍️ Compre uma: ${prefix}loja
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━╯`);
                        const kits = me.inventory?.repairkit || 0;
                        if (kits <= 0)
                            return reply(`╭━━━⊱ 🔧 *KIT DE REPAROS* 🔧 ⊱━━━╮
      │
      │ ❌ Você não tem Kit de Reparos
      │
      │ 🛒 Compre com:
      │ ${prefix}comprar repairkit
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━━╯`);
                        const repair = econ.shop?.repairkit?.effect?.repair || 40;
                        const max = pk.max ?? (pk.tier === 'bronze' ? 20 : pk.tier === 'ferro' ? 60 : pk.tier === 'diamante' ? 150 : pk.dur);
                        const before = pk.dur;
                        pk.dur = Math.min(max, pk.dur + repair);
                        me.inventory.repairkit = kits - 1;
                        me.tools.pickaxe = { ...pk, max };
                        saveEconomy(econ);
                        return reply(`╭━━━⊱ 🛠️ *REPARADO!* 🛠️ ⊱━━━╮
      │
      │ ⛏️ Picareta reparada
      │ 📊 ${before} ➜ ${pk.dur}/${max}
      │
      │ 🔧 Kits restantes: ${kits - 1}
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'desafio') {
                        ensureUserChallenge(me);
                        const ch = me.challenge;
                        if ((args[0] || '').toLowerCase() === 'coletar') {
                            if (ch.claimed)
                                return reply('❌ Você já coletou a recompensa de hoje.');
                            if (!isChallengeCompleted(me))
                                return reply('❌ Complete todas as tarefas diárias para coletar.');
                            me.wallet += ch.reward;
                            ch.claimed = true;
                            saveEconomy(econ);
                            return reply(`╭━━━⊱ 🎉 *RECOMPENSA!* 🎉 ⊱━━━╮
      │
      │ ✅ Desafio diário concluído!
      │ 💰 Recompensa: ${fmt(ch.reward)}
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━━╯`);
                        }
                        const labels = {
                            mine: 'Minerações', work: 'Trabalhos', fish: 'Pescarias', explore: 'Explorações', hunt: 'Caçadas', crimeSuccess: 'Crimes bem-sucedidos'
                        };
                        let text = '╭━━━⊱ 🏅 *DESAFIO DIÁRIO* 🏅 ⊱━━━╮\n│\n';
                        for (const t of ch.tasks || []) {
                            text += `│ 📋 ${labels[t.type] || t.type}\n│    ${t.progress || 0}/${t.target}\n`;
                        }
                        text += `│\n│ 🎁 Prêmio: ${fmt(ch.reward)}\n`;
                        if (ch.claimed)
                            text += `│ ✅ (coletado)\n`;
                        text += '│\n╰━━━━━━━━━━━━━━━━━━━━━━━━╯';
                        if (isChallengeCompleted(me) && !ch.claimed)
                            text += `\n\n💡 Use: ${prefix}desafio coletar`;
                        return reply(text);
                    }
                    if (sub === 'apostar' || sub === 'bet') {
                        const cdBet = me.cooldowns?.bet || 0;
                        if (Date.now() < cdBet)
                            return reply(`⏳ Aguarde ${timeLeft(cdBet)} para apostar novamente.`);
                        const amount = parseAmount(args[0], me.wallet);
                        if (!isFinite(amount) || amount <= 0)
                            return reply('Valor inválido.');
                        if (amount > me.wallet)
                            return reply('Saldo insuficiente.');
                        // CASSINO NERFADO: 3% de chance de ganhar (era 47%)
                        const win = Math.random() < 0.03;
                        if (win) {
                            me.wallet += Math.floor(amount * 0.8); // ganha apenas 80% do apostado
                            me.cooldowns.bet = Date.now() + 10 * 60 * 1000; // 10 minutos (era 3)
                            saveEconomy(econ);
                            return reply(`╭───⊃⊱ 🍀 *VITÓRIA RARA!* 🍀 ⊃⊱───╮\n│\n│ 💰 Ganhou: *+${fmt(Math.floor(amount * 0.8))}*\n│ 🎰 Sorte incrível!\n│\n╰─────────────────────╯`);
                        }
                        me.wallet -= amount;
                        me.cooldowns.bet = Date.now() + 10 * 60 * 1000; // 10 minutos (era 3)
                        saveEconomy(econ);
                        return reply(`╭───⊃⊱ 💥 *PERDEU!* 💥 ⊃⊱───╮\n│\n│ 💸 Perdeu: *-${fmt(amount)}*\n│ 🎰 A casa sempre ganha...\n│\n╰─────────────────────╯`);
                    }
                    if (sub === 'slots') {
                        const cdSlots = me.cooldowns?.slots || 0;
                        if (Date.now() < cdSlots)
                            return reply(`⏳ Aguarde ${timeLeft(cdSlots)} para jogar slots novamente.`);
                        const amount = parseAmount(args[0] || '100', me.wallet);
                        if (!isFinite(amount) || amount <= 0)
                            return reply('Valor inválido.');
                        if (amount > me.wallet)
                            return reply('Saldo insuficiente.');
                        // SLOTS NERFADO: símbolos com pesos para quase nunca combinar
                        const symbols = ['🍒', '🍋', '🍉', '⭐', '🔔', '🍇', '🍊', '🍓']; // mais símbolos = menos chance
                        // Cada slot é independente e viciado para não combinar
                        const getSlot = (idx) => {
                            // Cada posição tem preferência por símbolos diferentes
                            const weights = [30, 20, 15, 12, 10, 6, 4, 3];
                            const shifted = [...weights.slice(idx * 2), ...weights.slice(0, idx * 2)];
                            const total = shifted.reduce((a, b) => a + b, 0);
                            let rand = Math.random() * total;
                            for (let i = 0; i < symbols.length; i++) {
                                rand -= shifted[i];
                                if (rand <= 0)
                                    return symbols[i];
                            }
                            return symbols[0];
                        };
                        const r = [getSlot(0), getSlot(1), getSlot(2)];
                        let mult = 0;
                        // Jackpot quase impossível (~0.5% real)
                        if (r[0] === r[1] && r[1] === r[2])
                            mult = 2; // multiplicador reduzido (era 3)
                        else if (r[0] === r[1] || r[1] === r[2] || r[0] === r[2])
                            mult = 1.2; // par paga menos (era 1.5)
                        const delta = Math.floor(amount * (mult - 1));
                        me.wallet += delta; // delta pode ser negativo
                        saveEconomy(econ);
                        me.cooldowns.slots = Date.now() + 8 * 60 * 1000; // 8 minutos (era 2)
                        let slotText = `╭━━━⊱ 🎰 *SLOTS* 🎰 ⊱━━━╮\n`;
                        slotText += `│\n`;
                        slotText += `│ ${r.join(' | ')}\n`;
                        slotText += `│\n`;
                        slotText += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                        if (mult > 1) {
                            slotText += `╭━━━⊱ 🎉 *GANHOU!* 🎉 ⊱━━━╮\n`;
                            slotText += `│\n`;
                            slotText += `│ 💰 Ganhou: *+${fmt(Math.floor(amount * (mult - 1)))}*\n`;
                            slotText += `│\n`;
                            slotText += `╰━━━━━━━━━━━━━━━━━━━━╯`;
                        }
                        else {
                            slotText += `╭━━━⊱ 💸 *PERDEU!* 💸 ⊱━━━╮\n`;
                            slotText += `│\n`;
                            slotText += `│ 💔 Perdeu: *-${fmt(amount)}*\n`;
                            slotText += `│\n`;
                            slotText += `╰━━━━━━━━━━━━━━━━━━━━╯`;
                        }
                        return reply(slotText);
                    }
                    if (sub === 'vagas') {
                        let jobs = econ.jobCatalog || {};
                        // Se não houver vagas no arquivo de economia, usar catálogo padrão embutido
                        if (!jobs || Object.keys(jobs).length === 0) {
                            jobs = {
                                "estagiario": { name: "Estagiário", min: 80, max: 140 },
                                "designer": { name: "Designer", min: 150, max: 250 },
                                "programador": { name: "Programador", min: 200, max: 350 },
                                "gerente": { name: "Gerente", min: 260, max: 420 }
                            };
                        }
                        let txt = '╭━━━⊱ 💼 *VAGAS DE EMPREGO* 💼 ⊱━━━╮\n│\n';
                        Object.entries(jobs).forEach(([k, j]) => {
                            txt += `│ 🔹 *${k}*\n│   ${j.name}\n│   💰 ${fmt(j.min)}-${fmt(j.max)}\n│\n`;
                        });
                        txt += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━╯\n\n💡 Use: ${prefix}emprego <vaga>`;
                        return reply(txt);
                    }
                    if (sub === 'emprego') {
                        const rawKey = (args[0] || '');
                        if (!rawKey)
                            return reply(`╭━━━⊱ 💼 *EMPREGO* 💼 ⊱━━━╮
      │
      │ ❌ Informe a vaga desejada
      │
      │ 📋 Ver vagas: ${prefix}vagas
      │
      │ 💡 Exemplo:
      │ ${prefix}emprego vendedor
      │
      ╰━━━━━━━━━━━━━━━━━━━━━╯`);
                        const defaultJobs = {
                            "estagiario": { name: "Estagiário", min: 80, max: 140 },
                            "designer": { name: "Designer", min: 150, max: 250 },
                            "programador": { name: "Programador", min: 200, max: 350 },
                            "gerente": { name: "Gerente", min: 260, max: 420 }
                        };
                        const jobCatalog = (econ.jobCatalog && Object.keys(econ.jobCatalog).length) ? econ.jobCatalog : defaultJobs;
                        // Normaliza a busca da vaga ignorando acentos
                        const key = findKeyIgnoringAccents(jobCatalog, rawKey) || normalizeParam(rawKey);
                        const job = jobCatalog[key];
                        if (!job)
                            return reply('❌ Vaga inexistente. Use ' + prefix + 'vagas para ver disponíveis.');
                        // If economy file had no jobCatalog, persist defaults so future queries find them
                        if (!econ.jobCatalog || Object.keys(econ.jobCatalog).length === 0) {
                            econ.jobCatalog = jobCatalog;
                        }
                        me.job = key;
                        saveEconomy(econ);
                        return reply(`╭━━━⊱ ✅ *CONTRATADO!* ✅ ⊱━━━╮
      │
      │ 💼 Emprego: ${job.name}
      │ 💰 Ganhos: ${fmt(job.min)}-${fmt(job.max)}
      │
      │ 🏢 Use ${prefix}trabalhar
      │    para receber seu salário!
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'demitir') {
                        me.job = null;
                        saveEconomy(econ);
                        return reply(`╭━━━⊱ 👋 *DEMISSÃO* 👋 ⊱━━━╮
      │
      │ ✅ Você pediu demissão
      │
      │ 💼 Veja novas vagas: ${prefix}vagas
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━╯`);
                    }
                    if (sub === 'pescar' || sub === 'fish') {
                        const cd = me.cooldowns?.fish || 0;
                        if (Date.now() < cd)
                            return reply(`⏳ Aguarde ${timeLeft(cd)} para pescar novamente.`);
                        const base = 80 + Math.floor(Math.random() * 121); // 80-200 (BALANCEADO)
                        const skillB = getSkillBonus(me, 'fishing');
                        const bonus = Math.floor(base * ((fishBonus || 0) + skillB));
                        const total = base + bonus;
                        me.wallet += total;
                        me.cooldowns.fish = Date.now() + 12 * 60 * 1000; // 12 min
                        addSkillXP(me, 'fishing', 1);
                        updateChallenge(me, 'fish', 1, true);
                        updatePeriodChallenge(me, 'fish', 1, true);
                        // Adiciona peixe como ingrediente
                        me.ingredients = me.ingredients || {};
                        const fishQty = 2 + Math.floor(Math.random() * 3); // 2-4 peixes
                        me.ingredients.peixe = (me.ingredients.peixe || 0) + fishQty;
                        // Rastrear stats
                        if (!me.stats)
                            me.stats = {};
                        me.stats.totalFish = (me.stats.totalFish || 0) + 1;
                        me.stats.fishCount = (me.stats.fishCount || 0) + 1;
                        saveEconomy(econ);
                        let fishText = `╭━━━⊱ 🎣 *PESCOU!* 🎣 ⊱━━━╮\n`;
                        fishText += `│\n`;
                        fishText += `│ 💰 Ganhou: *${fmt(total)}*\n`;
                        if (bonus > 0) {
                            fishText += `│ ✨ Bônus: *+${fmt(bonus)}*\n`;
                        }
                        fishText += `│ 🐟 Peixe: *+${fishQty}*\n`;
                        fishText += `│\n`;
                        fishText += `╰━━━━━━━━━━━━━━━━━━━━━╯`;
                        return reply(fishText);
                    }
                    if (sub === 'explorar' || sub === 'explore') {
                        const cd = me.cooldowns?.explore || 0;
                        if (Date.now() < cd)
                            return reply(`⏳ Aguarde ${timeLeft(cd)} para explorar novamente.`);
                        const base = 100 + Math.floor(Math.random() * 151); // 100-250 (BALANCEADO)
                        const skillB = getSkillBonus(me, 'exploring');
                        const bonus = Math.floor(base * ((exploreBonus || 0) + skillB));
                        const total = base + bonus;
                        me.wallet += total;
                        me.cooldowns.explore = Date.now() + 15 * 60 * 1000; // 15 min
                        addSkillXP(me, 'exploring', 1);
                        updateChallenge(me, 'explore', 1, true);
                        updatePeriodChallenge(me, 'explore', 1, true);
                        // Rastrear stats
                        if (!me.stats)
                            me.stats = {};
                        me.stats.totalExplore = (me.stats.totalExplore || 0) + 1;
                        me.stats.exploreCount = (me.stats.exploreCount || 0) + 1;
                        // Adiciona materiais da exploração
                        const matsGain = {};
                        if (Math.random() < 0.6)
                            matsGain.madeira = 1 + Math.floor(Math.random() * 3); // 60% chance, 1-3 madeira
                        if (Math.random() < 0.3)
                            matsGain.corda = 1; // 30% chance, 1 corda
                        if (Math.random() < 0.4)
                            matsGain.linha = 1 + Math.floor(Math.random() * 2); // 40% chance, 1-2 linha
                        if (Math.random() < 0.2)
                            matsGain.cristal = 1; // 20% chance, 1 cristal (raro)
                        for (const [mk, mq] of Object.entries(matsGain))
                            giveMaterial(me, mk, mq);
                        saveEconomy(econ);
                        let exploreText = `╭━━━⊱ 🧭 *EXPLOROU!* 🧭 ⊱━━━╮\n`;
                        exploreText += `│\n`;
                        exploreText += `│ 💰 Ganhou: *${fmt(total)}*\n`;
                        if (bonus > 0) {
                            exploreText += `│ ✨ Bônus: *+${fmt(bonus)}*\n`;
                        }
                        if (Object.keys(matsGain).length > 0) {
                            exploreText += `│ 📦 Materiais: ` + Object.entries(matsGain).map(([k, q]) => `${k} x${q}`).join(', ') + `\n`;
                        }
                        exploreText += `│\n`;
                        exploreText += `╰━━━━━━━━━━━━━━━━━━━━━╯`;
                        return reply(exploreText);
                    }
                    if (sub === 'cacar' || sub === 'caçar' || sub === 'hunt') {
                        const cd = me.cooldowns?.hunt || 0;
                        if (Date.now() < cd)
                            return reply(`⏳ Aguarde ${timeLeft(cd)} para caçar novamente.`);
                        const base = 22 + Math.floor(Math.random() * 34); // 22-55 (era 45-120)
                        const skillB = getSkillBonus(me, 'hunting');
                        const bonus = Math.floor(base * ((huntBonus || 0) + skillB) * 0.4);
                        const total = base + bonus; // bônus reduzido 60%
                        me.wallet += total;
                        me.cooldowns.hunt = Date.now() + 22 * 60 * 1000; // 22 min (era 6 min)
                        addSkillXP(me, 'hunting', 1);
                        updateChallenge(me, 'hunt', 1, true);
                        updatePeriodChallenge(me, 'hunt', 1, true);
                        // Adiciona carne como ingrediente
                        me.ingredients = me.ingredients || {};
                        const meatQty = 1 + (Math.random() < 0.25 ? 1 : 0); // 1-2 carnes (25% chance de pegar 2)
                        me.ingredients.carne = (me.ingredients.carne || 0) + meatQty;
                        // Adiciona materiais da caça
                        const huntMats = {};
                        if (Math.random() < 0.5)
                            huntMats.couro = 1 + Math.floor(Math.random() * 2); // 50% chance, 1-2 couro
                        for (const [mk, mq] of Object.entries(huntMats))
                            giveMaterial(me, mk, mq);
                        saveEconomy(econ);
                        let huntText = `╭━━━⊱ 🏹 *CAÇOU!* 🏹 ⊱━━━╮\n`;
                        huntText += `│\n`;
                        huntText += `│ 💰 Ganhou: *${fmt(total)}*\n`;
                        if (bonus > 0) {
                            huntText += `│ ✨ Bônus: *+${fmt(bonus)}*\n`;
                        }
                        huntText += `│ 🥩 Carne: *+${meatQty}*\n`;
                        if (Object.keys(huntMats).length > 0) {
                            huntText += `│ 📦 Materiais: ` + Object.entries(huntMats).map(([k, q]) => `${k} x${q}`).join(', ') + `\n`;
                        }
                        huntText += `│\n`;
                        huntText += `╰━━━━━━━━━━━━━━━━━━━━━╯`;
                        return reply(huntText);
                    }
                    if (sub === 'forjar' || sub === 'forge') {
                        if (!me.materials)
                            me.materials = {};
                        if (!me.inventory)
                            me.inventory = {};
                        // Mostra receitas disponíveis se não especificar item
                        const rawCraftKey = (args[0] || '');
                        if (!rawCraftKey) {
                            let text = `╭━━━⊱ ⚒️ *RECEITAS DE FORJA* ⊱━━━╮\n`;
                            text += `│ 💰 Seu gold: ${fmt(me.wallet)}\n`;
                            text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                            const recipes = econ.recipes || {};
                            if (Object.keys(recipes).length === 0) {
                                text += `❌ Nenhuma receita disponível no momento.`;
                            }
                            else {
                                text += `📜 *RECEITAS DISPONÍVEIS*\n\n`;
                                for (const [key, recipe] of Object.entries(recipes)) {
                                    const item = econ.shop[key];
                                    if (!item)
                                        continue;
                                    text += `🔸 *${item.name || key}*\n`;
                                    text += `   💰 Custo: ${fmt(recipe.gold || 0)}\n`;
                                    if (recipe.requires && Object.keys(recipe.requires).length > 0) {
                                        const materials = Object.entries(recipe.requires).map(([mat, qty]) => `${mat} x${qty}`).join(', ');
                                        text += `   📦 Materiais: ${materials}\n`;
                                    }
                                    text += `   💡 Forjar: ${prefix}forjar ${key}\n\n`;
                                }
                            }
                            text += `💡 *Dica:* Use ${prefix}materiais para ver seus materiais disponíveis`;
                            return reply(text);
                        }
                        // Modo 1: craft a partir de receitas
                        // Normaliza o nome da receita ignorando acentos
                        const craftKey = findKeyIgnoringAccents(econ.recipes || {}, rawCraftKey) || normalizeParam(rawCraftKey);
                        if (craftKey && (econ.recipes || {})[craftKey]) {
                            const rec = econ.recipes[craftKey];
                            const reqs = rec.requires || {};
                            // Verifica materiais
                            for (const [mk, mq] of Object.entries(reqs)) {
                                if ((me.materials?.[mk] || 0) < mq)
                                    return reply(`Faltam materiais: ${mk} x${mq}. Veja ${prefix}materiais.`);
                            }
                            // Verifica gold
                            const goldCost = rec.gold || 0;
                            if (me.wallet < goldCost)
                                return reply(`Você precisa de ${fmt(goldCost)} para forjar.`);
                            // Consome
                            for (const [mk, mq] of Object.entries(reqs)) {
                                me.materials[mk] -= mq;
                            }
                            me.wallet -= goldCost;
                            const item = (econ.shop || {})[craftKey];
                            if (item?.type === 'tool' && item.toolType === 'pickaxe') {
                                me.tools.pickaxe = { tier: item.tier, dur: item.durability, max: item.durability, key: craftKey };
                                saveEconomy(econ);
                                return reply(`⚒️ Você forjou e equipou ${item.name}! Durabilidade ${item.durability}.`);
                            }
                            // Senão, adiciona ao inventário
                            me.inventory[craftKey] = (me.inventory[craftKey] || 0) + 1;
                            saveEconomy(econ);
                            return reply(`⚒️ Você forjou ${item?.name || craftKey}!`);
                        }
                        // Modo 2: minigame de forja (antigo) - NERFADO
                        const cd = me.cooldowns?.forge || 0;
                        if (Date.now() < cd)
                            return reply(`⏳ Aguarde ${timeLeft(cd)} para forjar novamente.`);
                        const cost = 150;
                        if (me.wallet < cost)
                            return reply(`Você precisa de ${fmt(cost)} para materiais.`); // custo aumentado (era 100)
                        me.wallet -= cost;
                        const success = Math.random() < 0.35; // 35% chance (era 60%)
                        if (success) {
                            const gain = 80 + Math.floor(Math.random() * 101); // 80-180 (era 180-400)
                            const bonus = Math.floor(gain * (forgeBonus || 0) * 0.5);
                            const total = gain + bonus; // bônus reduzido
                            me.wallet += total;
                            me.cooldowns.forge = Date.now() + 25 * 60 * 1000;
                            saveEconomy(econ); // 25 min (era 6 min)
                            return reply(`⚒️ Forja bem-sucedida! Lucro ${fmt(total)} ${bonus > 0 ? `(bônus ${fmt(bonus)})` : ''}.`);
                        }
                        else {
                            me.cooldowns.forge = Date.now() + 25 * 60 * 1000;
                            saveEconomy(econ); // 25 min (era 6 min)
                            return reply(`🔥 A forja falhou e os materiais foram perdidos.`);
                        }
                    }
                    if (sub === 'crime') {
                        const cd = me.cooldowns?.crime || 0;
                        if (Date.now() < cd)
                            return reply(`⏳ Aguarde ${timeLeft(cd)} para tentar de novo.`);
                        const success = Math.random() < 0.18; // 18% sucesso (era 35%)
                        if (success) {
                            const base = 40 + Math.floor(Math.random() * 61); // 40-100 (era 90-230)
                            const skillB = getSkillBonus(me, 'crime');
                            const gain = Math.floor(base * (1 + skillB * 0.3)); // skill bônus reduzido
                            me.wallet += gain;
                            me.cooldowns.crime = Date.now() + 30 * 60 * 1000; // 30 min
                            addSkillXP(me, 'crime', 1);
                            updateChallenge(me, 'crimeSuccess', 1, true);
                            updatePeriodChallenge(me, 'crimeSuccess', 1, true);
                            // Rastrear stats
                            if (!me.stats)
                                me.stats = {};
                            me.stats.totalCrimes = (me.stats.totalCrimes || 0) + 1;
                            saveEconomy(econ);
                            return reply(`╭━━━⊱ 🕵️ *CRIME* 🕵️ ⊱━━━╮
      │
      │ ✅ Crime bem-sucedido!
      │ 💰 Lucrou: ${fmt(gain)}
      │
      │ ⚠️ Cuidado para não ser pego!
      │
      ╰━━━━━━━━━━━━━━━━━━━━━╯`);
                        }
                        else {
                            const fine = 200 + Math.floor(Math.random() * 401); // multa maior: 200-600 (era 120-320)
                            const pay = Math.min(me.wallet, fine);
                            me.wallet -= pay;
                            me.cooldowns.crime = Date.now() + 30 * 60 * 1000; // 30 min (era 10 min)
                            saveEconomy(econ);
                            return reply(`╭━━━⊱ 🚔 *PEGO!* 🚔 ⊱━━━╮
      │
      │ ❌ Você foi pego pela polícia!
      │ 💸 Multa: ${fmt(pay)}
      │
      ╰━━━━━━━━━━━━━━━━━━━━╯`);
                        }
                    }
                    // ===== SISTEMA DE COZINHAR =====
                    if (sub === 'receitas') {
                        // Inicializa receitas culinárias se não existir
                        if (!econ.cookingRecipes) {
                            econ.cookingRecipes = {
                                pao: { name: '🍞 Pão', requires: { trigo: 3 }, gold: 10, sellPrice: 50, energy: 10 },
                                sopa: { name: '🍲 Sopa', requires: { cenoura: 2, batata: 2 }, gold: 15, sellPrice: 80, energy: 20 },
                                salada: { name: '🥗 Salada', requires: { alface: 2, tomate: 2 }, gold: 12, sellPrice: 60, energy: 15 },
                                bolo: { name: '🍰 Bolo', requires: { trigo: 5, ovo: 3 }, gold: 25, sellPrice: 120, energy: 30 },
                                pizza: { name: '🍕 Pizza', requires: { trigo: 4, tomate: 3, queijo: 2 }, gold: 35, sellPrice: 150, energy: 40 },
                                hamburguer: { name: '🍔 Hambúrguer', requires: { carne: 2, trigo: 3, alface: 1 }, gold: 40, sellPrice: 180, energy: 50 },
                                sushi: { name: '🍣 Sushi', requires: { peixe: 4, arroz: 3 }, gold: 50, sellPrice: 200, energy: 45 },
                                macarrao: { name: '🍝 Macarrão', requires: { trigo: 3, tomate: 2 }, gold: 20, sellPrice: 90, energy: 25 }
                            };
                            saveEconomy(econ);
                        }
                        let text = '📖 *RECEITAS CULINÁRIAS*\n\n';
                        for (const [key, rec] of Object.entries(econ.cookingRecipes)) {
                            const ingredients = Object.entries(rec.requires).map(([ing, qty]) => `${ing} x${qty}`).join(', ');
                            text += `${rec.name}\n`;
                            text += `  📦 Ingredientes: ${ingredients}\n`;
                            text += `  💰 Custo: ${fmt(rec.gold)}\n`;
                            text += `  💵 Venda: ${fmt(rec.sellPrice)}\n`;
                            text += `  ⚡ Energia: +${rec.energy}\n`;
                            text += `  🍳 Cozinhar: ${prefix}cozinhar ${key}\n\n`;
                        }
                        text += `💡 *Dica:* Plante ingredientes com ${prefix}plantar`;
                        return reply(text);
                    }
                    if (sub === 'cozinhar' || sub === 'cook') {
                        const recipeKey = (args[0] || '').toLowerCase();
                        // Inicializa receitas se não existir
                        if (!econ.cookingRecipes) {
                            econ.cookingRecipes = {
                                pao: { name: '🍞 Pão', requires: { trigo: 3 }, gold: 10, sellPrice: 50, energy: 10 },
                                sopa: { name: '🍲 Sopa', requires: { cenoura: 2, batata: 2 }, gold: 15, sellPrice: 80, energy: 20 },
                                salada: { name: '🥗 Salada', requires: { alface: 2, tomate: 2 }, gold: 12, sellPrice: 60, energy: 15 },
                                bolo: { name: '🍰 Bolo', requires: { trigo: 5, ovo: 3 }, gold: 25, sellPrice: 120, energy: 30 },
                                pizza: { name: '🍕 Pizza', requires: { trigo: 4, tomate: 3, queijo: 2 }, gold: 35, sellPrice: 150, energy: 40 },
                                hamburguer: { name: '🍔 Hambúrguer', requires: { carne: 2, trigo: 3, alface: 1 }, gold: 40, sellPrice: 180, energy: 50 },
                                sushi: { name: '🍣 Sushi', requires: { peixe: 4, arroz: 3 }, gold: 50, sellPrice: 200, energy: 45 },
                                macarrao: { name: '🍝 Macarrão', requires: { trigo: 3, tomate: 2 }, gold: 20, sellPrice: 90, energy: 25 }
                            };
                        }
                        if (!recipeKey) {
                            return reply(`👨‍🍳 *SISTEMA DE COZINHA*\n\n📖 Veja as receitas disponíveis: ${prefix}receitas\n🍳 Cozinhar: ${prefix}cozinhar <receita>\n\n💡 Exemplo: ${prefix}cozinhar pao`);
                        }
                        const recipe = econ.cookingRecipes[recipeKey];
                        if (!recipe) {
                            return reply(`❌ Receita não encontrada! Use ${prefix}receitas para ver todas as receitas disponíveis.`);
                        }
                        // Verifica cooldown
                        const cd = me.cooldowns?.cook || 0;
                        if (Date.now() < cd) {
                            return reply(`⏳ Você ainda está cozinhando! Aguarde ${timeLeft(cd)}.`);
                        }
                        // Verifica gold
                        if (me.wallet < recipe.gold) {
                            return reply(`💰 Você precisa de ${fmt(recipe.gold)} para cozinhar ${recipe.name}. Saldo atual: ${fmt(me.wallet)}`);
                        }
                        // Verifica ingredientes
                        me.ingredients = me.ingredients || {};
                        for (const [ing, qty] of Object.entries(recipe.requires)) {
                            if ((me.ingredients[ing] || 0) < qty) {
                                return reply(`📦 Ingredientes insuficientes! Você precisa de ${ing} x${qty}, mas tem apenas x${me.ingredients[ing] || 0}.\n\n🌱 Plante ingredientes com ${prefix}plantar`);
                            }
                        }
                        // Consome recursos
                        me.wallet -= recipe.gold;
                        for (const [ing, qty] of Object.entries(recipe.requires)) {
                            me.ingredients[ing] -= qty;
                        }
                        // Adiciona comida ao inventário
                        me.cookedFood = me.cookedFood || {};
                        me.cookedFood[recipeKey] = (me.cookedFood[recipeKey] || 0) + 1;
                        // Skill e desafios
                        addSkillXP(me, 'cooking', 2);
                        updateChallenge(me, 'cook', 1, true);
                        updatePeriodChallenge(me, 'cook', 1, true);
                        // Atualiza progresso de missões diárias
                        updateQuestProgress(me, 'cook', 1);
                        // Cooldown de 3 minutos
                        me.cooldowns.cook = Date.now() + 3 * 60 * 1000;
                        saveEconomy(econ);
                        return reply(`👨‍🍳 *COZINHA CONCLUÍDA!*\n\n${recipe.name} preparado com sucesso!\n⚡ Energia: +${recipe.energy}\n💵 Valor de venda: ${fmt(recipe.sellPrice)}\n\n🍴 Use ${prefix}comer ${recipeKey} para consumir\n💰 Use ${prefix}vendercomida ${recipeKey} para vender`);
                    }
                    // ===== SISTEMA DE PLANTAÇÃO =====
                    if (sub === 'plantacao' || sub === 'plantação' || sub === 'horta') {
                        me.farm = me.farm || { plots: [], maxPlots: 4, lastExpansion: 0 };
                        const now = Date.now();
                        let text = '🌾 *MINHA PLANTAÇÃO*\n\n';
                        text += `📊 Terrenos: ${me.farm.plots.length}/${me.farm.maxPlots}\n\n`;
                        if (me.farm.plots.length === 0) {
                            text += '🌱 Sua plantação está vazia!\n\n';
                        }
                        else {
                            me.farm.plots.forEach((plot, idx) => {
                                const timeLeft = plot.readyAt - now;
                                const isReady = timeLeft <= 0;
                                const seed = econ.seeds?.[plot.seed] || { name: plot.seed, growTime: 600000, yield: { [plot.seed]: 1 } };
                                text += `🌱 *Terreno ${idx + 1}*\n`;
                                text += `  Semente: ${seed.name}\n`;
                                if (isReady) {
                                    text += `  ✅ Pronto para colher!\n`;
                                }
                                else {
                                    const mins = Math.ceil(timeLeft / 60000);
                                    text += `  ⏳ Pronto em: ${mins} min\n`;
                                }
                                text += `\n`;
                            });
                        }
                        text += `\n💡 *Comandos:*\n`;
                        text += `🌱 Plantar: ${prefix}plantar <semente>\n`;
                        text += `🌾 Colher: ${prefix}colher\n`;
                        text += `📦 Sementes: ${prefix}sementes\n`;
                        return reply(text);
                    }
                    if (sub === 'plantar' || sub === 'plant' || sub === 'farm') {
                        const seedKey = (args[0] || '').toLowerCase();
                        // Inicializa sistema de sementes
                        if (!econ.seeds) {
                            econ.seeds = {
                                trigo: { name: '🌾 Trigo', cost: 20, growTime: 5 * 60 * 1000, yield: { trigo: 3 } },
                                cenoura: { name: '🥕 Cenoura', cost: 15, growTime: 4 * 60 * 1000, yield: { cenoura: 2 } },
                                batata: { name: '🥔 Batata', cost: 15, growTime: 4 * 60 * 1000, yield: { batata: 2 } },
                                tomate: { name: '🍅 Tomate', cost: 18, growTime: 6 * 60 * 1000, yield: { tomate: 3 } },
                                alface: { name: '🥬 Alface', cost: 12, growTime: 3 * 60 * 1000, yield: { alface: 2 } },
                                milho: { name: '🌽 Milho', cost: 25, growTime: 7 * 60 * 1000, yield: { milho: 4 } },
                                arroz: { name: '🌾 Arroz', cost: 22, growTime: 8 * 60 * 1000, yield: { arroz: 4 } },
                                cana: { name: '🌿 Cana-de-açúcar', cost: 30, growTime: 10 * 60 * 1000, yield: { acucar: 5 } },
                                galinha: { name: '🐔 Galinha', cost: 35, growTime: 15 * 60 * 1000, yield: { ovo: 2 } },
                                vaca: { name: '🐄 Vaca', cost: 50, growTime: 20 * 60 * 1000, yield: { queijo: 3 } }
                            };
                            saveEconomy(econ);
                        }
                        if (!seedKey) {
                            let text = '🌱 *SISTEMA DE PLANTAÇÃO*\n\n';
                            text += '📦 *Sementes Disponíveis:*\n\n';
                            for (const [key, seed] of Object.entries(econ.seeds)) {
                                const mins = Math.floor(seed.growTime / 60000);
                                const yieldText = Object.entries(seed.yield).map(([k, v]) => `${k} x${v}`).join(', ');
                                text += `${seed.name}\n`;
                                text += `  💰 Custo: ${fmt(seed.cost)}\n`;
                                text += `  ⏱️ Tempo: ${mins} min\n`;
                                text += `  🌾 Colheita: ${yieldText}\n\n`;
                            }
                            text += `🌱 Plantar: ${prefix}plantar <semente>\n`;
                            text += `💡 Exemplo: ${prefix}plantar trigo`;
                            return reply(text);
                        }
                        const seed = econ.seeds[seedKey];
                        if (!seed) {
                            return reply(`❌ Semente não encontrada! Use ${prefix}plantar para ver as sementes disponíveis.`);
                        }
                        // Inicializa fazenda do usuário
                        me.farm = me.farm || { plots: [], maxPlots: 4, lastExpansion: 0 };
                        // Verifica se tem espaço
                        if (me.farm.plots.length >= me.farm.maxPlots) {
                            return reply(`🌾 Todos os seus terrenos estão ocupados! Aguarde a colheita ou expanda sua fazenda.\n\n🌾 Use ${prefix}colher para colher plantas prontas`);
                        }
                        // Verifica gold
                        if (me.wallet < seed.cost) {
                            return reply(`💰 Você precisa de ${fmt(seed.cost)} para plantar ${seed.name}. Saldo: ${fmt(me.wallet)}`);
                        }
                        // Planta
                        me.wallet -= seed.cost;
                        const now = Date.now();
                        me.farm.plots.push({
                            seed: seedKey,
                            plantedAt: now,
                            readyAt: now + seed.growTime
                        });
                        // Skill
                        addSkillXP(me, 'farming', 1);
                        updateChallenge(me, 'plant', 1, true);
                        updatePeriodChallenge(me, 'plant', 1, true);
                        saveEconomy(econ);
                        const mins = Math.floor(seed.growTime / 60000);
                        return reply(`🌱 ${seed.name} plantado com sucesso!\n\n⏱️ Estará pronto para colher em ${mins} minutos.\n🌾 Terrenos ocupados: ${me.farm.plots.length}/${me.farm.maxPlots}\n\n💡 Use ${prefix}horta para ver suas plantações`);
                    }
                    if (sub === 'colher' || sub === 'harvest') {
                        me.farm = me.farm || { plots: [], maxPlots: 4, lastExpansion: 0 };
                        if (me.farm.plots.length === 0) {
                            return reply(`🌾 Você não tem nada plantado!\n\n🌱 Use ${prefix}plantar <semente> para começar a cultivar.`);
                        }
                        const now = Date.now();
                        const readyPlots = me.farm.plots.filter(plot => plot.readyAt <= now);
                        if (readyPlots.length === 0) {
                            const nextReady = Math.min(...me.farm.plots.map(p => p.readyAt));
                            const timeLeft = Math.ceil((nextReady - now) / 60000);
                            return reply(`⏳ Nenhuma planta está pronta para colher ainda.\n\n🕐 Próxima colheita em: ${timeLeft} minuto(s)\n\n💡 Use ${prefix}horta para ver o status de todas as plantações`);
                        }
                        // Colhe todas as plantas prontas
                        me.ingredients = me.ingredients || {};
                        let harvestedText = '';
                        let totalValue = 0;
                        readyPlots.forEach(plot => {
                            const seed = econ.seeds?.[plot.seed];
                            if (seed && seed.yield) {
                                for (const [ingredient, qty] of Object.entries(seed.yield)) {
                                    me.ingredients[ingredient] = (me.ingredients[ingredient] || 0) + qty;
                                    harvestedText += `${ingredient} x${qty}, `;
                                    totalValue += qty * 10; // Valor estimado
                                }
                            }
                        });
                        // Remove plantas colhidas
                        me.farm.plots = me.farm.plots.filter(plot => plot.readyAt > now);
                        // Skill e desafios
                        addSkillXP(me, 'farming', readyPlots.length * 2);
                        updateChallenge(me, 'harvest', readyPlots.length, true);
                        updatePeriodChallenge(me, 'harvest', readyPlots.length, true);
                        // Atualiza progresso de missões diárias (coletar recursos)
                        updateQuestProgress(me, 'gather', readyPlots.length);
                        saveEconomy(econ);
                        harvestedText = harvestedText.slice(0, -2); // Remove última vírgula
                        return reply(`🌾 *COLHEITA CONCLUÍDA!*\n\n✅ Plantas colhidas: ${readyPlots.length}\n📦 Ingredientes obtidos:\n${harvestedText}\n\n💵 Valor estimado: ${fmt(totalValue)}\n🌱 Terrenos livres: ${me.farm.maxPlots - me.farm.plots.length}/${me.farm.maxPlots}\n\n👨‍🍳 Use ${prefix}receitas para ver o que pode cozinhar!`);
                    }
                    // ===== COMANDOS COMPLEMENTARES DE COZINHA =====
                    if (sub === 'ingredientes') {
                        me.ingredients = me.ingredients || {};
                        const entries = Object.entries(me.ingredients).filter(([, qty]) => qty > 0);
                        if (entries.length === 0) {
                            return reply(`📦 *INGREDIENTES*\n\nVocê não possui ingredientes.\n\n🌱 Plante com ${prefix}plantar para conseguir ingredientes!`);
                        }
                        let text = '📦 *MEUS INGREDIENTES*\n\n';
                        for (const [ing, qty] of entries) {
                            text += `• ${ing}: x${qty}\n`;
                        }
                        text += `\n👨‍🍳 Use ${prefix}receitas para ver o que pode cozinhar`;
                        return reply(text);
                    }
                    if (sub === 'comer' || sub === 'eat') {
                        const foodKey = (args[0] || '').toLowerCase();
                        me.cookedFood = me.cookedFood || {};
                        if (!foodKey) {
                            const entries = Object.entries(me.cookedFood).filter(([, qty]) => qty > 0);
                            if (entries.length === 0) {
                                return reply(`🍽️ Você não tem comida preparada.\n\n👨‍🍳 Cozinhe algo com ${prefix}cozinhar`);
                            }
                            let text = '🍽️ *COMIDAS PREPARADAS*\n\n';
                            for (const [key, qty] of entries) {
                                const recipe = econ.cookingRecipes?.[key];
                                if (recipe) {
                                    text += `${recipe.name} x${qty}\n`;
                                    text += `  ⚡ Energia: +${recipe.energy}\n`;
                                    text += `  💵 Valor: ${fmt(recipe.sellPrice)}\n\n`;
                                }
                            }
                            text += `🍴 Comer: ${prefix}comer <comida>\n`;
                            text += `💰 Vender: ${prefix}vendercomida <comida>`;
                            return reply(text);
                        }
                        if (!me.cookedFood[foodKey] || me.cookedFood[foodKey] <= 0) {
                            return reply(`❌ Você não tem ${foodKey} preparado.\n\n👨‍🍳 Cozinhe com ${prefix}cozinhar ${foodKey}`);
                        }
                        const recipe = econ.cookingRecipes?.[foodKey];
                        if (!recipe) {
                            return reply('❌ Receita não encontrada.');
                        }
                        // Consome a comida
                        me.cookedFood[foodKey] -= 1;
                        // Adiciona energia (pode ser usado para reduzir cooldowns ou dar bônus)
                        me.energy = (me.energy || 0) + recipe.energy;
                        // Skill
                        addSkillXP(me, 'cooking', 1);
                        saveEconomy(econ);
                        return reply(`😋 *DELICIOSO!*\n\nVocê comeu ${recipe.name}!\n⚡ Energia: +${recipe.energy}\n💪 Energia total: ${me.energy}\n\n💡 Quanto mais energia, mais bônus você recebe!`);
                    }
                    if (sub === 'vendercomida') {
                        const foodKey = (args[0] || '').toLowerCase();
                        me.cookedFood = me.cookedFood || {};
                        if (!foodKey) {
                            return reply(`💰 *VENDER COMIDA*\n\nUse: ${prefix}vendercomida <comida>\n\n💡 Veja suas comidas com ${prefix}comer`);
                        }
                        const qty = parseInt(args[1]) || 1;
                        if (!me.cookedFood[foodKey] || me.cookedFood[foodKey] < qty) {
                            return reply(`❌ Você não tem ${qty}x ${foodKey}.\n\n🍽️ Você tem: ${me.cookedFood[foodKey] || 0}`);
                        }
                        const recipe = econ.cookingRecipes?.[foodKey];
                        if (!recipe) {
                            return reply('❌ Receita não encontrada.');
                        }
                        const totalValue = recipe.sellPrice * qty;
                        me.cookedFood[foodKey] -= qty;
                        me.wallet += totalValue;
                        saveEconomy(econ);
                        return reply(`💰 *VENDA CONCLUÍDA!*\n\nVocê vendeu ${qty}x ${recipe.name}\n💵 Ganhou: ${fmt(totalValue)}\n💼 Carteira: ${fmt(me.wallet)}`);
                    }
                    if (sub === 'sementes') {
                        // Inicializa sementes se não existir
                        if (!econ.seeds) {
                            econ.seeds = {
                                trigo: { name: '🌾 Trigo', cost: 20, growTime: 5 * 60 * 1000, yield: { trigo: 3 } },
                                cenoura: { name: '🥕 Cenoura', cost: 15, growTime: 4 * 60 * 1000, yield: { cenoura: 2 } },
                                batata: { name: '🥔 Batata', cost: 15, growTime: 4 * 60 * 1000, yield: { batata: 2 } },
                                tomate: { name: '🍅 Tomate', cost: 18, growTime: 6 * 60 * 1000, yield: { tomate: 3 } },
                                alface: { name: '🥬 Alface', cost: 12, growTime: 3 * 60 * 1000, yield: { alface: 2 } },
                                milho: { name: '🌽 Milho', cost: 25, growTime: 7 * 60 * 1000, yield: { milho: 4 } },
                                arroz: { name: '🌾 Arroz', cost: 22, growTime: 8 * 60 * 1000, yield: { arroz: 4 } },
                                cana: { name: '🌿 Cana-de-açúcar', cost: 30, growTime: 10 * 60 * 1000, yield: { acucar: 5 } }
                            };
                            saveEconomy(econ);
                        }
                        let text = '🌱 *CATÁLOGO DE SEMENTES*\n\n';
                        for (const [key, seed] of Object.entries(econ.seeds)) {
                            const mins = Math.floor(seed.growTime / 60000);
                            const yieldText = Object.entries(seed.yield).map(([k, v]) => `${k} x${v}`).join(', ');
                            text += `${seed.name}\n`;
                            text += `  💰 Custo: ${fmt(seed.cost)}\n`;
                            text += `  ⏱️ Crescimento: ${mins} min\n`;
                            text += `  🌾 Colheita: ${yieldText}\n`;
                            text += `  🌱 Plantar: ${prefix}plantar ${key}\n\n`;
                        }
                        text += `💡 *Dica:* Use ${prefix}horta para ver suas plantações`;
                        return reply(text);
                    }
                    if (sub === 'minerar' || sub === 'mine') {
                        const cd = me.cooldowns?.mine || 0;
                        if (Date.now() < cd)
                            return reply(`⏳ Aguarde ${timeLeft(cd)} para minerar novamente.`);
                        const pk = getActivePickaxe(me);
                        if (!pk)
                            return reply(`⛏️ Você precisa de uma picareta para minerar. Compre na ${prefix}loja (ex: ${prefix}comprar pickaxe_bronze) ou repare com ${prefix}reparar.`);
                        // Cálculo de ouro com base na picareta e bônus (BALANCEADO)
                        const tierMult = PICKAXE_TIER_MULT[pk.tier] || 1.0;
                        const base = 100 + Math.floor(Math.random() * 101); // 100-200 (AUMENTADO)
                        const skillB = getSkillBonus(me, 'mining');
                        const raw = Math.floor(base * tierMult);
                        const bonus = Math.floor(raw * ((mineBonus || 0) + skillB));
                        const total = raw + bonus;
                        me.wallet += total;
                        // Quedas de materiais (chances balanceadas)
                        let drops = { pedra: 2 + Math.floor(Math.random() * 3) }; // 2-4
                        if (pk.tier === 'ferro' || pk.tier === 'diamante') {
                            drops.ferro = (drops.ferro || 0) + 1 + Math.floor(Math.random() * 2); // 1-2
                            drops.carvao = (drops.carvao || 0) + (Math.random() < 0.4 ? 1 : 0); // 40% chance
                        }
                        if (pk.tier === 'diamante') {
                            drops.ferro = (drops.ferro || 0) + (Math.random() < 0.7 ? 1 : 0); // 70% chance de +1
                            drops.ouro = (drops.ouro || 0) + (Math.random() < 0.3 ? 1 : 0); // 30% chance
                            drops.carvao = (drops.carvao || 0) + (Math.random() < 0.6 ? 1 : 0); // 60% chance
                            if (Math.random() < 0.1)
                                drops.diamante = (drops.diamante || 0) + 1; // 10% chance
                        }
                        for (const [mk, mq] of Object.entries(drops))
                            if (mq > 0)
                                giveMaterial(me, mk, mq);
                        // Durabilidade
                        const before = pk.dur;
                        pk.dur = Math.max(0, pk.dur - 1);
                        me.tools.pickaxe = { ...pk, max: pk.max ?? (pk.tier === 'bronze' ? 20 : pk.tier === 'ferro' ? 60 : pk.tier === 'diamante' ? 150 : pk.dur) };
                        me.cooldowns.mine = Date.now() + 10 * 60 * 1000; // 10 min
                        addSkillXP(me, 'mining', 1);
                        updateChallenge(me, 'mine', 1, true);
                        updatePeriodChallenge(me, 'mine', 1, true);
                        // Rastrear stats
                        if (!me.stats)
                            me.stats = {};
                        me.stats.totalMine = (me.stats.totalMine || 0) + 1;
                        me.stats.mineCount = (me.stats.mineCount || 0) + 1;
                        saveEconomy(econ);
                        let dropTxt = Object.entries(drops).filter(([, q]) => q > 0).map(([k, q]) => `${k} x${q}`).join(', ');
                        const broke = pk.dur === 0 && before > 0;
                        return reply(`⛏️ Você minerou e ganhou ${fmt(total)} ${bonus > 0 ? `(bônus ${fmt(bonus)})` : ''}!\n📦 Drops: ${dropTxt || '—'}\n🛠️ Picareta: ${pk.dur}/${me.tools.pickaxe.max}${broke ? ' — quebrou!' : ''}`);
                    }
                    if (sub === 'trabalhar' || sub === 'work') {
                        const cd = me.cooldowns?.work || 0;
                        if (Date.now() < cd)
                            return reply(`⏳ Aguarde ${timeLeft(cd)} para trabalhar novamente.`);
                        const base = 150 + Math.floor(Math.random() * 151); // 150-300 (AUMENTADO para economia balanceada)
                        const skillB = getSkillBonus(me, 'working');
                        const bonus = Math.floor(base * (workBonus + skillB));
                        const total = base + bonus;
                        me.wallet += total;
                        me.cooldowns.work = Date.now() + 15 * 60 * 1000; // 15 min
                        addSkillXP(me, 'working', 1);
                        updateChallenge(me, 'work', 1, true);
                        updatePeriodChallenge(me, 'work', 1, true);
                        // Rastrear stats
                        if (!me.stats)
                            me.stats = {};
                        me.stats.totalWork = (me.stats.totalWork || 0) + 1;
                        me.stats.workCount = (me.stats.workCount || 0) + 1;
                        saveEconomy(econ);
                        return reply(`💼 Você trabalhou e recebeu ${fmt(total)} ${bonus > 0 ? `(bônus ${fmt(bonus)})` : ''}!`);
                    }
                    // ===== Mercado entre usuários =====
                    if (sub === 'mercado') {
                        const items = econ.market || [];
                        if (items.length === 0)
                            return reply('🛒 O mercado está vazio. Use listar para anunciar algo.');
                        let text = '🛒 Mercado (ofertas abertas)\n\n';
                        for (const ofr of items) {
                            text += `#${ofr.id} • ${ofr.type === 'item' ? `${ofr.key} x${ofr.qty}` : `${ofr.mat} x${ofr.qty}`} — ${fmt(ofr.price)} | Vendedor: @${ofr.seller.split('@')[0]}\n`;
                        }
                        return reply(text, { mentions: (items.map(i => i.seller)) });
                    }
                    if (sub === 'listar') {
                        // listar item <key> <qtd> <preco> | listar mat <material> <qtd> <preco>
                        const kind = (args[0] || '').toLowerCase();
                        if (!['item', 'mat', 'material'].includes(kind))
                            return reply(`Use: ${prefix}listar item <key> <qtd> <preco> | ${prefix}listar mat <material> <qtd> <preco>`);
                        const qty = parseInt(args[2]);
                        const price = parseInt(args[3]);
                        if (!isFinite(qty) || qty <= 0 || !isFinite(price) || price <= 0)
                            return reply('Quantidade e preço inválidos.');
                        if (kind === 'item') {
                            const key = (args[1] || '').toLowerCase();
                            if ((me.inventory?.[key] || 0) < qty)
                                return reply('Você não possui itens suficientes.');
                            me.inventory[key] -= qty;
                            const id = econ.marketCounter++;
                            econ.market.push({ id, type: 'item', key, qty, price, seller: sender });
                            saveEconomy(econ);
                            return reply(`📢 Anúncio #${id} criado: ${key} x${qty} por ${fmt(price)}.`);
                        }
                        else {
                            const mat = (args[1] || '').toLowerCase();
                            if ((me.materials?.[mat] || 0) < qty)
                                return reply('Você não possui materiais suficientes.');
                            me.materials[mat] -= qty;
                            const id = econ.marketCounter++;
                            econ.market.push({ id, type: 'mat', mat, qty, price, seller: sender });
                            saveEconomy(econ);
                            return reply(`📢 Anúncio #${id} criado: ${mat} x${qty} por ${fmt(price)}.`);
                        }
                    }
                    if (sub === 'meusanuncios' || sub === 'meusan') {
                        const mine = (econ.market || []).filter(o => o.seller === sender);
                        if (mine.length === 0)
                            return reply('Você não tem anúncios.');
                        let text = '📋 Seus anúncios\n\n';
                        for (const ofr of mine)
                            text += `#${ofr.id} • ${ofr.type === 'item' ? `${ofr.key} x${ofr.qty}` : `${ofr.mat} x${ofr.qty}`} — ${fmt(ofr.price)}\n`;
                        return reply(text);
                    }
                    if (sub === 'cancelar') {
                        const id = parseInt(args[0]);
                        if (!isFinite(id))
                            return reply('Informe o ID do anúncio.');
                        const idx = (econ.market || []).findIndex(o => o.id === id);
                        if (idx < 0)
                            return reply('Anúncio não encontrado.');
                        const ofr = econ.market[idx];
                        if (ofr.seller !== sender)
                            return reply('Apenas o vendedor pode cancelar.');
                        // devolve ao vendedor
                        if (ofr.type === 'item')
                            me.inventory[ofr.key] = (me.inventory[ofr.key] || 0) + ofr.qty;
                        else
                            me.materials[ofr.mat] = (me.materials[ofr.mat] || 0) + ofr.qty;
                        econ.market.splice(idx, 1);
                        saveEconomy(econ);
                        return reply(`❌ Anúncio #${id} cancelado e itens devolvidos.`);
                    }
                    if (sub === 'comprarmercado' || sub === 'cmerc') {
                        const id = parseInt(args[0]);
                        if (!isFinite(id))
                            return reply('Informe o ID do anúncio.');
                        const ofr = (econ.market || []).find(o => o.id === id);
                        if (!ofr)
                            return reply('Anúncio não encontrado.');
                        if (ofr.seller === sender)
                            return reply('Você não pode comprar seu próprio anúncio.');
                        const tax = Math.floor(ofr.price * 0.05);
                        if (me.wallet < ofr.price)
                            return reply('Saldo insuficiente.');
                        const seller = getEcoUser(econ, ofr.seller);
                        me.wallet -= ofr.price;
                        seller.wallet += (ofr.price - tax); // taxa de 5%
                        if (ofr.type === 'item')
                            me.inventory[ofr.key] = (me.inventory[ofr.key] || 0) + ofr.qty;
                        else
                            me.materials[ofr.mat] = (me.materials[ofr.mat] || 0) + ofr.qty;
                        econ.market = (econ.market || []).filter(o => o.id !== id);
                        saveEconomy(econ);
                        return reply(`🛒 Compra realizada! Taxa de ${fmt(tax)} aplicada. Vendedor recebeu ${fmt(ofr.price - tax)}.`);
                    }
                    // ===== Propriedades =====
                    if (sub === 'propriedades') {
                        const keys = Object.keys(econ.propertiesCatalog || {});
                        let text = '🏠 Propriedades disponíveis\n\n';
                        for (const k of keys) {
                            const p = econ.propertiesCatalog[k];
                            const upkeep = p.upkeepPerDay || 0;
                            const incGold = p.incomeGoldPerDay || 0;
                            const incMat = p.incomeMaterialsPerDay || {};
                            const mats = Object.entries(incMat).map(([mk, mq]) => `${mk} x${mq}/dia`).join(', ');
                            text += `• ${k} — ${p.name} — Preço: ${fmt(p.price)} — Manutenção: ${fmt(upkeep)}/dia — Renda: ${incGold > 0 ? `${fmt(incGold)} gold/dia` : ''}${mats ? `${incGold > 0 ? ' e ' : ''}${mats}` : ''}\n`;
                        }
                        // minhas propriedades
                        const mine = me.properties || {};
                        const owned = Object.keys(mine).filter(k => mine[k]?.owned);
                        if (owned.length > 0) {
                            text += '\n📦 Suas propriedades:\n';
                            for (const k of owned) {
                                const o = mine[k];
                                const last = o.lastCollect ? new Date(o.lastCollect).toLocaleDateString('pt-BR') : '—';
                                text += `• ${econ.propertiesCatalog[k]?.name || k} — desde ${last}\n`;
                            }
                        }
                        return reply(text);
                    }
                    if (sub === 'comprarpropriedade' || sub === 'cprop') {
                        const key = (args[0] || '').toLowerCase();
                        if (!key)
                            return reply(`Use: ${prefix}comprarpropriedade <tipo>`);
                        const prop = (econ.propertiesCatalog || {})[key];
                        if (!prop)
                            return reply('Propriedade inexistente.');
                        if (me.properties?.[key]?.owned)
                            return reply('Você já possui essa propriedade.');
                        if (me.wallet < prop.price)
                            return reply('Saldo insuficiente.');
                        me.wallet -= prop.price;
                        me.properties[key] = { owned: true, lastCollect: Date.now() };
                        saveEconomy(econ);
                        return reply(`🏠 Você comprou ${prop.name}!`);
                    }
                    if (sub === 'coletarpropriedades' || sub === 'cprops') {
                        const props = me.properties || {};
                        const keys = Object.keys(props).filter(k => props[k].owned);
                        if (keys.length === 0)
                            return reply('Você não possui propriedades.');
                        let totalGold = 0;
                        const matsGain = {};
                        for (const k of keys) {
                            const meta = (econ.propertiesCatalog || {})[k];
                            if (!meta)
                                continue;
                            const days = Math.max(1, Math.ceil((Date.now() - (props[k].lastCollect || Date.now())) / (24 * 60 * 60 * 1000)));
                            const upkeep = (meta.upkeepPerDay || 0) * days;
                            if (me.wallet < upkeep)
                                return reply(`Saldo insuficiente para pagar manutenção de ${meta.name} (${fmt(upkeep)}).`);
                            me.wallet -= upkeep;
                            if (meta.incomeGoldPerDay)
                                totalGold += meta.incomeGoldPerDay * days;
                            if (meta.incomeMaterialsPerDay) {
                                for (const [mk, mq] of Object.entries(meta.incomeMaterialsPerDay))
                                    matsGain[mk] = (matsGain[mk] || 0) + (mq * days);
                            }
                            props[k].lastCollect = Date.now();
                        }
                        me.wallet += totalGold;
                        for (const [mk, mq] of Object.entries(matsGain))
                            giveMaterial(me, mk, mq);
                        saveEconomy(econ);
                        let msg = `🏡 Coleta concluída! +${fmt(totalGold)} gold`;
                        if (Object.keys(matsGain).length > 0)
                            msg += ` | Materiais: ` + Object.entries(matsGain).map(([k, q]) => `${k} x${q}`).join(', ');
                        return reply(msg);
                    }
                    // ===== Habilidades & Desafios Periódicos (visualização) =====
                    if (sub === 'habilidades') {
                        ensureUserSkills(me);
                        let text = '📚 Habilidades\n\n';
                        for (const s of SKILL_LIST) {
                            const sk = me.skills[s];
                            text += `• ${s}: Nível ${sk.level} (${sk.xp}/${skillXpForNext(sk.level)})\n`;
                        }
                        return reply(text);
                    }
                    if (sub === 'desafiosemanal' || sub === 'desafiomensal') {
                        ensureUserPeriodChallenges(me);
                        const show = sub === 'desafiosemanal' ? me.weeklyChallenge : me.monthlyChallenge;
                        const labels = { mine: 'Minerações', work: 'Trabalhos', fish: 'Pescarias', explore: 'Explorações', hunt: 'Caçadas', crimeSuccess: 'Crimes OK' };
                        let text = `🏅 Desafio ${sub === 'desafiosemanal' ? 'Semanal' : 'Mensal'}\n\n`;
                        for (const t of (show.tasks || []))
                            text += `• ${labels[t.type] || t.type}: ${t.progress || 0}/${t.target}\n`;
                        text += `\nPrêmio: ${fmt(show.reward)} ${show.claimed ? '(coletado)' : ''}`;
                        if (isPeriodCompleted(show) && !show.claimed)
                            text += `\nUse: ${prefix}${sub} coletar`;
                        if ((args[0] || '').toLowerCase() === 'coletar') {
                            if (show.claimed)
                                return reply('Você já coletou este prêmio.');
                            if (!isPeriodCompleted(show))
                                return reply('Complete todas as tarefas para coletar.');
                            me.wallet += show.reward;
                            show.claimed = true;
                            saveEconomy(econ);
                            return reply(`🎉 Você coletou ${fmt(show.reward)} do ${sub === 'desafiosemanal' ? 'desafio semanal' : 'desafio mensal'}!`);
                        }
                        return reply(text);
                    }
                    if (sub === 'assaltar' || sub === 'roubar') {
                        if (!mentioned)
                            return reply('Marque alguém para assaltar.');
                        if (mentioned === sender)
                            return reply('Você não pode assaltar a si mesmo.');
                        const cd = me.cooldowns?.rob || 0;
                        if (Date.now() < cd)
                            return reply(`⏳ Aguarde ${timeLeft(cd)} para tentar novamente.`);
                        const target = getEcoUser(econ, mentioned);
                        const chance = Math.random();
                        const maxSteal = Math.min(target.wallet, 300);
                        if (maxSteal <= 0) {
                            me.cooldowns.rob = Date.now() + 10 * 60 * 1000; // 10 min
                            saveEconomy(econ);
                            return reply('A vítima está sem dinheiro na carteira. Roubo falhou.');
                        }
                        if (chance < 0.5) {
                            const amt = 50 + Math.floor(Math.random() * Math.max(1, maxSteal - 49));
                            target.wallet -= amt;
                            me.wallet += amt;
                            me.cooldowns.rob = Date.now() + 10 * 60 * 1000;
                            saveEconomy(econ);
                            return reply(`🦹 Sucesso! Você roubou ${fmt(amt)} de @${getUserName(mentioned)}.`, { mentions: [mentioned] });
                        }
                        else {
                            const multa = 80 + Math.floor(Math.random() * 121); // 80-200
                            const pay = Math.min(me.wallet, multa);
                            me.wallet -= pay;
                            target.wallet += pay;
                            me.cooldowns.rob = Date.now() + 10 * 60 * 1000;
                            saveEconomy(econ);
                            return reply(`🚨 Você foi pego! Pagou ${fmt(pay)} de multa para @${getUserName(mentioned)}.`, { mentions: [mentioned] });
                        }
                    }
                    if (sub === 'diario' || sub === 'daily') {
                        const cd = me.cooldowns?.daily || 0;
                        const now = Date.now();
                        if (now < cd) {
                            return reply(`⏳ Você já coletou hoje!\n\n🕐 Volte em: ${timeLeft(cd)}`);
                        }
                        // Sistema de Streak (sequência diária)
                        if (!me.streak) {
                            me.streak = { count: 0, lastClaim: 0, record: 0 };
                        }
                        const oneDayMs = 24 * 60 * 60 * 1000;
                        const twoDaysMs = 48 * 60 * 60 * 1000;
                        const timeSinceLastClaim = now - me.streak.lastClaim;
                        // Verifica se manteve a sequência (coletou no dia seguinte)
                        if (timeSinceLastClaim <= twoDaysMs && timeSinceLastClaim >= oneDayMs) {
                            me.streak.count += 1;
                        }
                        else if (timeSinceLastClaim > twoDaysMs) {
                            // Quebrou a sequência
                            me.streak.count = 1;
                        }
                        else {
                            me.streak.count = 1;
                        }
                        // Atualiza recorde
                        if (me.streak.count > me.streak.record) {
                            me.streak.record = me.streak.count;
                        }
                        // Calcula recompensa baseada no streak
                        const baseReward = 150;
                        const streakBonus = Math.min(me.streak.count * 10, 300); // Máx +300
                        const totalReward = baseReward + streakBonus;
                        // Bônus especial a cada 7 dias
                        let extraBonus = 0;
                        let bonusMessage = '';
                        if (me.streak.count % 7 === 0) {
                            extraBonus = 500;
                            bonusMessage = '\n🎉 *BÔNUS DE 7 DIAS:* +500!';
                        }
                        // Bônus especial a cada 30 dias
                        if (me.streak.count % 30 === 0) {
                            extraBonus += 2000;
                            bonusMessage += '\n🏆 *BÔNUS DE 30 DIAS:* +2000!';
                        }
                        const finalReward = totalReward + extraBonus;
                        me.wallet += finalReward;
                        me.streak.lastClaim = now;
                        me.cooldowns.daily = now + oneDayMs;
                        // Adiciona XP
                        const xpGain = 50 + (me.streak.count * 5);
                        me.exp = (me.exp || 0) + xpGain;
                        // Verifica level up
                        const level = me.level || 1;
                        const nextLevelXp = 100 * Math.pow(1.5, level - 1);
                        let leveledUp = false;
                        while (me.exp >= nextLevelXp) {
                            me.exp -= nextLevelXp;
                            me.level += 1;
                            leveledUp = true;
                        }
                        saveEconomy(econ);
                        let text = `╭━━━⊱ 🎁 *RECOMPENSA DIÁRIA* ⊱━━━╮\n`;
                        text += `│\n`;
                        text += `│ 💰 Base: +${fmt(baseReward)}\n`;
                        text += `│ 🔥 Streak (${me.streak.count}x): +${fmt(streakBonus)}\n`;
                        if (extraBonus > 0) {
                            text += `│ ✨ Bônus: +${fmt(extraBonus)}\n`;
                        }
                        text += `│ ━━━━━━━━━━━━━━\n`;
                        text += `│ 💵 Total: *${fmt(finalReward)}*\n`;
                        text += `│ ⚡ XP: +${xpGain}\n`;
                        text += `│\n`;
                        text += `│ 🔥 Sequência: *${me.streak.count} dia${me.streak.count !== 1 ? 's' : ''}*\n`;
                        text += `│ 🏆 Recorde: ${me.streak.record} dia${me.streak.record !== 1 ? 's' : ''}\n`;
                        text += `│\n`;
                        text += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯`;
                        if (bonusMessage) {
                            text += bonusMessage;
                        }
                        if (leveledUp) {
                            text += `\n\n⚡ *LEVEL UP!* Agora você é level ${me.level}!`;
                        }
                        text += `\n\n💡 Volte amanhã para manter a sequência!`;
                        return reply(text);
                    }
                    if (sub === 'toprpg') {
                        const arr = Object.entries(econ.users).map(([id, u]) => [id, (u.wallet || 0) + (u.bank || 0)]).sort((a, b) => b[1] - a[1]).slice(0, 10);
                        if (arr.length === 0)
                            return reply('Sem dados suficientes para ranking.');
                        let text = '⚔️ 🏆 *RANKING RPG* 🏆 ⚔️\n\n';
                        const mentions = [];
                        arr.forEach(([id, total], i) => {
                            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                            text += `${medal} @${id.split('@')[0]} — 💰 ${fmt(total)}\n`;
                            mentions.push(id);
                        });
                        text += `\n✨ Continue jogando para subir no rank!`;
                        return reply(text, { mentions });
                    }
                    return reply('Comando RPG inválido. Use ' + prefix + 'menurpg para ver todos os comandos.');
                }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_016_conquistas(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { getEcoUser, groupData, isGroup, loadEconomy, prefix, pushname, reply, saveEconomy, sender } = scope;
    try {
        switch (command) {
            case 'conquistas':
            case 'achievements':
            case 'medalhas': {
                if (!isGroup)
                    return reply('⚔️ Este comando funciona apenas em grupos com Modo RPG ativo.');
                if (!groupData.modorpg)
                    return reply(`⚔️ Modo RPG desativado! Use ${prefix}modorpg para ativar.`);
                const econ = loadEconomy();
                const me = getEcoUser(econ, sender);
                me.achievements = me.achievements || {};
                me.stats = me.stats || { totalMine: 0, totalWork: 0, totalFish: 0, totalHunt: 0, totalExplore: 0, totalBattles: 0, totalWins: 0, totalCrimes: 0 };
                const achievements = [
                    { id: 'minerador', name: '⛏️ Minerador', desc: 'Minere 100 vezes', req: me.stats.totalMine >= 100, progress: `${me.stats.totalMine || 0}/100` },
                    { id: 'trabalhador', name: '💼 Trabalhador', desc: 'Trabalhe 50 vezes', req: me.stats.totalWork >= 50, progress: `${me.stats.totalWork || 0}/50` },
                    { id: 'pescador', name: '🎣 Pescador', desc: 'Pesque 75 vezes', req: me.stats.totalFish >= 75, progress: `${me.stats.totalFish || 0}/75` },
                    { id: 'cacador', name: '🏹 Caçador', desc: 'Cace 50 vezes', req: me.stats.totalHunt >= 50, progress: `${me.stats.totalHunt || 0}/50` },
                    { id: 'explorador', name: '🗺️ Explorador', desc: 'Explore 100 vezes', req: me.stats.totalExplore >= 100, progress: `${me.stats.totalExplore || 0}/100` },
                    { id: 'gladiador', name: '⚔️ Gladiador', desc: 'Vença 25 batalhas', req: me.stats.totalWins >= 25, progress: `${me.stats.totalWins || 0}/25` },
                    { id: 'milionario', name: '💰 Milionário', desc: 'Tenha 500K no banco', req: (me.bank || 0) >= 500000, progress: `${(me.bank || 0).toLocaleString()}/500.000` },
                    { id: 'veterano', name: '🏆 Veterano', desc: 'Alcance nível 50', req: (me.level || 1) >= 50, progress: `${me.level || 1}/50` },
                    { id: 'colecionador', name: '🐾 Colecionador', desc: 'Tenha 5 pets', req: (me.pets?.length || 0) >= 5, progress: `${me.pets?.length || 0}/5` },
                    { id: 'criminoso', name: '🦹 Criminoso', desc: 'Cometa 30 crimes', req: me.stats.totalCrimes >= 30, progress: `${me.stats.totalCrimes || 0}/30` }
                ];
                let unlockedCount = 0;
                let text = `╭━━━⊱ 🏅 *CONQUISTAS* ⊱━━━╮\n`;
                text += `│ Aventureiro: *${pushname}*\n`;
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                for (const ach of achievements) {
                    const unlocked = ach.req;
                    if (unlocked && !me.achievements[ach.id]) {
                        me.achievements[ach.id] = Date.now();
                    }
                    if (unlocked)
                        unlockedCount++;
                    const status = unlocked ? '✅' : '🔒';
                    text += `${status} ${ach.name}\n`;
                    text += `   ${ach.desc}\n`;
                    text += `   📊 Progresso: ${ach.progress}\n\n`;
                }
                text += `╭━━━━━━━━━━━━━━━━━━━━╮\n`;
                text += `│ 🏆 Total: ${unlockedCount}/${achievements.length} conquistas\n`;
                text += `╰━━━━━━━━━━━━━━━━━━━━╯`;
                saveEconomy(econ);
                return reply(text);
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_059_reputacao(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { getEcoUser, groupData, isGroup, loadEconomy, prefix, pushname, reply, saveEconomy, sender } = scope;
    try {
        switch (command) {
            case 'reputacao':
            case 'rep':
            case 'reputation': {
                if (!isGroup)
                    return reply('⚔️ Este comando funciona apenas em grupos com Modo RPG ativo.');
                if (!groupData.modorpg)
                    return reply(`⚔️ Modo RPG desativado! Use ${prefix}modorpg para ativar.`);
                const econ = loadEconomy();
                const me = getEcoUser(econ, sender);
                if (!me.reputation) {
                    me.reputation = {
                        points: 0,
                        upvotes: 0,
                        downvotes: 0,
                        karma: 0,
                        fame: 0
                    };
                }
                let text = `╭━━━⊱ ⭐ *REPUTAÇÃO* ⊱━━━╮\n`;
                text += `│ ${pushname}\n`;
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                text += `⭐ Pontos: ${me.reputation.points}\n`;
                text += `👍 Votos Positivos: ${me.reputation.upvotes}\n`;
                text += `👎 Votos Negativos: ${me.reputation.downvotes}\n`;
                text += `☯️ Karma: ${me.reputation.karma}\n`;
                text += `🌟 Fama: ${me.reputation.fame}\n\n`;
                const repLevel = Math.floor(me.reputation.points / 100);
                const ranks = ['Novato', 'Conhecido', 'Respeitado', 'Famoso', 'Lendário'];
                const rank = ranks[Math.min(repLevel, ranks.length - 1)];
                text += `🏅 Classificação: *${rank}*\n\n`;
                text += `💡 Use ${prefix}votar @user para dar reputação`;
                saveEconomy(econ);
                return reply(text);
                break;
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_074_slots(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { args, getEcoUser, groupData, isGroup, loadEconomy, prefix, reply, saveEconomy, sender, timeLeft } = scope;
    try {
        switch (command) {
            case 'slots':
            case 'slotmachine':
            case 'cacaniquel': {
                if (!isGroup)
                    return reply('⚔️ Este comando funciona apenas em grupos com Modo RPG ativo.');
                if (!groupData.modorpg)
                    return reply(`⚔️ Modo RPG desativado! Use ${prefix}modorpg para ativar.`);
                const econ = loadEconomy();
                const me = getEcoUser(econ, sender);
                // Cooldown de 8 minutos
                const cdSlots2 = me.cooldowns?.slots2 || 0;
                if (Date.now() < cdSlots2)
                    return reply(`⏳ Aguarde ${timeLeft(cdSlots2)} para jogar slots novamente.`);
                const bet = parseInt(args[0]) || 0;
                if (bet <= 0)
                    return reply(`🎰 *CAÇA-NÍQUEIS*\n\n💡 Uso: ${prefix}slots <valor>\n\n🎲 Alinhe 3 símbolos iguais para ganhar!`);
                if (bet > me.wallet)
                    return reply('❌ Saldo insuficiente!');
                // SLOTS NERFADO: Cada posição tem preferência por símbolos diferentes
                const symbols = ['🍒', '🍋', '🍊', '🍇', '⭐', '💎', '7️⃣'];
                const getSymbol = (position) => {
                    // Cada posição tem pesos diferentes para quase nunca combinar
                    const baseWeights = [25, 20, 18, 15, 12, 7, 3];
                    const shifted = [...baseWeights.slice(position * 2), ...baseWeights.slice(0, position * 2)];
                    const total = shifted.reduce((a, b) => a + b);
                    let random = Math.random() * total;
                    for (let i = 0; i < symbols.length; i++) {
                        random -= shifted[i];
                        if (random <= 0)
                            return symbols[i];
                    }
                    return symbols[0];
                };
                const slot1 = getSymbol(0);
                const slot2 = getSymbol(1);
                const slot3 = getSymbol(2);
                // Multiplicadores reduzidos
                const multipliers = {
                    '🍒': 1.5, '🍋': 2, '🍊': 2.5, '🍇': 3, '⭐': 5, '💎': 10, '7️⃣': 25
                };
                me.cooldowns = me.cooldowns || {};
                me.cooldowns.slots2 = Date.now() + 8 * 60 * 1000; // 8 minutos
                let text = `╭━━━⊱ 🎰 *SLOTS* ⊱━━━╮\n\n`;
                text += `┏━━━━━━━━━━━━━━┓\n`;
                text += `┃  ${slot1}  │  ${slot2}  │  ${slot3}  ┃\n`;
                text += `┗━━━━━━━━━━━━━━┛\n\n`;
                if (slot1 === slot2 && slot2 === slot3) {
                    // Jackpot! (muito raro agora)
                    const multi = multipliers[slot1];
                    const winnings = Math.floor(bet * multi);
                    me.wallet += winnings - bet;
                    text += `🎉 *JACKPOT RARO!* 🎉\n`;
                    text += `💰 Você ganhou ${winnings.toLocaleString()}! (${multi}x)`;
                }
                else if (slot1 === slot2 || slot2 === slot3 || slot1 === slot3) {
                    // 2 iguais - agora paga menos
                    const winnings = Math.floor(bet * 1.1);
                    me.wallet += winnings - bet;
                    text += `⭐ *PAR!*\n`;
                    text += `💰 Você ganhou ${(winnings - bet).toLocaleString()}! (1.1x)`;
                }
                else {
                    me.wallet -= bet;
                    text += `💀 *PERDEU!*\n💸 -${bet.toLocaleString()}\n🎰 A máquina parece viciada...`;
                }
                text += `\n\n╰━━━━━━━━━━━━━━━━━━━━╯`;
                saveEconomy(econ);
                return reply(text);
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_082_presente(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { args, getEcoUser, groupData, isGroup, loadEconomy, menc_jid2, prefix, reply, saveEconomy, sender } = scope;
    try {
        switch (command) {
            case 'presente':
            case 'gift': {
                if (!isGroup)
                    return reply('⚔️ Este comando funciona apenas em grupos com Modo RPG ativo.');
                if (!groupData.modorpg)
                    return reply(`⚔️ Modo RPG desativado! Use ${prefix}modorpg para ativar.`);
                const econ = loadEconomy();
                const me = getEcoUser(econ, sender);
                const target = (menc_jid2 && menc_jid2[0]) || null;
                if (!target)
                    return reply(`🎁 *PRESENTE*\n\n💡 Uso: ${prefix}presente @user <item> <quantidade>\n\n📦 Envie itens do seu inventário para outros jogadores!`);
                if (target === sender)
                    return reply('❌ Você não pode enviar presentes para si mesmo!');
                const item = (args[0] || '').toLowerCase();
                const qty = parseInt(args[1]) || 1;
                if (!item)
                    return reply('❌ Informe o item que deseja enviar!');
                me.inventory = me.inventory || {};
                if (!me.inventory[item] || me.inventory[item] < qty) {
                    return reply(`❌ Você não tem ${item} suficiente!\n\n📦 Você tem: ${me.inventory[item] || 0}`);
                }
                const targetData = getEcoUser(econ, target);
                targetData.inventory = targetData.inventory || {};
                me.inventory[item] -= qty;
                targetData.inventory[item] = (targetData.inventory[item] || 0) + qty;
                saveEconomy(econ);
                return reply(`╭━━━⊱ 🎁 *PRESENTE ENVIADO* ⊱━━━╮\n\n📦 Item: ${item}\n🔢 Quantidade: ${qty}\n👤 Para: @${target.split('@')[0]}\n\n✨ Presente entregue!\n\n╰━━━━━━━━━━━━━━━━━━━━╯`, { mentions: [target] });
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_086_vender(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { getEcoUser, groupData, isGroup, loadEconomy, prefix, q, reply, saveEconomy, sender } = scope;
    try {
        switch (command) {
            case 'vender':
            case 'sell': {
                if (!isGroup)
                    return reply('⚔️ Este comando funciona apenas em grupos com Modo RPG ativo.');
                if (!groupData.modorpg)
                    return reply(`⚔️ Modo RPG desativado! Use ${prefix}modorpg para ativar.`);
                const econ = loadEconomy();
                const me = getEcoUser(econ, sender);
                if (!me.investments || !econ.stockMarket) {
                    return reply('❌ Você não tem investimentos!');
                }
                const args = q.split(' ');
                const stockType = args[0]?.toLowerCase();
                const amount = parseInt(args[1]) || 1;
                if (!me.investments.stocks[stockType] || me.investments.stocks[stockType] < amount) {
                    return reply('❌ Você não tem ações suficientes!');
                }
                const price = Math.floor(econ.stockMarket.prices[stockType]);
                const totalValue = price * amount;
                me.investments.stocks[stockType] -= amount;
                me.wallet += totalValue;
                me.investments.totalProfit += totalValue;
                let text = `╭━━━⊱ 💵 *VENDA* ⊱━━━╮\n`;
                text += `╰━━━━━━━━━━━━━━━━━━━━╯\n\n`;
                text += `✅ Ações vendidas!\n\n`;
                text += `📊 Ação: ${stockType.toUpperCase()}\n`;
                text += `📈 Quantidade: ${amount}\n`;
                text += `💰 Recebido: ${totalValue.toLocaleString()}\n`;
                text += `💼 Lucro total: ${me.investments.totalProfit.toLocaleString()}`;
                saveEconomy(econ);
                return reply(text);
                break;
            }
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_217_zipbot(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { axios, from, info, nazu, nomebot, reply } = scope;
    try {
        switch (command) {
            case 'zipbot':
            case 'zip-bot':
            case 'botzip':
            case 'bot-zip':
            case 'downloadbot':
            case 'download-bot':
                try {
                    await reply('📦 Preparando o código-fonte. Um instante.');
                    const zipResponse = await axios.get('https://github.com/dgreych/shogun/archive/refs/heads/main.zip', {
                        responseType: 'arraybuffer',
                        timeout: 60000 // 60 segundos de timeout
                    });
                    if (!zipResponse.data) {
                        throw new Error('Resposta vazia do servidor GitHub');
                    }
                    await nazu.sendMessage(from, {
                        document: Buffer.from(zipResponse.data),
                        fileName: 'shogun.zip',
                        mimetype: 'application/zip',
                        caption: `📦 *Código-fonte do ${nomebot}*\n\n`
                            + `🔗 https://github.com/dgreych/shogun\n\n`
                            + `📖 *Como instalar, passo a passo:*\n`
                            + `• Android: docs/instalacao/termux.md\n`
                            + `• Windows: docs/instalacao/windows.md\n`
                            + `• Linux: docs/instalacao/linux.md\n\n`
                            + `Os guias começam do zero e mostram o que aparece na tela a cada etapa.`
                    }, { quoted: info });
                }
                catch (e) {
                    console.error('Erro ao baixar zip do bot:', e);
                    const errorMsg = e.response?.status === 404
                        ? '❌ Repositório não encontrado.'
                        : e.code === 'ECONNABORTED' || e.code === 'ETIMEDOUT'
                            ? '❌ Tempo de conexão esgotado. Tente novamente.'
                            : '❌ Erro ao baixar o arquivo.';
                    await reply(`${errorMsg}\n\nTente acessar diretamente:\n🔗 https://github.com/dgreych/shogun`);
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_218_gitbot(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { axios, prefix, reply } = scope;
    try {
        switch (command) {
            case 'gitbot':
            case 'git-bot':
            case 'github':
            case 'git-hub':
            case 'repo':
            case 'repositorio':
            case 'source':
            case 'sourcecode':
            case 'source-code':
                try {
                    reply('🔍 Buscando informações do repositório...').then(() => {
                        const githubHeaders = { 'Accept': 'application/vnd.github+json' };
                        Promise.all([
                            axios.get('https://api.github.com/repos/dgreych/shogun', { headers: githubHeaders }),
                            axios.get('https://api.github.com/repos/dgreych/shogun/commits?per_page=1', { headers: githubHeaders })
                        ]).then(([repoResponse, commitsResponse]) => {
                            const repo = repoResponse.data;
                            // Pegar total de commits do header Link
                            let totalCommits = 0;
                            const linkHeader = commitsResponse.headers.link;
                            if (linkHeader) {
                                const lastMatch = linkHeader.match(/page=(\d+)>;\s*rel="last"/);
                                if (lastMatch)
                                    totalCommits = parseInt(lastMatch[1]);
                            }
                            else {
                                totalCommits = commitsResponse.data.length;
                            }
                            // Calcular tempo desde criação
                            const createdDate = new Date(repo.created_at);
                            const now = new Date();
                            const diffMs = now - createdDate;
                            const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                            const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            const segundos = Math.floor((diffMs % (1000 * 60)) / 1000);
                            const tempoAtivo = `${dias} dias, ${horas} horas, ${minutos} minutos e ${segundos} segundos`;
                            const createdAt = createdDate.toLocaleDateString('pt-BR');
                            const updatedAt = new Date(repo.updated_at).toLocaleDateString('pt-BR');
                            const pushedAt = new Date(repo.pushed_at).toLocaleDateString('pt-BR');
                            const gitInfo = `╭━━━⊱ 🐙 *GITHUB INFO* ⊱━━━╮
      │
      │ 📦 *Repositório:* ${repo.name}
      │ 📝 *Descrição:* ${repo.description || 'Sem descrição'}
      │
      │ 👨‍💻 *Atualizado Por:* ${repo.owner.login}
      │ 🔗 *Perfil:* https://github.com/${repo.owner.login}
      │
      │ ⭐ *Stars:* ${repo.stargazers_count}
      │ 🍴 *Forks:* ${repo.forks_count}
      │ 👀 *Watchers:* ${repo.subscribers_count}
      │ 🐛 *Issues:* ${repo.open_issues_count}
      │ 📊 *Commits:* ${totalCommits}
      │
      │ 💻 *Linguagem:* ${repo.language || 'N/A'}
      │ 📜 *Licença:* ${repo.license?.name || 'Sem licença'}
      │
      │ 📅 *Criado em:* ${createdAt}
      │ 🔄 *Atualizado:* ${updatedAt}
      │ 📤 *Último push:* ${pushedAt}
      │
      │ ⏱️ *Nazuna vem sendo ativamente*
      │ *mantida há:* ${tempoAtivo}
      │
      │ 🔗 *Links:*
      │ • Repo: ${repo.html_url}
      │ • Clone: ${repo.clone_url}
      │
      │ 📞 *Suporte:* wa.me/559681361714
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━━━╯
      
      > Use *${prefix}zipbot* para baixar o código!`;
                            reply(gitInfo);
                        }).catch((e) => {
                            console.error('Erro ao buscar info do GitHub:', e);
                            reply(`❌ Erro ao buscar informações. Acesse diretamente:\n🔗 https://github.com/dgreych/shogun\n📞 Suporte: wa.me/559681361714`);
                        });
                    });
                }
                catch (e) {
                    console.error('Erro no comando gitbot:', e);
                    reply('❌ Erro ao processar o comando. Tente novamente.');
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_307_rankativos(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { AllgroupMembers, from, fs, getUserName, groupData, groupFile, groupMetadata, i6, info, isGroup, nazu, reply, socialCardWithBunnyFy } = scope;
    try {
        switch (command) {
            case 'rankativos':
            case 'rankativo':
                try {
                    if (!isGroup)
                        return reply("isso so pode ser usado em grupo 💔");
                    // Verifica se a preservação do contador está ativada
                    const preservarContadorRankativo = groupData.preservarContador === true;
                    // Verify current group members first
                    let currentMembers = AllgroupMembers;
                    let validUsers = [];
                    // Filtra usuários que saíram do grupo (apenas se preservação não estiver ativada)
                    if (!preservarContadorRankativo) {
                        groupData.contador = groupData.contador.filter(user => {
                            const userId = user.id;
                            const isValidMember = currentMembers.includes(userId);
                            if (!isValidMember) {
                                console.log(`[RANKATIVO] Removed departed user: ${userId} (${getUserName(userId)})`);
                                return false;
                            }
                            validUsers.push(user);
                            return true;
                        });
                        // Save updated data
                        fs.writeFileSync(groupFile, JSON.stringify(groupData, null, 2));
                    }
                    else {
                        // Se preservação estiver ativada, apenas filtra para validUsers sem remover do contador
                        validUsers = (groupData.contador || []).filter(user => {
                            const userId = user.id;
                            return currentMembers.includes(userId);
                        });
                    }
                    var blue67;
                    blue67 = validUsers.sort((a, b) => (a.figu == undefined ? a.figu = 0 : a.figu + a.msg + a.cmd) < (b.figu == undefined ? b.figu = 0 : b.figu + b.cmd + b.msg) ? 0 : -1);
                    var menc;
                    menc = [];
                    let blad;
                    blad = `*🏆 Rank dos ${blue67.length < 10 ? blue67.length : 10} mais ativos do grupo:*\n`;
                    for (i6 = 0; i6 < (blue67.length < 10 ? blue67.length : 10); i6++) {
                        if (blue67[i6].id) {
                            if (i6 != null) {
                                blad += `\n*🏅 ${i6 + 1}º Lugar:* @${getUserName(blue67[i6].id)}\n- mensagens encaminhadas: *${blue67[i6].msg}*\n- comandos executados: *${blue67[i6].cmd}*\n- Figurinhas encaminhadas: *${blue67[i6].figu}*\n`;
                            }
                            if (!groupData.mark) {
                                groupData.mark = {};
                            }
                            if (!['0', 'marca'].includes(groupData.mark[blue67[i6].id])) {
                                menc.push(blue67[i6].id);
                            }
                        }
                    }
                    const rankingCard = await socialCardWithBunnyFy('ranking', {
                        title: 'Membros mais ativos',
                        subtitle: String(groupMetadata?.subject || '').slice(0, 72),
                        unit: 'pontos',
                        entries: blue67.slice(0, 10).map(user => ({
                            name: getUserName(user.id).slice(0, 48),
                            value: Number(user.msg || 0) + Number(user.cmd || 0) + Number(user.figu || 0)
                        })),
                        theme: 'emerald'
                    }, { legacyFallback: async () => null }).catch(() => null);
                    await nazu.sendMessage(from, rankingCard?.ok ? {
                        image: rankingCard.buffer,
                        mimetype: rankingCard.mime,
                        caption: blad,
                        mentions: menc
                    } : {
                        text: blad,
                        mentions: menc
                    }, { quoted: info });
                }
                catch (e) {
                    console.error('[RANKATIVO] Erro:', e);
                    await reply("❌ Ocorreu um erro interno. Tente novamente em alguns minutos.");
                }
                break;
        }
        return undefined;
    }
    finally {
        scope.i6 = i6;
    }
}
async function member_308_rankinativos(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { AllgroupMembers, from, fs, getUserName, groupData, groupFile, info, isGroup, nazu, reply } = scope;
    try {
        switch (command) {
            case 'rankinativos':
            case 'rankinativo':
                try {
                    if (!isGroup)
                        return reply("isso so pode ser usado em grupo 💔");
                    // Verifica se a preservação do contador está ativada
                    const preservarContador = groupData.preservarContador === true;
                    // Verify current group members first
                    let currentMembers = AllgroupMembers;
                    let validUsers = [];
                    // Filtra usuários que saíram do grupo (apenas se preservação não estiver ativada)
                    if (!preservarContador) {
                        groupData.contador = groupData.contador.filter(user => {
                            const userId = user.id;
                            const isValidMember = currentMembers.includes(userId);
                            if (!isValidMember) {
                                console.log(`[RANKINATIVO] Removed departed user: ${userId} (${getUserName(userId)})`);
                                return false;
                            }
                            validUsers.push(user);
                            return true;
                        });
                        // Save updated data
                        fs.writeFileSync(groupFile, JSON.stringify(groupData, null, 2));
                    }
                    else {
                        // Se preservação estiver ativada, apenas filtra para validUsers sem remover do contador
                        validUsers = (groupData.contador || []).filter(user => {
                            const userId = user.id;
                            return currentMembers.includes(userId);
                        });
                    }
                    var blue67;
                    blue67 = validUsers.sort((a, b) => {
                        const totalA = (a.figu ?? 0) + a.msg + a.cmd;
                        const totalB = (b.figu ?? 0) + b.msg + b.cmd;
                        return totalA - totalB;
                    });
                    var menc;
                    menc = [];
                    var blad;
                    blad = `*🗑️ Rank dos ${blue67.length < 10 ? blue67.length : 10} mais inativos do grupo:*\n`;
                    for (i6 = 0; i6 < (blue67.length < 10 ? blue67.length : 10); i6++) {
                        var i6;
                        if (i6 != null) {
                            var blad;
                            blad += `\n*🏅 ${i6 + 1}º Lugar:* @${getUserName(blue67[i6].id)}\n- mensagens encaminhadas: *${blue67[i6].msg}*\n- comandos executados: *${blue67[i6].cmd}*\n- Figurinhas encaminhadas: *${blue67[i6].figu}*\n`;
                        }
                        if (!groupData.mark) {
                            groupData.mark = {};
                        }
                        if (!['0', 'marca'].includes(groupData.mark[blue67[i6].id])) {
                            menc.push(blue67[i6].id);
                        }
                    }
                    await nazu.sendMessage(from, {
                        text: blad,
                        mentions: menc
                    }, {
                        quoted: info
                    });
                }
                catch (e) {
                    console.error('[RANKINATIVO] Erro:', e);
                    await reply("❌ Ocorreu um erro interno. Tente novamente em alguns minutos.");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_309_checkativo(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { AllgroupMembers, getUserName, groupData, info, isGroup, reply, sender } = scope;
    try {
        switch (command) {
            case 'checkativo':
                try {
                    if (!isGroup)
                        return reply("Este comando só funciona em grupos.");
                    const mentionedJids = info.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    let targetUser = sender;
                    // Se mencionou alguém, usa o mencionado
                    if (mentionedJids.length > 0) {
                        targetUser = mentionedJids[0];
                    }
                    // Verifica se o usuário está no grupo
                    if (!AllgroupMembers.includes(targetUser)) {
                        return reply("Este usuário não está no grupo.");
                    }
                    // Busca os dados do usuário no contador
                    const userData = (groupData.contador || []).find(u => u.id === targetUser);
                    const userName = getUserName(targetUser);
                    if (!userData) {
                        return reply(`📊 *Atividade de @${userName}*\n\nNenhum dado encontrado no contador deste grupo.`, {
                            mentions: [targetUser]
                        });
                    }
                    const messages = userData.msg || 0;
                    const commands = userData.cmd || 0;
                    const stickers = userData.figu || 0;
                    const total = messages + commands + stickers;
                    const lastActivity = userData.lastActivity
                        ? new Date(userData.lastActivity).toLocaleString('pt-BR', {
                            timeZone: 'America/Sao_Paulo',
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        })
                        : 'N/A';
                    const checkMessage = `📊 *Atividade de @${userName}*\n\n` +
                        `💬 *Mensagens:* ${messages}\n` +
                        `⚒️ *Comandos:* ${commands}\n` +
                        `🎨 *Figurinhas:* ${stickers}\n` +
                        `📈 *Total:* ${total}\n` +
                        `🕐 *Última atividade:* ${lastActivity}`;
                    await reply(checkMessage, {
                        mentions: [targetUser]
                    });
                }
                catch (e) {
                    console.error('[CHECKATIVO] Erro:', e);
                    await reply("❌ Ocorreu um erro ao verificar a atividade. Tente novamente.");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_310_atividade(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { AllgroupMembers, from, getUserName, groupData, groupFile, info, isGroup, nazu, optimizer, reply, writeJsonFile } = scope;
    try {
        switch (command) {
            case 'atividade':
                try {
                    if (!isGroup)
                        return reply("Este comando só funciona em grupos.");
                    // Verifica membros atuais do grupo
                    const currentMembers = AllgroupMembers;
                    // Filtra usuários que saíram do grupo
                    groupData.contador = (groupData.contador || []).filter(user => {
                        return user && user.id && currentMembers.includes(user.id);
                    });
                    // Salva dados atualizados
                    writeJsonFile(groupFile, groupData);
                    if (isGroup) {
                        optimizer.invalidateGroup(from);
                    }
                    // Verifica se há usuários no contador
                    if (!groupData.contador || groupData.contador.length === 0) {
                        return reply("📊 *Atividade do Grupo*\n\nNenhum usuário no contador ainda.");
                    }
                    // Ordena por atividade total (mensagens + comandos + figurinhas)
                    const sortedUsers = [...groupData.contador].sort((a, b) => {
                        const totalA = (a.msg || 0) + (a.cmd || 0) + (a.figu || 0);
                        const totalB = (b.msg || 0) + (b.cmd || 0) + (b.figu || 0);
                        return totalB - totalA;
                    });
                    // Monta a mensagem
                    let activityMessage = `📊 *Atividade do Grupo*\n\n`;
                    activityMessage += `👥 *Total de usuários:* ${sortedUsers.length}\n\n`;
                    // Lista todos os usuários com suas estatísticas
                    const mentions = [];
                    sortedUsers.forEach((user, index) => {
                        if (user && user.id) {
                            const total = (user.msg || 0) + (user.cmd || 0) + (user.figu || 0);
                            activityMessage += `${index + 1}º @${getUserName(user.id)}\n`;
                            activityMessage += `   💬 Msg: ${user.msg || 0} | ⚒️ Cmd: ${user.cmd || 0} | 🎨 Fig: ${user.figu || 0} | 📈 Total: ${total}\n\n`;
                            mentions.push(user.id);
                        }
                    });
                    await nazu.sendMessage(from, {
                        text: activityMessage,
                        mentions: mentions
                    }, {
                        quoted: info
                    });
                }
                catch (e) {
                    console.error('[ATIVIDADE] Erro:', e);
                    await reply("❌ Ocorreu um erro ao mostrar a atividade. Tente novamente.");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_311_totalcmd(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { __dirname, from, fs, info, nazu, reply } = scope;
    try {
        switch (command) {
            case 'totalcmd':
            case 'totalcomando':
                try {
                    fs.readFile(__dirname + '/index.js', 'utf8', async (err, data) => {
                        if (err)
                            throw err;
                        const comandos = [...data.matchAll(/case [`'"](\w+)[`'"]/g)].map(m => m[1]);
                        await nazu.sendMessage(from, {
                            text: `╭〔 🤖 *Meus Comandos* 〕╮\n` + `┣ 📌 Total: *${comandos.length}* comandos\n` + `╰━━━━━━━━━━━━━━━╯`
                        }, {
                            quoted: info
                        });
                    });
                }
                catch (e) {
                    console.error(e);
                    await reply("❌ Ocorreu um erro interno. Tente novamente em alguns minutos.");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_312_meustatus(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { GRUPOS_DIR, from, fs, getUserName, groupData, groupName, info, isGroup, isGroupAdmin, isOwner, isPremium, nazu, nomebot, nomedono, pathz, pushname, reply, sender } = scope;
    try {
        switch (command) {
            case 'meustatus':
                try {
                    let groupMessages = 0;
                    let groupCommands = 0;
                    let groupStickers = 0;
                    if (isGroup && groupData.contador && Array.isArray(groupData.contador)) {
                        const userData = groupData.contador.find(u => u.id === sender);
                        if (userData) {
                            groupMessages = userData.msg || 0;
                            groupCommands = userData.cmd || 0;
                            groupStickers = userData.figu || 0;
                        }
                    }
                    let totalMessages = 0;
                    let totalCommands = 0;
                    let totalStickers = 0;
                    const groupFiles = fs.readdirSync(GRUPOS_DIR).filter(file => file.endsWith('.json'));
                    for (const file of groupFiles) {
                        try {
                            const groupData = JSON.parse(fs.readFileSync(pathz.join(GRUPOS_DIR, file)));
                            if (groupData.contador && Array.isArray(groupData.contador)) {
                                const userData = groupData.contador.find(u => u.id === sender);
                                if (userData) {
                                    totalMessages += userData.msg || 0;
                                    totalCommands += userData.cmd || 0;
                                    totalStickers += userData.figu || 0;
                                }
                            }
                        }
                        catch (e) {
                            console.error(`Erro ao ler ${file}:`, e);
                        }
                    }
                    const userName = pushname || getUserName(sender);
                    const userStatus = isOwner ? 'Dono' : isPremium ? 'Premium' : isGroupAdmin ? 'Admin' : 'Membro';
                    let profilePic = null;
                    try {
                        profilePic = await nazu.profilePictureUrl(sender, 'image');
                    }
                    catch (e) { }
                    const statusMessage = `📊 *Meu Status - ${userName}* 📊\n\n👤 *Nome*: ${userName}\n📱 *Número*: @${getUserName(sender)}\n⭐ *Status*: ${userStatus}\n\n${isGroup ? `\n📌 *No Grupo: ${groupName}*\n💬 Mensagens: ${groupMessages}\n⚒️ Comandos: ${groupCommands}\n🎨 Figurinhas: ${groupStickers}\n` : ''}\n\n🌐 *Geral (Todos os Grupos)*\n💬 Mensagens: ${totalMessages}\n⚒️ Comandos: ${totalCommands}\n🎨 Figurinhas: ${totalStickers}\n\n✨ *Bot*: ${nomebot} by ${nomedono} ✨`;
                    if (profilePic) {
                        await nazu.sendMessage(from, {
                            image: {
                                url: profilePic
                            },
                            caption: statusMessage,
                            mentions: [sender]
                        }, {
                            quoted: info
                        });
                    }
                    else {
                        await nazu.sendMessage(from, {
                            text: statusMessage,
                            mentions: [sender]
                        }, {
                            quoted: info
                        });
                    }
                }
                catch (e) {
                    console.error(e);
                    await reply("❌ Ocorreu um erro interno. Tente novamente em alguns minutos.");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_314_statusbot(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { __dirname, botState, botVersion, formatUptime, fs, globalBlocks, isRentalModeActive, isUserId, nazu, nomebot, nomedono, os, premiumListaZinha, reply } = scope;
    try {
        switch (command) {
            case 'statusbot':
            case 'infobot':
            case 'botinfo':
                try {
                    const botUptime = formatUptime(process.uptime(), true);
                    const botMemUsage = process.memoryUsage();
                    const memUsed = (botMemUsage.heapUsed / 1024 / 1024).toFixed(2);
                    const memTotal = (botMemUsage.heapTotal / 1024 / 1024).toFixed(2);
                    const allGroups = await nazu.groupFetchAllParticipating();
                    const totalGroups = Object.keys(allGroups).length;
                    let totalUsers = 0;
                    Object.values(allGroups).forEach(group => {
                        totalUsers += group.participants.length;
                    });
                    const botStatus = botState.status === 'on' ? '✅ Online' : '❌ Offline';
                    const rentalMode = isRentalModeActive() ? '✅ Ativo' : '❌ Desativo';
                    const nodeVersion = process.version;
                    const platform = os.platform();
                    let totalCommands = 0;
                    try {
                        const indexContent = fs.readFileSync(__dirname + '/index.js', 'utf-8');
                        const comandos = [...indexContent.matchAll(/case [`'"](\w+)[`'"]/g)].map(m => m[1]);
                        totalCommands = comandos.length;
                    }
                    catch (e) {
                        totalCommands = 'N/A';
                    }
                    const premiumUsers = Object.keys(premiumListaZinha).filter(key => isUserId(key)).length;
                    const premiumGroups = Object.keys(premiumListaZinha).filter(key => key.includes('@g.us')).length;
                    const blockedUsers = Object.keys(globalBlocks.users || {}).length;
                    const blockedCommands = Object.keys(globalBlocks.commands || {}).length;
                    const currentTime = new Date().toLocaleString('pt-BR', {
                        timeZone: 'America/Sao_Paulo'
                    });
                    const lines = ["╭───🤖 STATUS DO BOT ───╮", `┊ 🏷️ Nome: ${nomebot}`, `┊ 👨‍💻 Dono: ${nomedono}`, `┊ 🆚 Versão: ${botVersion}`, `┊ 🟢 Status: ${botStatus}`, `┊ ⏰ Online há: ${botUptime}`, `┊ 🖥️ Plataforma: ${platform}`, `┊ 🟢 Node.js: ${nodeVersion}`, "┊", "┊ 📊 *Estatísticas:*", `┊ • 👥 Grupos: ${totalGroups}`, `┊ • 👤 Usuários: ${totalUsers}`, `┊ • ⚒️ Comandos: ${totalCommands}`, `┊ • 💎 Users Premium: ${premiumUsers}`, `┊ • 💎 Grupos Premium: ${premiumGroups}`, "┊", "┊ 🛡️ *Segurança:*", `┊ • 🚫 Users Bloqueados: ${blockedUsers}`, `┊ • 🚫 Cmds Bloqueados: ${blockedCommands}`, `┊ • 🏠 Modo Aluguel: ${rentalMode}`, "┊", "┊ 💾 *Sistema:*", `┊ • 🧠 RAM Usada: ${memUsed}MB`, `┊ • 📦 RAM Total: ${memTotal}MB`, `┊ • 🕐 Hora Atual: ${currentTime}`, "╰───────────────╯"].join("\n");
                    await reply(lines);
                }
                catch (e) {
                    console.error("Erro em statusbot:", e);
                    await reply("❌ Ocorreu um erro interno. Tente novamente em alguns minutos.");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_316_topcmd(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { __dirname, commandStats, from, fs, info, menuTopCmd, nazu, nomebot, prefix, pushname, reply } = scope;
    try {
        switch (command) {
            case 'topcmd':
            case 'topcmds':
            case 'comandosmaisusados':
                try {
                    if (!commandStats || typeof commandStats.getMostUsedCommands !== 'function') {
                        console.warn('[COMMANDSTATS] getMostUsedCommands not available');
                        return reply("Sistema de estatísticas temporariamente indisponível.");
                    }
                    const topCommands = await commandStats.getMostUsedCommands(10);
                    const menuVideoPath = __dirname + '/../midias/menu.mp4';
                    const menuImagePath = __dirname + '/../midias/menu.jpg';
                    const useVideo = fs.existsSync(menuVideoPath);
                    const mediaPath = useVideo ? menuVideoPath : menuImagePath;
                    const mediaBuffer = fs.readFileSync(mediaPath);
                    const menuText = await menuTopCmd(prefix, nomebot, pushname, topCommands);
                    await nazu.sendMessage(from, {
                        [useVideo ? 'video' : 'image']: mediaBuffer,
                        caption: menuText,
                        gifPlayback: useVideo,
                        mimetype: useVideo ? 'video/mp4' : 'image/jpeg'
                    }, {
                        quoted: info
                    });
                }
                catch (e) {
                    console.error(e);
                    await reply("❌ Ocorreu um erro interno. Tente novamente em alguns minutos.");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_318_statusgp(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { formatScheduleLastRun, from, getCachedGroupMetadata, getGroupRentalStatus, getUserName, groupAdmins, groupData, groupPrefix, isAntiLinkCanal, isAntiLinkGp, isAntiPorn, isGroup, isModoBn, isModoLite, isRentalModeActive, parceriasData, premiumListaZinha, reply } = scope;
    try {
        switch (command) {
            case 'statusgp':
            case 'dadosgp':
                try {
                    if (!isGroup)
                        return reply("❌ Este comando só funciona em grupos!");
                    const meta = await getCachedGroupMetadata(from);
                    const subject = meta.subject || "—";
                    const desc = meta.desc?.toString() || "Sem descrição";
                    const createdAt = meta.creation ? new Date(meta.creation * 1000).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : "Desconhecida";
                    const ownerJid = meta.owner || meta.participants.find(p => p.admin && p.isCreator)?.lid || meta.participants.find(p => p.admin && p.isCreator)?.id || "Desconhecido";
                    const ownerTag = ownerJid !== "Desconhecido" ? `@${getUserName(ownerJid)}` : "Desconhecido";
                    const totalMembers = meta.participants.length;
                    const totalAdmins = groupAdmins.length;
                    let totalMsgs = 0, totalCmds = 0, totalFigs = 0;
                    (groupData.contador || []).forEach(u => {
                        totalMsgs += u.msg || 0;
                        totalCmds += u.cmd || 0;
                        totalFigs += u.figu || 0;
                    });
                    const rentGlob = isRentalModeActive();
                    const rentInfo = getGroupRentalStatus(from);
                    const rentStatus = rentGlob ? rentInfo.active ? `✅ Ativo até ${rentInfo.permanent ? 'Permanente' : new Date(rentInfo.expiresAt).toLocaleDateString('pt-BR')}` : "❌ Expirado" : "❌ Desativado";
                    const isPremGp = !!premiumListaZinha[from] ? "✅" : "❌";
                    const secFlags = [
                        ["Antiporn", !!isAntiPorn],
                        ["AntiLink GP", !!isAntiLinkGp],
                        ["AntiLink Canal", !!isAntiLinkCanal],
                        ["AntiLinkHard", !!groupData.antilinkhard],
                        ["AntiLinkSoft", !!groupData.antilinksoft],
                        ["AntiDoc", !!groupData.antidoc],
                        ["AntiLoc", !!groupData.antiloc],
                        ["AntiBtn", !!groupData.antibtn],
                        ["AntiStatus", !!groupData.antistatus],
                        ["AntiDelete", !!groupData.antidel],
                        ["AntiSticker", !!(groupData.antifig && groupData.antifig.enabled)],
                    ];
                    const resFlags = [
                        ["AutoDL", !!groupData.autodl],
                        ["AutoSticker", !!groupData.autoSticker],
                        ["Assistente", !!groupData.assistente],
                        ["AutoRepo", !!groupData.autorepo],
                        ["Leveling", !!groupData.levelingEnabled],
                        ["Bem-vindo", !!groupData.bemvindo],
                        ["X9 (promo/rebaix)", !!groupData.x9],
                        ["Modo Lite", !!isModoLite],
                        ["Modo Brincadeira", !!isModoBn],
                        ["Modo RPG", !!groupData.modorpg]
                    ];
                    const admFlags = [["Só Admins", !!groupData.soadm]];
                    const toLines = (pairs) => pairs.filter(([_, v]) => typeof v === 'boolean').map(([k, v]) => `┊   ${v ? '✅' : '❌'} ${k}`);
                    const configsSection = [
                        "┊",
                        "┊ ⚙️ *Configurações:*",
                        "┊ 🔒 Segurança:",
                        ...toLines(secFlags),
                        "┊ 🧰 Recursos:",
                        ...toLines(resFlags),
                        "┊ 🛠️ Administração:",
                        ...toLines(admFlags)
                    ].join('\n');
                    const schedule = groupData.schedule || {};
                    const openTime = schedule.openTime ? schedule.openTime : '—';
                    const closeTime = schedule.closeTime ? schedule.closeTime : '—';
                    const lastOpen = formatScheduleLastRun(schedule.lastRun?.open);
                    const lastClose = formatScheduleLastRun(schedule.lastRun?.close);
                    const linesHeader = [
                        "╭───📊 STATUS DO GRUPO ───╮",
                        `┊ 📝 Nome: ${subject}`,
                        `┊ 🆔 ID: ${getUserName(from)}`,
                        `┊ 👑 Dono: ${ownerTag}`,
                        `┊ 📅 Criado: ${createdAt}`,
                        `┊ 📄 Desc: ${desc.slice(0, 35)}${desc.length > 35 ? '...' : ''}`,
                        `┊ 👥 Membros: ${totalMembers}`,
                        `┊ 👮 Admins: ${totalAdmins}`,
                        `┊ 💎 Premium: ${isPremGp}`,
                        `┊ 🏠 Aluguel: ${rentStatus}`,
                        "┊",
                        "┊ 📊 *Estatísticas:*",
                        `┊ • 💬 Mensagens: ${totalMsgs}`,
                        `┊ • ⚒️ Comandos: ${totalCmds}`,
                        `┊ • 🎨 Figurinhas: ${totalFigs}`,
                        "╰───────────────╯"
                    ].join('\n');
                    const extrasLines = [
                        "\n╭───📌 REGRAS E OUTROS ───╮",
                        `┊ 🧩 Prefixo: ${groupPrefix}`,
                        `┊ 🧱 Min Legenda: ${groupData.minMessage ? `✅ ON (min ${groupData.minMessage.minDigits}, ação: ${groupData.minMessage.action})` : '❌ OFF'}`,
                        `┊ 📉 Limite Msg: ${groupData.messageLimit?.enabled ? `✅ ON (${groupData.messageLimit.limit}/${groupData.messageLimit.interval}s, ação: ${groupData.messageLimit.action})` : '❌ OFF'}`,
                        `┊ 🤝 Parcerias: ${parceriasData?.active ? `✅ ON (${Object.keys(parceriasData.partners || {}).length} parceiros)` : '❌ OFF'}`,
                        `┊ ⛔ Cmds bloqueados: ${groupData.blockedCommands ? Object.values(groupData.blockedCommands).filter(Boolean).length : 0}`,
                        `┊ 🚫 Usuários bloqueados: ${groupData.blockedUsers ? Object.keys(groupData.blockedUsers).length : 0}`,
                        `┊ 😴 AFKs ativos: ${groupData.afkUsers ? Object.keys(groupData.afkUsers).length : 0}`,
                        `┊ 🧑‍⚖️ Moderadores: ${Array.isArray(groupData.moderators) ? groupData.moderators.length : 0}`,
                        "╰───────────────╯"
                    ].join('\n');
                    const lines = [linesHeader, configsSection].join('\n');
                    const schedLines = [
                        "\n╭───⏰ AGENDAMENTOS ───╮",
                        `┊ 🔓 Abrir: ${openTime}`,
                        `┊ 🔒 Fechar: ${closeTime}`,
                        `┊ 🗓️ Últ. abrir: ${lastOpen}`,
                        `┊ 🗓️ Últ. fechar: ${lastClose}`,
                        "╰───────────────╯"
                    ].join('\n');
                    const fullCaption = (lines + schedLines + '\n' + extrasLines).trim();
                    await reply(fullCaption, { mentions: ownerJid !== "Desconhecido" ? [ownerJid] : [] });
                }
                catch (e) {
                    console.error("Erro em statusgp:", e);
                    await reply("❌ Ocorreu um erro interno. Tente novamente em alguns minutos.");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_324_ping(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { formatUptime, from, info, nazu, reply } = scope;
    try {
        switch (command) {
            case 'ping':
                try {
                    const timestamp = Date.now();
                    const speedConverted = (timestamp - info.messageTimestamp * 1000) / 1000;
                    const uptimeBot = formatUptime(process.uptime());
                    let statusEmoji = '🟢';
                    let statusTexto = 'Excelente';
                    let statusCor = '🟩';
                    if (speedConverted > 2) {
                        statusEmoji = '🟡';
                        statusTexto = 'Bom';
                        statusCor = '🟨';
                    }
                    if (speedConverted > 5) {
                        statusEmoji = '🟠';
                        statusTexto = 'Médio';
                        statusCor = '🟧';
                    }
                    if (speedConverted > 8) {
                        statusEmoji = '🔴';
                        statusTexto = 'Ruim';
                        statusCor = '🟥';
                    }
                    await nazu.sendMessage(from, {
                        text: `╭⊱ ⚡ *STATUS DA CONEXÃO* ⚡ ⊱╮
      │
      │ 📡 *Informações de Latência*
      │ ├─ ${statusEmoji} Velocidade: *${speedConverted.toFixed(3)}s*
      │ ├─ ${statusCor} Qualidade: *${statusTexto}*
      │ └─ 📊 Status: *${speedConverted <= 2 ? 'Ótima' : speedConverted <= 5 ? 'Boa' : speedConverted <= 8 ? 'Regular' : 'Precisa Melhorar'}*
      │
      │ ⏱️ *Informações do Sistema*
      │ ├─ 🟢 Tempo Online: *${uptimeBot}*
      │ ├─ 📈 Resposta: *${speedConverted <= 1 ? 'Instantânea' : speedConverted <= 3 ? 'Rápida' : 'Lenta'}*
      │ └─ 🌐 Servidor: *Online*
      │
      ╰━━━━━━━━━━━━━━━━━━━━━━━━╯`
                    }, { quoted: info });
                }
                catch (e) {
                    console.error("Erro no comando ping:", e);
                    await reply("❌ Ocorreu um erro ao processar o comando ping");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_343_mention(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { buildGroupFilePath, from, fs, groupData, isGroup, prefix, q, reply, sender } = scope;
    try {
        switch (command) {
            case 'mention':
                try {
                    if (!isGroup)
                        return reply("isso so pode ser usado em grupo 💔");
                    if (!q)
                        return reply(`📢 *Configuração de Marcações*\n\n🔧 Escolha como deseja ser mencionado:\n\n✅ *${prefix}mention all* → Marcado em tudo (marcações e jogos).\n📢 *${prefix}mention marca* → Apenas em marcações de administradores.\n🎮 *${prefix}mention games* → Somente em jogos do bot.\n🚫 *${prefix}mention 0* → Não será mencionado em nenhuma ocasião.`);
                    let options = {
                        all: '✨ Você agora será mencionado em todas as interações do bot, incluindo marcações de administradores e os jogos!',
                        marca: '📢 A partir de agora, você será mencionado apenas quando um administrador marcar.',
                        games: '🎮 Você optou por ser mencionado somente em jogos do bot.',
                        0: '🔕 Silêncio ativado! Você não será mais mencionado pelo bot, nem em marcações nem em jogos.'
                    };
                    if (options[q.toLowerCase()] !== undefined) {
                        if (!groupData.mark) {
                            groupData.mark = {};
                        }
                        groupData.mark[sender] = q.toLowerCase();
                        fs.writeFileSync(buildGroupFilePath(from), JSON.stringify(groupData, null, 2));
                        return reply(`*${options[q.toLowerCase()]}*`);
                    }
                    reply(`❌ Opção inválida! Use *${prefix}mention* para ver as opções.`);
                }
                catch (e) {
                    console.error(e);
                    reply("ocorreu um erro 💔");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_440_caixa(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { args, getEcoUser, gifts, prefix, reply, saveEconomy, sender } = scope;
    try {
        switch (command) {
            case 'caixa':
            case 'box':
                if (!gifts)
                    return reply("Sistema de presentes temporariamente indisponível.");
                const tipoBox = args[0]?.toLowerCase();
                if (!tipoBox) {
                    return reply(`🎁 *Sistema de Caixas*
      
      ${prefix}caixa diaria - Abre caixa diária grátis
      ${prefix}caixa rara - Abre caixa rara (500 gold)
      ${prefix}caixa lendaria - Abre caixa lendária (2000 gold)
      
      Use ${prefix}inventario para ver seus itens!`);
                }
                // Precisa do sistema de economia para caixas pagas
                const userEco = getEcoUser(sender);
                let resultBox;
                if (tipoBox === 'diaria' || tipoBox === 'daily') {
                    resultBox = gifts.openDailyBox(sender);
                }
                else if (tipoBox === 'rara' || tipoBox === 'rare') {
                    if (userEco.gold < 500)
                        return reply("❌ Você precisa de 500 gold para abrir uma caixa rara!");
                    resultBox = gifts.openBox(sender, 'rara');
                    if (resultBox.success) {
                        userEco.gold -= 500;
                        saveEconomy();
                    }
                }
                else if (tipoBox === 'lendaria' || tipoBox === 'legendary') {
                    if (userEco.gold < 2000)
                        return reply("❌ Você precisa de 2000 gold para abrir uma caixa lendária!");
                    resultBox = gifts.openBox(sender, 'lendaria');
                    if (resultBox.success) {
                        userEco.gold -= 2000;
                        saveEconomy();
                    }
                }
                else {
                    return reply(`❌ Tipo inválido! Use: diaria, rara ou lendaria`);
                }
                return reply(resultBox.message);
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_442_inventario(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { gifts, reply, sender } = scope;
    try {
        switch (command) {
            case 'inventario':
            case 'inventory':
                if (!gifts)
                    return reply("Sistema de presentes temporariamente indisponível.");
                const inv = gifts.getInventory(sender);
                return reply(inv);
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_444_toprep(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { reply, reputation } = scope;
    try {
        switch (command) {
            case 'toprep':
            case 'rankrep':
                if (!reputation)
                    return reply("Sistema de reputação temporariamente indisponível.");
                const ranking = reputation.getRepRanking(10);
                return reply(ranking);
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_445_denunciar(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { args, from, menc_os2, prefix, reply, reputation, sender } = scope;
    try {
        switch (command) {
            case 'denunciar':
            case 'report':
                if (!reputation)
                    return reply("Sistema de reputação temporariamente indisponível.");
                if (!menc_os2)
                    return reply(`❌ Marque quem você quer denunciar!\n\nUso: ${prefix}denunciar @user <motivo>`);
                const motivoDenuncia = args.slice(1).join(' ');
                if (!motivoDenuncia)
                    return reply("❌ Informe o motivo da denúncia!");
                const resultReport = reputation.reportUser(sender, menc_os2, from, motivoDenuncia);
                return reply(resultReport.message);
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_446_denuncias(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { from, isGroupAdmin, isOwnerOrSub, reply, reputation } = scope;
    try {
        switch (command) {
            case 'denuncias':
            case 'reports':
                if (!reputation)
                    return reply("Sistema de reputação temporariamente indisponível.");
                if (!isGroupAdmin && !isOwnerOrSub)
                    return reply("❌ Apenas admins podem ver denúncias!");
                const reportsData = reputation.getReports(from);
                return reply(reportsData);
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_479_perfil(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { from, getUserName, info, menc_os2, nazu, pushname, reply, sender } = scope;
    try {
        switch (command) {
            case 'perfil':
                try {
                    // O alvo já vinha sendo lido de info.mentionedJid e info.quoted, que não
                    // existem: o Baileys põe menção e citação em
                    // info.message.extendedTextMessage.contextInfo. Por isso o comando sempre
                    // caía no próprio remetente, em silêncio, e marcar alguém não fazia nada.
                    // menc_os2 já resolve isso na entrada da mensagem: menção primeiro, senão
                    // o autor da mensagem citada.
                    const mentionedUser = menc_os2 || null;
                    const target = mentionedUser || sender;
                    const targetId = getUserName(target);
                    const targetName = `@${targetId}`;
                    const seed = target.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                    const levels = {
                        puta: Math.floor(((Math.sin(seed * 1) * 50 + 50)) % 101),
                        gado: Math.floor(((Math.cos(seed * 2) * 50 + 50)) % 101),
                        corno: Math.floor(((Math.tan(seed * 3) * 50 + 50)) % 101),
                        sortudo: Math.floor(((Math.sin(seed * 4) * 50 + 50)) % 101),
                        carisma: Math.floor(((Math.cos(seed * 5) * 50 + 50)) % 101),
                        rico: Math.floor(((Math.tan(seed * 6) * 50 + 50)) % 101),
                        gostosa: Math.floor(((Math.sin(seed * 7) * 50 + 50)) % 101),
                        feio: Math.floor(((Math.cos(seed * 8) * 50 + 50)) % 101)
                    };
                    const pacoteValue = `R$ ${(Math.random() * 10000 + 1).toFixed(2).replace('.', ',')}`;
                    const hora = new Date().getHours();
                    let humors = ['😎 Tranquilão', '🔥 No fogo', '😴 Sonolento', '🤓 Nerd mode', '😜 Loucura total', '🧘 Zen'];
                    if (hora < 6) {
                        humors = ['🌙 Vampirão', '🦉 Corujão', '👻 Assombrado', '🌃 Notívago', '🧛 Drácula'];
                    }
                    else if (hora < 12) {
                        humors = ['☀️ Radiante', '🌅 Matinal', '💪 Disposto', '🥱 Sonolento', '🍳 Café da manhã'];
                    }
                    else if (hora < 18) {
                        humors = ['😎 Tranquilão', '💼 Produtivo', '🍃 Relax', '🤔 Pensativo', '🎯 Focado'];
                    }
                    else {
                        humors = ['🌆 Nostálgico', '🍻 Festivo', '📺 Preguiçoso', '🎮 Gamer', '🍿 Cinéfilo'];
                    }
                    const randomHumor = humors[Math.floor(Math.random() * humors.length)];
                    let profilePic = 'https://raw.githubusercontent.com/nazuninha/uploads/main/outros/1747053564257_bzswae.bin';
                    try {
                        profilePic = await nazu.profilePictureUrl(target, 'image');
                    }
                    catch (error) {
                        console.warn(`Falha ao obter foto do perfil de ${targetName}:`, error.message);
                    }
                    let bio = 'Sem bio disponível';
                    let bioSetAt = '';
                    try {
                        const statusData = await nazu.fetchStatus(target);
                        const status = statusData?.[0]?.status;
                        if (status) {
                            bio = status.status || bio;
                            bioSetAt = new Date(status.setAt).toLocaleString('pt-BR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                                timeZone: 'America/Sao_Paulo'
                            });
                        }
                    }
                    catch (error) {
                        console.warn(`Falha ao obter status/bio de ${targetName}:`, error.message);
                    }
                    const createProgressBar = (percent, size = 10) => {
                        const filled = Math.min(size, Math.max(0, Math.round((percent / 100) * size)));
                        return '▰'.repeat(filled) + '▱'.repeat(size - filled);
                    };
                    const getEmoji = (value, type) => {
                        if (type === 'puta') {
                            if (value >= 80)
                                return '🔥🔥';
                            if (value >= 50)
                                return '🔥';
                            if (value >= 20)
                                return '💨';
                            return '😇';
                        }
                        if (type === 'gado') {
                            if (value >= 80)
                                return '🐂🐂';
                            if (value >= 50)
                                return '🐂';
                            if (value >= 20)
                                return '🐄';
                            return '🐑';
                        }
                        if (type === 'corno') {
                            if (value >= 80)
                                return '🦌🦌';
                            if (value >= 50)
                                return '🦌';
                            if (value >= 20)
                                return '🎄';
                            return '🌿';
                        }
                        if (type === 'sortudo') {
                            if (value >= 80)
                                return '🍀';
                            if (value >= 50)
                                return '🍀';
                            if (value >= 20)
                                return '🎲';
                            return '🎰';
                        }
                        if (type === 'carisma') {
                            if (value >= 80)
                                return '✨✨';
                            if (value >= 50)
                                return '✨';
                            if (value >= 20)
                                return '⭐';
                            return '🌟';
                        }
                        if (type === 'rico') {
                            if (value >= 80)
                                return '💰💰';
                            if (value >= 50)
                                return '💰';
                            if (value >= 20)
                                return '💸';
                            return '💵';
                        }
                        if (type === 'gostosa') {
                            if (value >= 80)
                                return '🥵🥵';
                            if (value >= 50)
                                return '🥵';
                            if (value >= 20)
                                return '😏';
                            return '👀';
                        }
                        if (type === 'feio') {
                            if (value >= 80)
                                return '👹👹';
                            if (value >= 50)
                                return '👹';
                            if (value >= 20)
                                return '👺';
                            return '👽';
                        }
                        return '▪️';
                    };
                    const rotulo = (txt) => `${txt}${'\u00a0'.repeat(Math.max(0, 8 - txt.length))}`;
                    const perfilText = `📋 *PERFIL COMPLETO*
      ${targetName}
      
      👤 *Nome*: ${mentionedUser ? targetName : (pushname || targetName)}
      📱 *Número*: ${targetId}
      📜 *Bio*: ${bio}${bioSetAt ? `\n🕒 *Bio atualizada em*: ${bioSetAt}` : ''}
      
      💰 *Valor do Pacote*: ${pacoteValue} 🫦
      😊 *Humor*: ${randomHumor}
      
      ━━━━━━━━━━━━━━━━━━
      🎭 *Níveis*:
      ${rotulo('Puta')} ${createProgressBar(levels.puta)} ${String(levels.puta).padStart(3)}% ${getEmoji(levels.puta, 'puta')}
      ${rotulo('Gado')} ${createProgressBar(levels.gado)} ${String(levels.gado).padStart(3)}% ${getEmoji(levels.gado, 'gado')}
      ${rotulo('Corno')} ${createProgressBar(levels.corno)} ${String(levels.corno).padStart(3)}% ${getEmoji(levels.corno, 'corno')}
      ${rotulo('Sorte')} ${createProgressBar(levels.sortudo)} ${String(levels.sortudo).padStart(3)}% ${getEmoji(levels.sortudo, 'sortudo')}
      ${rotulo('Carisma')} ${createProgressBar(levels.carisma)} ${String(levels.carisma).padStart(3)}% ${getEmoji(levels.carisma, 'carisma')}
      ${rotulo('Rico')} ${createProgressBar(levels.rico)} ${String(levels.rico).padStart(3)}% ${getEmoji(levels.rico, 'rico')}
      ${rotulo('Gostosa')} ${createProgressBar(levels.gostosa)} ${String(levels.gostosa).padStart(3)}% ${getEmoji(levels.gostosa, 'gostosa')}
      ${rotulo('Feio')} ${createProgressBar(levels.feio)} ${String(levels.feio).padStart(3)}% ${getEmoji(levels.feio, 'feio')}`.trim();
                    // O cartão gerado trocava o rosto da pessoa por um bloco com as iniciais.
                    // Aqui a foto de perfil é o conteúdo, não a moldura: do alvo quando há
                    // menção ou citação, de quem chamou quando não há.
                    await nazu.sendMessage(from, {
                        image: { url: profilePic },
                        caption: perfilText,
                        mentions: [target]
                    }, { quoted: info });
                }
                catch (error) {
                    console.error('Erro ao processar comando perfil:', error);
                    await reply('Ocorreu um erro ao gerar o perfil 💔');
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_500_afk(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { fs, groupData, groupFile, isGroup, q, reply, sender } = scope;
    try {
        switch (command) {
            case 'afk':
                try {
                    if (!isGroup)
                        return reply("Este comando só funciona em grupos.");
                    const reason = q.trim();
                    groupData.afkUsers = groupData.afkUsers || {};
                    groupData.afkUsers[sender] = {
                        reason: reason || 'Não especificado',
                        since: Date.now()
                    };
                    fs.writeFileSync(groupFile, JSON.stringify(groupData, null, 2));
                    let afkSetMessage = `😴 Você está AFK.`;
                    if (reason) {
                        afkSetMessage += `
      Motivo: ${reason}`;
                    }
                    await reply(afkSetMessage);
                }
                catch (e) {
                    console.error('Erro no comando afk:', e);
                    await reply("Ocorreu um erro ao definir AFK 💔");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_501_voltei(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { fs, groupData, groupFile, isGroup, reply, sender } = scope;
    try {
        switch (command) {
            case 'voltei':
                try {
                    if (!isGroup)
                        return reply("Este comando só funciona em grupos.");
                    if (groupData.afkUsers && groupData.afkUsers[sender]) {
                        delete groupData.afkUsers[sender];
                        fs.writeFileSync(groupFile, JSON.stringify(groupData, null, 2));
                        await reply(`👋 Bem-vindo(a) de volta! Seu status AFK foi removido.`);
                    }
                    else {
                        await reply("Você não estava AFK.");
                    }
                }
                catch (e) {
                    console.error('Erro no comando voltei:', e);
                    await reply("Ocorreu um erro ao remover AFK 💔");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
async function member_502_regras(scope) {
    const command = String(scope.command || "").trim().toLowerCase();
    let { groupData, groupName, isGroup, reply } = scope;
    try {
        switch (command) {
            case 'regras':
                try {
                    if (!isGroup)
                        return reply("Este comando só funciona em grupos.");
                    if (!groupData.rules || groupData.rules.length === 0) {
                        return reply("📜 Nenhuma regra definida para este grupo ainda.");
                    }
                    let rulesMessage = `📜 *Regras do Grupo ${groupName}* 📜
      
      `;
                    groupData.rules.forEach((rule, index) => {
                        rulesMessage += `${index + 1}. ${rule}
      `;
                    });
                    await reply(rulesMessage);
                }
                catch (e) {
                    console.error('Erro no comando regras:', e);
                    await reply("Ocorreu um erro ao buscar as regras 💔");
                }
                break;
        }
        return undefined;
    }
    finally {
        // Nenhum binding externo mutável nesta família.
    }
}
const HANDLERS = new Map([
    ["achievements", member_016_conquistas],
    ["afk", member_500_afk],
    ["apostar", member_014_perfilrpg],
    ["assaltar", member_014_perfilrpg],
    ["atividade", member_310_atividade],
    ["banco", member_014_perfilrpg],
    ["bet", member_014_perfilrpg],
    ["bot-zip", member_217_zipbot],
    ["botinfo", member_314_statusbot],
    ["botzip", member_217_zipbot],
    ["box", member_440_caixa],
    ["buy", member_014_perfilrpg],
    ["cacaniquel", member_074_slots],
    ["cacar", member_014_perfilrpg],
    ["caçar", member_014_perfilrpg],
    ["caixa", member_440_caixa],
    ["cancelar", member_014_perfilrpg],
    ["carteira", member_014_perfilrpg],
    ["checkativo", member_309_checkativo],
    ["cmerc", member_014_perfilrpg],
    ["coletar", member_014_perfilrpg],
    ["coletarpropriedades", member_014_perfilrpg],
    ["colher", member_014_perfilrpg],
    ["comandosmaisusados", member_316_topcmd],
    ["comer", member_014_perfilrpg],
    ["comprar", member_014_perfilrpg],
    ["comprarmercado", member_014_perfilrpg],
    ["comprarpropriedade", member_014_perfilrpg],
    ["conquistas", member_016_conquistas],
    ["cook", member_014_perfilrpg],
    ["cozinhar", member_014_perfilrpg],
    ["cprop", member_014_perfilrpg],
    ["cprops", member_014_perfilrpg],
    ["crime", member_014_perfilrpg],
    ["cultivar", member_014_perfilrpg],
    ["dadosgp", member_318_statusgp],
    ["daily", member_014_perfilrpg],
    ["demitir", member_014_perfilrpg],
    ["denunciar", member_445_denunciar],
    ["denuncias", member_446_denuncias],
    ["dep", member_014_perfilrpg],
    ["depositar", member_014_perfilrpg],
    ["desafio", member_014_perfilrpg],
    ["desafiomensal", member_014_perfilrpg],
    ["desafiosemanal", member_014_perfilrpg],
    ["diario", member_014_perfilrpg],
    ["download-bot", member_217_zipbot],
    ["downloadbot", member_217_zipbot],
    ["eat", member_014_perfilrpg],
    ["emprego", member_014_perfilrpg],
    ["explorar", member_014_perfilrpg],
    ["explore", member_014_perfilrpg],
    ["farm", member_014_perfilrpg],
    ["fish", member_014_perfilrpg],
    ["forge", member_014_perfilrpg],
    ["forjar", member_014_perfilrpg],
    ["gift", member_082_presente],
    ["git-bot", member_218_gitbot],
    ["git-hub", member_218_gitbot],
    ["gitbot", member_218_gitbot],
    ["github", member_218_gitbot],
    ["habilidades", member_014_perfilrpg],
    ["harvest", member_014_perfilrpg],
    ["horta", member_014_perfilrpg],
    ["hunt", member_014_perfilrpg],
    ["infobot", member_314_statusbot],
    ["ingredientes", member_014_perfilrpg],
    ["inv", member_014_perfilrpg],
    ["inventario", member_014_perfilrpg],
    ["inventory", member_442_inventario],
    ["levels", member_014_perfilrpg],
    ["listar", member_014_perfilrpg],
    ["listaroles", member_001_roles],
    ["loja", member_014_perfilrpg],
    ["lojarps", member_014_perfilrpg],
    ["materiais", member_014_perfilrpg],
    ["medalhas", member_016_conquistas],
    ["mention", member_343_mention],
    ["mercado", member_014_perfilrpg],
    ["meusan", member_014_perfilrpg],
    ["meusanuncios", member_014_perfilrpg],
    ["meustatus", member_312_meustatus],
    ["mine", member_014_perfilrpg],
    ["minerar", member_014_perfilrpg],
    ["perfil", member_479_perfil],
    ["perfilrpg", member_014_perfilrpg],
    ["pescar", member_014_perfilrpg],
    ["ping", member_324_ping],
    ["pix", member_014_perfilrpg],
    ["plant", member_014_perfilrpg],
    ["plantacao", member_014_perfilrpg],
    ["plantação", member_014_perfilrpg],
    ["plantar", member_014_perfilrpg],
    ["precos", member_014_perfilrpg],
    ["preços", member_014_perfilrpg],
    ["presente", member_082_presente],
    ["propriedades", member_014_perfilrpg],
    ["rankativo", member_307_rankativos],
    ["rankativos", member_307_rankativos],
    ["rankinativo", member_308_rankinativos],
    ["rankinativos", member_308_rankinativos],
    ["rankinglevel", member_014_perfilrpg],
    ["ranklevel", member_014_perfilrpg],
    ["ranklvl", member_014_perfilrpg],
    ["rankrep", member_444_toprep],
    ["receitas", member_014_perfilrpg],
    ["regras", member_502_regras],
    ["rep", member_059_reputacao],
    ["reparar", member_014_perfilrpg],
    ["repo", member_218_gitbot],
    ["report", member_445_denunciar],
    ["reports", member_446_denuncias],
    ["repositorio", member_218_gitbot],
    ["reputacao", member_059_reputacao],
    ["reputation", member_059_reputacao],
    ["resetrpg", member_014_perfilrpg],
    ["role", member_007_role],
    ["role.confirmados", member_007_role],
    ["role.info", member_007_role],
    ["role.lista", member_001_roles],
    ["role.nvou", member_006_role_nvou],
    ["role.participantes", member_007_role],
    ["role.vou", member_005_role_vou],
    ["roles", member_001_roles],
    ["roubar", member_014_perfilrpg],
    ["sacar", member_014_perfilrpg],
    ["saque", member_014_perfilrpg],
    ["sell", member_086_vender],
    ["sementes", member_014_perfilrpg],
    ["slotmachine", member_074_slots],
    ["slots", member_014_perfilrpg],
    ["source", member_218_gitbot],
    ["source-code", member_218_gitbot],
    ["sourcecode", member_218_gitbot],
    ["statusbot", member_314_statusbot],
    ["statusgp", member_318_statusgp],
    ["topcmd", member_316_topcmd],
    ["topcmds", member_316_topcmd],
    ["toplevels", member_014_perfilrpg],
    ["toprep", member_444_toprep],
    ["toprpg", member_014_perfilrpg],
    ["totalcmd", member_311_totalcmd],
    ["totalcomando", member_311_totalcmd],
    ["trabalhar", member_014_perfilrpg],
    ["transferir", member_014_perfilrpg],
    ["vagas", member_014_perfilrpg],
    ["vender", member_014_perfilrpg],
    ["vendercomida", member_014_perfilrpg],
    ["voltei", member_501_voltei],
    ["work", member_014_perfilrpg],
    ["zip-bot", member_217_zipbot],
    ["zipbot", member_217_zipbot],
]);
export const MEMBERS_GENERATED_COMMAND_TOKENS = Object.freeze([...HANDLERS.keys()]);
export class MembersGeneratedDomainDispatchTarget {
    async dispatch(command, context) {
        const normalized = String(command || '').trim().toLowerCase();
        const handler = HANDLERS.get(normalized);
        if (!handler)
            return false;
        context.membersScope.command = normalized;
        await handler(context.membersScope);
        return true;
    }
}
//# sourceMappingURL=generated-domain.js.map