import { adminAccess, type AdminCommandAccess, type AdminExecutionContext } from './contracts.js';
import type { GroupStateRecord } from './state.js';

export interface BooleanAdminSettingDescriptor {
  readonly id: string;
  readonly tokens: readonly string[];
  readonly key: string;
  readonly access: AdminCommandAccess;
  readonly success: (
    enabled: boolean,
    context: AdminExecutionContext,
    state: GroupStateRecord,
  ) => string;
  readonly errorMessage?: string;
}

function toggle(
  input: BooleanAdminSettingDescriptor,
): BooleanAdminSettingDescriptor {
  return Object.freeze({
    ...input,
    tokens: Object.freeze([...input.tokens]),
  });
}

const commonError = 'Ocorreu um erro 💔';

export const ADMIN_BOOLEAN_SETTINGS = Object.freeze([
  toggle({
    id: 'modorpg',
    tokens: ['modorpg', 'rpgmode'],
    key: 'modorpg',
    access: adminAccess(),
    success(enabled) {
      return `⚔️ Modo RPG ${enabled ? 'ATIVADO' : 'DESATIVADO'} neste grupo.\n\n${enabled ? '🎮 Agora os membros podem usar todos os comandos RPG!' : '🔒 Comandos RPG desativados.'}`;
    },
  }),
  toggle({
    id: 'mantercontador',
    tokens: ['mantercontador', 'preservarcontador'],
    key: 'preservarContador',
    access: adminAccess(),
    success(enabled) {
      const emoji = enabled ? '🔒' : '🔓';
      const status = enabled ? 'ATIVADA' : 'DESATIVADA';
      return `${emoji} *Preservação do contador ${status}!*\n\n${enabled ? '🔒 O bot não removerá mais do contador quem sair do grupo.\n📊 Os dados dos membros que saírem serão mantidos no rank de atividade.' : '🔓 O bot voltará a remover do contador quem sair do grupo.\n🧹 Use o comando *limparrank* para limpar usuários ausentes manualmente.'}`;
    },
    errorMessage: '❌ Ocorreu um erro ao configurar a preservação do contador. Tente novamente mais tarde.',
  }),
  toggle({
    id: 'captchasolic',
    tokens: ['captchasolic', 'captcha', 'captcharequests'],
    key: 'captchaEnabled',
    access: adminAccess(),
    success(enabled, context, state) {
      const emoji = enabled ? '🔐' : '❌';
      const status = enabled ? 'ativado' : 'desativado';
      let message = `${emoji} *Captcha para Solicitações ${status}!*\n\n`;
      if (enabled) {
        message += '🔒 Quando alguém solicitar entrar no grupo:\n';
        message += '1️⃣ Receberá uma conta matemática no PV\n';
        message += '2️⃣ Terá 5 minutos para responder\n';
        message += '3️⃣ Se acertar, será aprovado\n';
        message += '4️⃣ Se errar ou não responder, será recusado\n\n';
        message += state.autoAcceptRequests === true
          ? '✅ Auto-aceitar já está ativo! O captcha será usado automaticamente.'
          : `⚠️ *Atenção:* Para o captcha funcionar automaticamente, ative também:\n${context.prefix}autoaceitarsolic`;
      } else {
        message += `📝 Captcha desativado. ${state.autoAcceptRequests === true ? 'Solicitações serão aprovadas automaticamente sem verificação.' : 'Solicitações precisarão ser aprovadas manualmente.'}`;
      }
      return message;
    },
    errorMessage: '❌ Ocorreu um erro ao configurar captcha.',
  }),
  toggle({
    id: 'x9',
    tokens: ['x9'],
    key: 'x9',
    access: adminAccess(),
    success(enabled) {
      let message = `${enabled ? '🐀' : '🔇'} *Modo X9 ${enabled ? 'ativado' : 'desativado'}!*\n\n`;
      if (enabled) {
        message += '🐀 *O que o modo X9 faz?*\n';
        message += '• Reporta quando alguém é promovido a ADM\n';
        message += '• Reporta quando alguém é removido como ADM\n';
        message += '• Reporta quando alguém é removido do grupo\n';
        message += '• Reporta quando alguém entra no grupo\n';
        message += '• Reporta quando o grupo é atualizado\n\n';
        message += '📢 *Os reports serão enviados no grupo com menções!*\n';
        message += '⚠️ *Use com responsabilidade* ⚠️';
      } else {
        message += '🔇 Modo X9 desativado.\nNenhuma ação administrativa será reportada no grupo.';
      }
      return message;
    },
    errorMessage: '❌ Ocorreu um erro ao configurar o modo X9.',
  }),
  toggle({
    id: 'antilinkhard',
    tokens: ['antilinkhard'],
    key: 'antilinkhard',
    access: adminAccess({ botAdmin: true }),
    success: (enabled) => `✅ Antilinkhard ${enabled ? 'ativado' : 'desativado'}! Qualquer link enviado resultará em banimento.`,
    errorMessage: commonError,
  }),
  toggle({
    id: 'antibotao',
    tokens: ['antibotao', 'antibtn'],
    key: 'antibtn',
    access: adminAccess({ botAdmin: true }),
    success: (enabled) => `✅ Anti Botão ${enabled ? 'ativado' : 'desativado'}!`,
    errorMessage: commonError,
  }),
  toggle({
    id: 'antistatus',
    tokens: ['antistatus'],
    key: 'antistatus',
    access: adminAccess({ botAdmin: true }),
    success: (enabled) => `✅ Anti Status ${enabled ? 'ativado' : 'desativado'}!`,
    errorMessage: commonError,
  }),
  toggle({
    id: 'autodl',
    tokens: ['autodl', 'autodown'],
    key: 'autodl',
    access: adminAccess(),
    success(enabled) {
      if (!enabled) return '❌ *AutoDL Desativado*\n\n⏸️ Links não serão mais baixados automaticamente.';
      return '✅ *AutoDL Ativado!*\n\n📥 Links das seguintes plataformas serão baixados automaticamente:\n\n🎥 YouTube\n📱 TikTok\n📸 Instagram\n📘 Facebook\n📌 Pinterest\n🎵 Spotify\n🔊 SoundCloud\n\n💡 Basta enviar o link que eu baixo para você!';
    },
    errorMessage: commonError,
  }),
  toggle({
    id: 'antidoc',
    tokens: ['antidoc'],
    key: 'antidoc',
    access: adminAccess({ botAdmin: true }),
    success: (enabled) => `✅ Antidoc ${enabled ? 'ativado' : 'desativado'}! Documentos enviados resultarão em banimento.`,
    errorMessage: commonError,
  }),
  toggle({
    id: 'antiloc',
    tokens: ['antiloc'],
    key: 'antiloc',
    access: adminAccess({ botAdmin: true }),
    success: (enabled) => `✅ Antiloc ${enabled ? 'ativado' : 'desativado'}! Localizações enviadas resultarão em banimento.`,
    errorMessage: commonError,
  }),
  toggle({
    id: 'modobrincadeira',
    tokens: ['modobrincadeira', 'modobrincadeiras', 'modobn', 'gamemode'],
    key: 'modobrincadeira',
    access: adminAccess(),
    success: (enabled) => enabled
      ? '🎉 *Modo de Brincadeiras ativado!* Agora o grupo está no modo de brincadeiras. Divirta-se!'
      : '⚠️ *Modo de Brincadeiras desativado!* O grupo não está mais no modo de brincadeiras.',
    errorMessage: '❌ Ocorreu um erro interno. Tente novamente em alguns minutos.',
  }),
  toggle({
    id: 'bemvindo',
    tokens: ['bemvindo', 'bv', 'boasvindas', 'welcome'],
    key: 'bemvindo',
    access: adminAccess(),
    success: (enabled, context) => enabled
      ? `✅ *Boas-vindas ativadas!* Agora, novos membros serão recebidos com uma mensagem personalizada.\n📝 Para configurar a mensagem, use: *${context.groupPrefix}legendabv*`
      : '⚠️ *Boas-vindas desativadas!* O grupo não enviará mais mensagens para novos membros.',
    errorMessage: '❌ Ocorreu um erro interno. Tente novamente em alguns minutos.',
  }),
  toggle({
    id: 'soadm',
    tokens: ['soadm', 'onlyadm', 'soadmin'],
    key: 'soadm',
    access: adminAccess(),
    success: (enabled) => enabled
      ? '✅ *Modo apenas adm ativado!* Agora apenas administrdores do grupo poderam utilizar o bot*'
      : '⚠️ *Modo apenas adm desativado!* Agora todos os membros podem utilizar o bot novamente.',
    errorMessage: 'ocorreu um erro 💔',
  }),
  toggle({
    id: 'modolite',
    tokens: ['modolite', 'litemode'],
    key: 'modolite',
    access: adminAccess(),
    success: (enabled) => enabled
      ? '👶 *Modo Lite ativado!* O conteúdo inapropriado para crianças será filtrado neste grupo.'
      : '🔞 *Modo Lite desativado!* O conteúdo do menu de brincadeiras será exibido completamente.',
    errorMessage: commonError,
  }),
  toggle({
    id: 'antilinkgp',
    tokens: ['antilinkgp'],
    key: 'antilinkgp',
    access: adminAccess({ botAdmin: true }),
    success: (enabled) => enabled
      ? '✅ *Antilinkgp foi ativado com sucesso!*\n\nAgora, se alguém enviar links de outros grupos, será banido automaticamente. Mantenha o grupo seguro! 🛡️'
      : '✅ *Antilinkgp foi desativado.*\n\nLinks de outros grupos não serão mais bloqueados. Use com cuidado! ⚠️',
    errorMessage: 'ocorreu um erro 💔',
  }),
  toggle({
    id: 'antilinkcanal',
    tokens: ['antilinkcanal', 'antilinkch'],
    key: 'antilinkcanal',
    access: adminAccess({ botAdmin: true }),
    success: (enabled) => enabled
      ? '✅ *Antilinkcanal foi ativado com sucesso!*\n\nAgora, se alguém enviar links de canais do WhatsApp, será banido automaticamente. Mantenha o grupo seguro! 🛡️'
      : '✅ *Antilinkcanal foi desativado.*\n\nLinks de canais não serão mais bloqueados. Use com cuidado! ⚠️',
    errorMessage: 'ocorreu um erro 💔',
  }),
  toggle({
    id: 'antilinksoft',
    tokens: ['antilinksoft'],
    key: 'antilinksoft',
    access: adminAccess(),
    success: (enabled) => enabled
      ? '✅ *Antilinksoft foi ativado com sucesso!*\n\nAgora, se alguém enviar links, a mensagem será apagada automaticamente (sem banir o usuário).'
      : '✅ *Antilinksoft foi desativado.*\n\nLinks não serão mais bloqueados.',
    errorMessage: 'ocorreu um erro 💔',
  }),
  toggle({
    id: 'antiporn',
    tokens: ['antiporn'],
    key: 'antiporn',
    access: adminAccess({ botAdmin: true }),
    success: (enabled) => enabled
      ? '✅ *Antiporn foi ativado com sucesso!*\n\nAgora, se alguém enviar conteúdo adulto (NSFW), será banido automaticamente. Mantenha o grupo seguro e adequado! 🛡️'
      : '✅ *Antiporn foi desativado.*\n\nConteúdo adulto não será mais bloqueado. Use com responsabilidade! ⚠️',
    errorMessage: 'ocorreu um erro 💔',
  }),
  toggle({
    id: 'autosticker',
    tokens: ['autosticker'],
    key: 'autoSticker',
    access: adminAccess(),
    success: (enabled) => `✅ Auto figurinhas ${enabled ? 'ativadas' : 'desativadas'}! ${enabled ? 'Todas as imagens e vídeos serão convertidos em figurinhas.' : ''}`,
    errorMessage: commonError,
  }),
  toggle({
    id: 'autorepo',
    tokens: ['autorepo', 'autoresposta'],
    key: 'autorepo',
    access: adminAccess(),
    success: (enabled) => `✅ Auto resposta ${enabled ? 'ativada' : 'desativada'}!`,
    errorMessage: commonError,
  }),
] satisfies readonly BooleanAdminSettingDescriptor[]);

export const ADMIN_BOOLEAN_SETTING_TOKENS = Object.freeze(
  ADMIN_BOOLEAN_SETTINGS.flatMap((item) => item.tokens),
);

const byToken = new Map<string, BooleanAdminSettingDescriptor>();
for (const item of ADMIN_BOOLEAN_SETTINGS) {
  for (const token of item.tokens) {
    if (byToken.has(token)) throw new Error(`Token administrativo duplicado: ${token}`);
    byToken.set(token, item);
  }
}

export function findBooleanAdminSetting(
  command: string,
): BooleanAdminSettingDescriptor | undefined {
  return byToken.get(String(command || '').trim().toLowerCase());
}
