import { DEFAULT_NVIDIA_MODEL, NVIDIA_MODEL_CATALOG } from '../utils/nvidiaApi.js';
import { prepareMenuSections, renderShogunMenu } from './presentation.js';

export default async function menuShogun(prefix, _botName = 'SHOGUN', userName = 'Usuário', options = {}) {
    return renderShogunMenu({
        intro: "IA para resumir, explicar, revisar e criar textos.",
        footer: "Envie o assunto ou texto após o comando; para resumir o chat, use #prefix#resumirchat.",
        options,
        title: 'IA DO SHOGUN', prefix, userName,
        sections: prepareMenuSections([
            { title: 'ESCRITA & CONSULTAS', icon: "💭", entries: [
                { command: 'resumir', arguments: '[texto]', description: "Resumir o texto informado." },
                { command: 'explicar', arguments: '[assunto]', description: "Explicar o assunto informado." },
                { command: 'corrigir', arguments: '[texto]', description: "Revisar ortografia e escrita do texto." },
                { command: 'ideias', arguments: '[tema]', description: "Sugerir ideias para o tema informado." },
                { command: 'historia', arguments: '[tema]', description: "Criar uma história a partir do tema." },
                { command: 'recomendar', arguments: '[pedido]', description: "Sugerir opções conforme o pedido." },
                { command: 'resumirurl', arguments: '[link]', description: "Resumir o conteúdo de um link." },
                { command: 'resumirchat', description: "Resumir mensagens recentes do chat." },
            ] },
            { title: 'CONFIGURAÇÃO DE MODELO', icon: "🪄", entries: [
                { command: 'modeloconversa', description: "Consultar o modelo ativo e os modelos disponíveis." },
                { command: 'modeloconversa', arguments: '<número ou id>', description: "Selecionar o modelo de conversa." },
                { command: 'modeloshogun', arguments: '<número ou id>', description: "Selecionar o modelo de conversa; alias de modeloconversa."},
            ], notes: NVIDIA_MODEL_CATALOG.map((entry, index) =>
                `${index + 1}. ${entry.label}${entry.id === DEFAULT_NVIDIA_MODEL ? ' · padrão' : ''} — ${entry.id}`),
            },
        ], options),
    });
}
