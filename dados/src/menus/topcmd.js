import { renderShogunMenu, selectMenuEntries } from './presentation.js';

export default async function menuTopCmd(prefix, _botName = 'SHOGUN', userName = 'Usuário', topCommands = [], options = {}) {
    const allowed = selectMenuEntries((Array.isArray(topCommands) ? topCommands : []).map(entry => ({ ...entry, command: entry.name })), options.accessFor);
    const ranking = allowed.map((entry, index) => ({
        command: entry.name,
        description: `${index + 1}º · ${entry.count} usos por ${entry.uniqueUsers} usuários`,
    }));
    return renderShogunMenu({
        options,
        title: 'RANKING DE COMANDOS', prefix, userName, accessFor: options.accessFor,
        sections: [
            { title: 'MAIS USADOS', entries: ranking },
            { title: 'CONSULTA', entries: ranking.length
                ? [{ command: 'cmdinfo', arguments: '[comando]', description: 'Ver estatísticas do comando.' }]
                : [{ command: 'menu', description: 'Nenhum comando foi registrado ainda.' }],
            },
        ],
    });
}
