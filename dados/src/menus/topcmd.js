import { renderShogunMenu, selectMenuEntries } from './presentation.js';

export default async function menuTopCmd(prefix, _botName = 'SHOGUN', userName = 'Usuário', topCommands = [], options = {}) {
    const allowed = selectMenuEntries((Array.isArray(topCommands) ? topCommands : []).map(entry => ({ ...entry, command: entry.name })), options.accessFor);
    const ranking = allowed.map((entry, index) => ({
        command: entry.name,
        description: `${index + 1}º · ${entry.count} usos por ${entry.uniqueUsers} usuários`,
    }));
    return renderShogunMenu({
        intro: "Comandos mais usados, com total de execuções e usuários.",
        footer: "Consulte #prefix#cmdinfo nome-do-comando para ver as estatísticas detalhadas.",
        options,
        title: 'RANKING DE COMANDOS', prefix, userName, accessFor: options.accessFor,
        sections: [
            { title: 'USO DE COMANDOS', icon: "🏆", entries: ranking },
            { title: 'CONSULTA', icon: "💭", entries: ranking.length
                ? [{ command: 'cmdinfo', arguments: '[comando]', description: 'Ver estatísticas do comando.' }]
                : [{ command: 'menu', description: 'Nenhum comando foi registrado ainda.' }],
            },
        ],
    });
}
