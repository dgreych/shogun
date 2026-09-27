import { DEFAULT_NVIDIA_MODEL, NVIDIA_MODEL_CATALOG } from '../utils/nvidiaApi.js';
import { prepareMenuSections, renderShogunMenu } from './presentation.js';

export default async function menuShogun(prefix, _botName = 'SHOGUN', userName = 'Usuário', options = {}) {
    return renderShogunMenu({
        options,
        title: 'SHOGUN', prefix, userName,
        sections: prepareMenuSections([
            { title: 'CONVERSA & RECURSOS', entries: [
                { command: 'resumir', arguments: '[texto]' },
                { command: 'explicar', arguments: '[assunto]' },
                { command: 'corrigir', arguments: '[texto]' },
                { command: 'ideias', arguments: '[tema]' },
                { command: 'historia', arguments: '[tema]' },
                { command: 'recomendar', arguments: '[pedido]' },
                { command: 'resumirurl', arguments: '[link]' },
                { command: 'resumirchat' },
            ] },
            { title: 'CONFIGURAÇÃO DE MODELO', entries: [
                { command: 'modeloconversa', description: 'Consultar modelo ativo e opções.' },
                { command: 'modeloconversa', arguments: '<número ou id>', description: 'Selecionar modelo.' },
                { command: 'modeloshogun', arguments: '<número ou id>' },
            ], notes: NVIDIA_MODEL_CATALOG.map((entry, index) =>
                `${index + 1}. ${entry.label}${entry.id === DEFAULT_NVIDIA_MODEL ? ' · padrão' : ''} — ${entry.id}`),
            },
        ], options),
    });
}
