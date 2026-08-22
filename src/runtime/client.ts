/**
 * Porta mínima para desacoplar handlers futuros do cliente WhatsApp concreto.
 * Nenhuma implementação é conectada em R0.
 */
export interface GyomeiClientPort {
  sendText(chatId: string, text: string): Promise<void>;
}
