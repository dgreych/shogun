import { TAVERN_BOT_DISPLAY_NAME, TAVERN_BOT_PLAYER_ID } from '../domain/TavernBotPlayer.js';

class WhatsAppTavernTransport {
  constructor({ socket, chatId, quoted = null }) {
    this.socket = socket;
    this.chatId = chatId;
    this.quoted = quoted;
  }

  sendCurrentText(text, { mentions = [] } = {}) {
    return this.socket.sendMessage(
      this.chatId,
      { text, mentions },
      this.quoted ? { quoted: this.quoted } : undefined
    );
  }

  sendGroupText(text, { mentions = [] } = {}) {
    return this.sendCurrentText(text, { mentions });
  }

  sendGroupImage(buffer, { caption = '', mentions = [] } = {}) {
    return this.socket.sendMessage(
      this.chatId,
      { image: buffer, caption, mentions },
      this.quoted ? { quoted: this.quoted } : undefined
    );
  }

  // O oponente PvE não tem JID real — nada a entregar no privado para ele.
  // Centralizado aqui (em vez de checar em cada ponto de chamada do
  // controlador) porque é o único lugar por onde toda entrega privada
  // efetivamente passa.
  sendPrivateText(playerId, text) {
    if (playerId === TAVERN_BOT_PLAYER_ID) return Promise.resolve(null);
    return this.socket.sendMessage(playerId, { text });
  }

  sendPrivateImage(playerId, buffer, { caption = '' } = {}) {
    if (playerId === TAVERN_BOT_PLAYER_ID) return Promise.resolve(null);
    return this.socket.sendMessage(playerId, { image: buffer, caption });
  }

  async getDisplayName(playerId) {
    if (playerId === TAVERN_BOT_PLAYER_ID) return TAVERN_BOT_DISPLAY_NAME;
    try {
      const name = await this.socket.getName(playerId);
      return String(name || '').trim() || playerId.split('@')[0];
    } catch {
      return playerId.split('@')[0];
    }
  }
}

export { WhatsAppTavernTransport };
