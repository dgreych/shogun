class NexoWhatsAppTransport {
  constructor({ socket, chatId, privateChatId = null, quoted = null }) {
    this.socket = socket;
    this.chatId = chatId;
    this.privateChatId = privateChatId;
    this.quoted = quoted;
  }

  /**
   * `preferPrivate` só é honrado quando há um `privateChatId` real (JID/
   * LID do próprio remetente) -- sem isso, cai no grupo por padrão. Nunca
   * manda DM espontânea: quem decide isso é o chamador, com base em
   * `player.privateOptIn` (seção 3.2 do PDF), nunca este transporte.
   */
  sendText(text, { mentions = [], preferPrivate = false } = {}) {
    const usePrivate = preferPrivate && this.privateChatId;
    const target = usePrivate ? this.privateChatId : this.chatId;
    const options = !usePrivate && this.quoted ? { quoted: this.quoted } : undefined;
    return this.socket.sendMessage(target, { text, mentions }, options);
  }

  sendImage(buffer, { caption = '', mentions = [], preferPrivate = false } = {}) {
    const usePrivate = preferPrivate && this.privateChatId;
    const target = usePrivate ? this.privateChatId : this.chatId;
    const options = !usePrivate && this.quoted ? { quoted: this.quoted } : undefined;
    return this.socket.sendMessage(target, { image: buffer, caption, mentions }, options);
  }
}

export { NexoWhatsAppTransport };
