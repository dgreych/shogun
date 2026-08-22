/**
 * Etapa de strangler para a macrotranche ampla.
 *
 * O ownership passa pelo dispatcher vNext, porém a implementação funcional
 * continua sendo executada pelo corpo legado capturado no runtime gerado.
 * Isso permite migrar centenas de aliases/famílias de roteamento de uma vez
 * sem reescrever comportamento antes de existir paridade suficiente para cada
 * domínio interno. A delegação é propositalmente fail-closed: erro em comando
 * owned nunca cai novamente no switch legado e portanto não duplica efeitos.
 */
export class MacrotrancheCompatibilityDomainDispatchTarget {
    async dispatch(command, context) {
        const normalized = String(command || '').trim().toLowerCase();
        if (!normalized || !context.isMacrotrancheOwnedCommand(normalized))
            return false;
        await context.executeLegacyOwnedCommand(normalized);
        return true;
    }
}
//# sourceMappingURL=domain.js.map