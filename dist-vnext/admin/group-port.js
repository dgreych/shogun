function requireMethod(method, name) {
    if (typeof method !== 'function')
        throw new Error(`Socket não expõe ${name}.`);
    return method;
}
/** Adapter de transporte. Domínios administrativos não conhecem Baileys. */
export class BaileysAdminGroupPort {
    #socket;
    constructor(socket) {
        if (!socket || typeof socket !== 'object')
            throw new Error('Socket administrativo inválido.');
        this.#socket = socket;
    }
    metadata(groupId) {
        const method = requireMethod(this.#socket.groupMetadata, 'groupMetadata');
        return method.call(this.#socket, groupId);
    }
    inviteCode(groupId) {
        const method = requireMethod(this.#socket.groupInviteCode, 'groupInviteCode');
        return method.call(this.#socket, groupId);
    }
    async listJoinRequests(groupId) {
        if (typeof this.#socket.groupGetRequestParticipants === 'function') {
            return this.#socket.groupGetRequestParticipants.call(this.#socket, groupId);
        }
        if (typeof this.#socket.groupRequestParticipantsList === 'function') {
            return this.#socket.groupRequestParticipantsList.call(this.#socket, groupId);
        }
        const query = requireMethod(this.#socket.query, 'query');
        const result = await query.call(this.#socket, {
            tag: 'iq',
            attrs: { type: 'get', xmlns: 'w:g2', to: groupId },
            content: [{ tag: 'membership_approval_requests', attrs: {} }],
        });
        const node = result.content?.find((item) => item.tag === 'membership_approval_requests');
        return (node?.content ?? [])
            .filter((item) => item.tag === 'membership_approval_request' && typeof item.attrs?.jid === 'string')
            .map((item) => ({ jid: item.attrs?.jid ?? '' }))
            .filter((item) => item.jid.length > 0);
    }
    async updateJoinRequests(groupId, users, action) {
        const method = requireMethod(this.#socket.groupRequestParticipantsUpdate, 'groupRequestParticipantsUpdate');
        await method.call(this.#socket, groupId, users, action);
    }
    async setSubject(groupId, subject) {
        const method = requireMethod(this.#socket.groupUpdateSubject, 'groupUpdateSubject');
        await method.call(this.#socket, groupId, subject);
    }
    async setDescription(groupId, description) {
        const method = requireMethod(this.#socket.groupUpdateDescription, 'groupUpdateDescription');
        await method.call(this.#socket, groupId, description);
    }
    async setAnnouncement(groupId, onlyAdmins) {
        const method = requireMethod(this.#socket.groupSettingUpdate, 'groupSettingUpdate');
        await method.call(this.#socket, groupId, onlyAdmins ? 'announcement' : 'not_announcement');
    }
    async send(groupId, content, options) {
        const method = requireMethod(this.#socket.sendMessage, 'sendMessage');
        return method.call(this.#socket, groupId, content, options);
    }
}
//# sourceMappingURL=group-port.js.map