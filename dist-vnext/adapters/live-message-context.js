function asRecord(value) {
    return value && typeof value === 'object' ? value : undefined;
}
function asNonEmptyString(value) {
    return typeof value === 'string' ? value : '';
}
/**
 * Paridade da extração textual existente em dados/src/index.js.
 * A função é deliberadamente pura para que a borda Baileys possa ser testada
 * sem socket, banco ou filesystem.
 */
export function extractLegacyMessageText(info, reportInteractiveParseError) {
    const root = asRecord(info);
    const message = asRecord(root?.message) ?? {};
    const conversation = asNonEmptyString(message.conversation);
    if (conversation)
        return conversation;
    const extended = asRecord(message.extendedTextMessage);
    const extendedText = asNonEmptyString(extended?.text);
    if (extendedText)
        return extendedText;
    const image = asRecord(message.imageMessage);
    const imageCaption = asNonEmptyString(image?.caption);
    if (imageCaption)
        return imageCaption;
    const video = asRecord(message.videoMessage);
    const videoCaption = asNonEmptyString(video?.caption);
    if (videoCaption)
        return videoCaption;
    const document = asRecord(message.documentMessage);
    const documentCaption = asNonEmptyString(document?.caption);
    if (documentCaption)
        return documentCaption;
    const buttons = asRecord(message.buttonsResponseMessage);
    const buttonId = asNonEmptyString(buttons?.selectedButtonId);
    if (buttonId)
        return buttonId;
    const list = asRecord(message.listResponseMessage);
    const singleSelect = asRecord(list?.singleSelectReply);
    const rowId = asNonEmptyString(singleSelect?.selectedRowId);
    if (rowId)
        return rowId;
    const template = asRecord(message.templateButtonReplyMessage);
    const templateId = asNonEmptyString(template?.selectedId);
    if (templateId)
        return templateId;
    const interactive = asRecord(message.interactiveResponseMessage);
    if (interactive) {
        const nativeFlow = asRecord(interactive.nativeFlowResponseMessage);
        const paramsJson = asNonEmptyString(nativeFlow?.paramsJson);
        if (paramsJson) {
            try {
                const params = JSON.parse(paramsJson);
                return asNonEmptyString(asRecord(params)?.id);
            }
            catch (error) {
                reportInteractiveParseError?.(error);
            }
        }
    }
    return '';
}
function readIdentity(info) {
    const root = asRecord(info);
    const key = root?.key;
    const chatId = asNonEmptyString(key?.remoteJid);
    const isGroup = chatId.endsWith('@g.us');
    const participant = asNonEmptyString(key?.participant);
    const sender = isGroup ? participant : chatId;
    const pushName = asNonEmptyString(root?.pushName);
    return Object.freeze({ chatId, sender, isGroup, pushName });
}
/**
 * Converte a mensagem viva no contrato neutro do dispatcher vNext.
 * Estado legado continua atrás da porta injetada; nada aqui lê config.json,
 * database ou globals gerados pelo bootstrap diretamente.
 */
export async function resolveLiveCommandDispatchInput(seed, legacy, reportInteractiveParseError) {
    const identity = readIdentity(seed.message);
    const [prefix, rawAliases, isOwner, isLiteMode, botName] = await Promise.all([
        legacy.getPrefix(identity.chatId, identity.isGroup),
        legacy.getAliases(identity.chatId),
        legacy.isOwner(identity.sender),
        legacy.isLiteMode(identity.chatId, identity.isGroup),
        legacy.getBotName(),
    ]);
    return Object.freeze({
        socket: seed.socket,
        message: seed.message,
        mediaPath: seed.mediaPath ?? null,
        messagesCache: seed.messagesCache,
        rentalExpirationManager: seed.rentalExpirationManager,
        body: extractLegacyMessageText(seed.message, reportInteractiveParseError),
        rawAliases,
        prefix: String(prefix || ''),
        botName: String(botName || ''),
        pushName: identity.pushName,
        isOwner: Boolean(isOwner),
        isLiteMode: Boolean(isLiteMode),
        chatId: identity.chatId,
        sender: identity.sender,
        isGroup: identity.isGroup,
    });
}
//# sourceMappingURL=live-message-context.js.map