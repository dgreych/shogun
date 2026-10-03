function userJid(value) {
    if (typeof value !== 'string')
        return '';
    const match = /^(\d+)(?::\d+)?@(s\.whatsapp\.net|lid)$/.exec(value.trim());
    if (match?.[2] === 's.whatsapp.net' && !/^\d{8,15}$/.test(match[1] || ''))
        return '';
    return match ? `${match[1]}@${match[2]}` : '';
}
function creatorJid(value) {
    if (typeof value !== 'string')
        return '';
    if (value.includes('@')) {
        const jid = userJid(value);
        return jid.endsWith('@s.whatsapp.net') ? jid : '';
    }
    if (!/^[+\d\s().-]+$/.test(value))
        return '';
    let digits = value.replace(/\D/g, '');
    // O cadastro local brasileiro aceita DDD + número. O ator exige JID do transporte.
    if (digits.length === 11 && !value.trim().startsWith('+'))
        digits = `55${digits}`;
    return /^\d{10,15}$/.test(digits) ? `${digits}@s.whatsapp.net` : '';
}
async function lookup(read, deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0)
        return null;
    let timer;
    try {
        return await Promise.race([
            Promise.resolve().then(read),
            new Promise(resolve => { timer = setTimeout(() => resolve(null), remaining); }),
        ]);
    }
    catch {
        return null;
    }
    finally {
        if (timer !== undefined)
            clearTimeout(timer);
    }
}
/** sender é o ator já resolvido pelo transporte, nunca nome, citação ou saída do modelo. */
export async function recognizeCreator(sender, configuredNumber, socket = null) {
    const actor = userJid(sender);
    const creator = creatorJid(configuredNumber);
    if (!actor || !creator)
        return false;
    if (actor.endsWith('@s.whatsapp.net'))
        return actor === creator;
    if (!socket)
        return false;
    // LID e PN têm namespaces diferentes: dígitos iguais não provam correspondência.
    const deadline = Date.now() + 2500;
    const mapping = socket.signalRepository?.lidMapping;
    if (mapping?.getPNForLID) {
        const pn = userJid(await lookup(() => mapping.getPNForLID(actor), deadline));
        if (pn.endsWith('@s.whatsapp.net'))
            return pn === creator;
    }
    if (mapping?.getLIDForPN) {
        const lid = userJid(await lookup(() => mapping.getLIDForPN(creator), deadline));
        if (lid.endsWith('@lid'))
            return lid === actor;
    }
    if (!socket.onWhatsApp)
        return false;
    const response = await lookup(() => socket.onWhatsApp(creator), deadline);
    if (!Array.isArray(response))
        return false;
    return response.some((entry) => {
        if (!entry || typeof entry !== 'object')
            return false;
        const record = entry;
        return record.exists === true && userJid(record.jid) === creator && userJid(record.lid) === actor;
    });
}
//# sourceMappingURL=creator-identity.js.map