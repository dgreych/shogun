/**
 * Agrega domínios vNext sem recriar um switch monolítico.
 * Cada domínio declara ownership de famílias inteiras e a cadeia para no
 * primeiro que aceitar o comando. Exceções propagam: domínio que aceitou e
 * falhou não autoriza outro domínio ou o legado a executar a mesma mensagem.
 */
export class CompositeVNextDispatchTarget {
    targets;
    constructor(targets) {
        this.targets = targets;
    }
    async dispatch(command, context) {
        for (const target of this.targets) {
            if (await target.dispatch(command, context))
                return true;
        }
        return false;
    }
}
//# sourceMappingURL=composite-dispatch.js.map