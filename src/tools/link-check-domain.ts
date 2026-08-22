import { URL } from 'node:url';

import axios from 'axios';
import type { AxiosRequestConfig } from 'axios';

import type { MacrotrancheExecutionContext } from '../macrotranche/domain.js';
import type { VNextCommandDispatchTarget } from '../runtime/compatibility-dispatch.js';

type HttpResponse = {
  readonly status: number;
  readonly data?: {
    readonly category?: string;
    readonly created?: string | number | Date;
  };
};

type HttpGet = (url: string, options?: AxiosRequestConfig) => Promise<HttpResponse>;

type HttpLikeError = {
  readonly code?: string;
  readonly message?: string;
};

function extractDomain(raw: string): string {
  let domain = raw;
  try {
    if (raw.includes('://')) {
      domain = new URL(raw).hostname;
    } else if (raw.includes('/')) {
      domain = raw.split('/')[0] ?? raw;
    }
  } catch {
    domain = raw.replace(/^(https?:\/\/)?/u, '').split('/')[0] ?? raw;
  }
  return domain;
}

export class LinkCheckToolsDomainDispatchTarget
implements VNextCommandDispatchTarget<MacrotrancheExecutionContext> {
  constructor(private readonly httpGet: HttpGet = (url, options) => axios.get(url, options)) {}

  async dispatch(command: string, context: MacrotrancheExecutionContext): Promise<boolean> {
    const normalized = String(command || '').trim().toLowerCase();
    if (!LINK_CHECK_TOOLS_NATIVE_COMMAND_TOKENS.includes(normalized)) return false;
    await this.verifyLink(normalized, context);
    return true;
  }

  private async verifyLink(command: string, context: MacrotrancheExecutionContext): Promise<void> {
    try {
      const query = context.query.trim();
      if (!query) {
        await context.reply(`🔒 *Verificador de Links*\n\n❌ Por favor, envie um link ou domínio para verificar.\n\n📝 *Uso:* ${context.prefix}${command} <link>\n\n📌 *Exemplos:*\n${context.prefix}${command} google.com\n${context.prefix}${command} https://exemplo.com/pagina`);
        return;
      }

      const domain = extractDomain(query);
      await context.reply('🔍 Verificando segurança do link...');

      const response = await this.httpGet(
        `https://api.fishfish.gg/v1/domains/${encodeURIComponent(domain)}`,
        {
          timeout: 120000,
          validateStatus: (status: number) => status < 500,
        },
      );

      if (response.status === 404) {
        await context.reply(`✅ *Resultado da Verificação*\n\n🔗 *Link:* ${query}\n🌐 *Domínio:* ${domain}\n\n📊 *Status:* Não encontrado na base de ameaças\n\n💚 *Análise:* Este domínio não está listado como malicioso na base de dados FishFish. Isso geralmente indica que é seguro, mas sempre tenha cuidado ao acessar links desconhecidos!\n\n⚠️ *Dica:* Mesmo links "seguros" podem ter conteúdo prejudicial. Navegue com cautela!`);
        return;
      }

      if (response.status === 200) {
        const category = response.data?.category || 'unknown';
        const createdAt = response.data?.created
          ? new Date(response.data.created).toLocaleDateString('pt-BR')
          : 'N/A';

        let statusEmoji = '⚠️';
        let statusText = 'Suspeito';
        let riskLevel = 'Médio';
        if (category === 'phishing') {
          statusEmoji = '🚨';
          statusText = 'PHISHING DETECTADO';
          riskLevel = 'CRÍTICO';
        } else if (category === 'malware') {
          statusEmoji = '☠️';
          statusText = 'MALWARE DETECTADO';
          riskLevel = 'CRÍTICO';
        } else if (category === 'safe') {
          statusEmoji = '✅';
          statusText = 'Seguro';
          riskLevel = 'Baixo';
        }

        const warning = category === 'phishing' || category === 'malware'
          ? '\n\n🚫 *NÃO ACESSE ESTE LINK!*\nEste domínio foi identificado como perigoso e pode roubar seus dados ou infectar seu dispositivo!'
          : '';

        await context.reply(`${statusEmoji} *Resultado da Verificação*\n\n🔗 *Link:* ${query}\n🌐 *Domínio:* ${domain}\n\n📊 *Status:* ${statusText}\n🏷️ *Categoria:* ${category}\n⚡ *Nível de Risco:* ${riskLevel}\n📅 *Registrado em:* ${createdAt}${warning}\n\n🔒 *Verificado por:* FishFish Security API`);
        return;
      }

      await context.reply('❌ Erro ao verificar o link. Tente novamente mais tarde.');
    } catch (error) {
      console.error('Erro no comando verificar:', error);
      const candidate = error as HttpLikeError;
      if (candidate.code === 'ECONNABORTED' || candidate.message?.includes('timeout')) {
        await context.reply('⏰ Tempo esgotado! O servidor de verificação está demorando para responder.');
        return;
      }
      await context.reply('❌ Ocorreu um erro ao verificar o link. Tente novamente.');
    }
  }
}

export const LINK_CHECK_TOOLS_NATIVE_COMMAND_TOKENS = Object.freeze([
  'verificar', 'checklink', 'scanlink', 'urlscan',
]);
