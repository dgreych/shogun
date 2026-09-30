import { DEFAULT_NVIDIA_MODEL, NVIDIA_MODEL_CATALOG } from '../utils/nvidiaApi.js';
import { prepareMenuSections, renderShogunMenu } from './presentation.js';

export default async function menuShogun(prefix, _botName = 'SHOGUN', userName = 'Usuário', options = {}) {
    return renderShogunMenu({
        intro: "Uma boa conversa pode abrir qualquer caminho.",
        footer: "Traga uma ideia, uma dúvida ou um texto. Vamos trabalhar nisso.",
        options,
        title: 'SHOGUN', prefix, userName,
        sections: prepareMenuSections([
            { title: 'CONVERSA & RECURSOS', icon: "💭", entries: [
                { command: 'resumir', arguments: '[texto]', description: "Fique com o essencial do texto." },
                { command: 'explicar', arguments: '[assunto]', description: "Vamos entender isso juntos." },
                { command: 'corrigir', arguments: '[texto]', description: "Revise a escrita do seu texto." },
                { command: 'ideias', arguments: '[tema]', description: "Encontre um caminho para começar." },
                { command: 'historia', arguments: '[tema]', description: "Dê o tema. Eu construo a narrativa." },
                { command: 'recomendar', arguments: '[pedido]', description: "Conte o que você procura." },
                { command: 'resumirurl', arguments: '[link]', description: "O conteúdo do link, sem enrolação." },
                { command: 'resumirchat', description: "Veja o que rolou na conversa." },
            ] },
            { title: 'CONFIGURAÇÃO DE MODELO', icon: "🪄", entries: [
                { command: 'modeloconversa', description: 'Consultar modelo ativo e opções.' },
                { command: 'modeloconversa', arguments: '<número ou id>', description: 'Selecionar modelo.' },
                { command: 'modeloshogun', arguments: '<número ou id>' },
            ], notes: NVIDIA_MODEL_CATALOG.map((entry, index) =>
                `${index + 1}. ${entry.label}${entry.id === DEFAULT_NVIDIA_MODEL ? ' · padrão' : ''} — ${entry.id}`),
            },
        ], options),
    });
}
