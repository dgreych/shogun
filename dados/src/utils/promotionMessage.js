export const FIRST_PROMOTION = `🐈‍⬛ *SHOGUN · NOVA GERAÇÃO*

Esta atualização abre uma nova fase do Shogun: identidade visual renovada, artes próprias nos menus e uma personalidade que é só dele. Os comandos também receberam melhorias para o dia a dia do grupo.

Entre no novo site, conheça essa versão e veja como ter o Shogun no seu grupo:
🌐 https://dgreych.github.io/DOMO-BJI/shogun/

*Instalar e rodar seu próprio Shogun continua sendo grátis.*
💻 Código e tutoriais: https://github.com/dgreych/shogun

Para receber o bot pronto e hospedado, ou conhecer a API BunnyFy, fale com a Domo:
📲 https://wa.me/5522997028553`;

export function promotionalPayload(text, metadata) {
  if (!Array.isArray(metadata?.participants)) throw new Error('Não foi possível consultar os participantes do grupo.');
  const mentions = [...new Set(metadata.participants.map(member => member.id).filter(id => typeof id === 'string' && /^\d+(?::\d+)?@(?:s\.whatsapp\.net|lid)$/.test(id)))];
  if (!mentions.length) throw new Error('O grupo não retornou participantes para a marcação.');
  return { text, mentions };
}

async function deadline(action, milliseconds, code) {
  let timer;
  try {
    return await Promise.race([action(), new Promise((resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error('O grupo não confirmou a operação dentro do prazo.');
        error.code = code;
        reject(error);
      }, milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}

export async function sendPromotionalMessage(socket, group, text) {
  const metadata = await deadline(() => socket.groupMetadata(group), 15_000, 'PROMO_METADATA_TIMEOUT');
  const payload = promotionalPayload(text, metadata);
  return deadline(() => socket.sendMessage(group, payload), 30_000, 'PROMO_UNCERTAIN');
}
