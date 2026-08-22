import { LegacyMenuPresentationAdapter } from '../adapters/legacy-menu-presentation.js';
import { AdminCollectionsDispatchTarget } from '../admin/collections-domain.js';
import type { AdminExecutionContext } from '../admin/contracts.js';
import { AdminGroupDispatchTarget } from '../admin/group-domain.js';
import { AdminSettingsDispatchTarget } from '../admin/settings-domain.js';
import { AdminBooleanSettingsDispatchTarget } from '../admin/toggle-domain.js';
import { FunDomainDispatchTarget } from '../fun/domain.js';
import {
  MacrotrancheCompatibilityDomainDispatchTarget,
  type MacrotrancheExecutionContext,
} from '../macrotranche/domain.js';
import { MembersDomainDispatchTarget } from '../members/domain.js';
import { MenuDomainDispatchTarget } from '../menu/domain.js';
import { ModerationDomainDispatchTarget } from '../moderation/domain.js';
import { ToolsDomainDispatchTarget } from '../tools/domain.js';
import { ExternalToolsDomainDispatchTarget } from '../tools/external-domain.js';
import { LinkCheckToolsDomainDispatchTarget } from '../tools/link-check-domain.js';
import {
  MiscToolsDomainDispatchTarget,
  type MiscToolsExecutionContext,
} from '../tools/misc-domain.js';
import {
  UtilityToolsDomainDispatchTarget,
  type UtilityToolsExecutionContext,
} from '../tools/utility-domain.js';
import type { VNextCommandDispatchTarget } from './compatibility-dispatch.js';
import { CompositeVNextDispatchTarget } from './composite-dispatch.js';

export interface LegacySwitchOwnedTarget {
  dispatch(command: string, context: MacrotrancheExecutionContext): Promise<boolean>;
}

/**
 * Hook de ownership usado dentro do executor legado, imediatamente antes do
 * switch(command). Todos os gates e políticas preexistentes já executaram
 * quando esta classe é chamada. Se um domínio vNext assumir o comando, o
 * switch legado não deve ser alcançado; se recusar, o legado continua uma vez.
 */
export class LegacySwitchHook {
  constructor(private readonly target: LegacySwitchOwnedTarget) {}

  dispatch(command: string, context: MacrotrancheExecutionContext): Promise<boolean> {
    return this.target.dispatch(command, context);
  }
}

let liveHook: LegacySwitchHook | undefined;

function adminContext(context: MacrotrancheExecutionContext): AdminExecutionContext {
  return {
    ...context,
    groupPrefix: context.prefix,
  };
}

function createLiveHook(): LegacySwitchHook {
  const presentation = new LegacyMenuPresentationAdapter();
  const menu = new MenuDomainDispatchTarget(presentation);
  const fun = new FunDomainDispatchTarget();
  const moderation = new ModerationDomainDispatchTarget();
  const adminBooleanSettings = new AdminBooleanSettingsDispatchTarget();
  const adminSettings = new AdminSettingsDispatchTarget();
  const adminGroup = new AdminGroupDispatchTarget();
  const adminCollections = new AdminCollectionsDispatchTarget();
  const tools = new ToolsDomainDispatchTarget();
  const utilityTools = new UtilityToolsDomainDispatchTarget();
  const externalTools = new ExternalToolsDomainDispatchTarget();
  const linkCheckTools = new LinkCheckToolsDomainDispatchTarget();
  const miscTools = new MiscToolsDomainDispatchTarget();
  const members = new MembersDomainDispatchTarget<MacrotrancheExecutionContext>({ state: 'active' });
  const macrotrancheCompatibility = new MacrotrancheCompatibilityDomainDispatchTarget();

  const menuTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return menu.dispatch(command, context);
    },
  };
  const funTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return fun.dispatch(command, context);
    },
  };
  const moderationTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return moderation.dispatch(command, context);
    },
  };
  const adminBooleanTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return adminBooleanSettings.dispatch(command, adminContext(context));
    },
  };
  const adminSettingsTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return adminSettings.dispatch(command, adminContext(context));
    },
  };
  const adminGroupTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return adminGroup.dispatch(command, adminContext(context));
    },
  };
  const adminCollectionsTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return adminCollections.dispatch(command, adminContext(context));
    },
  };
  const toolsTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return tools.dispatch(command, context);
    },
  };
  const utilityToolsTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return utilityTools.dispatch(command, context as UtilityToolsExecutionContext);
    },
  };
  const externalToolsTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return externalTools.dispatch(command, context);
    },
  };
  const linkCheckToolsTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return linkCheckTools.dispatch(command, context);
    },
  };
  const miscToolsTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return miscTools.dispatch(command, context as MiscToolsExecutionContext);
    },
  };
  const membersTarget: VNextCommandDispatchTarget<MacrotrancheExecutionContext> = {
    dispatch(command, context) {
      return members.dispatch(command, context);
    },
  };

  return new LegacySwitchHook(
    new CompositeVNextDispatchTarget<MacrotrancheExecutionContext>([
      menuTarget,
      funTarget,
      moderationTarget,
      adminBooleanTarget,
      adminSettingsTarget,
      adminGroupTarget,
      adminCollectionsTarget,
      toolsTarget,
      utilityToolsTarget,
      externalToolsTarget,
      linkCheckToolsTarget,
      miscToolsTarget,
      // Members assume o domínio completo antes do bridge amplo. O cutover
      // atômico cobre 32 famílias / 152 tokens e mantém fail-closed depois do
      // início do handler; falha estrutural pré-handler preserva o legado.
      membersTarget,
      macrotrancheCompatibility,
    ]),
  );
}

/**
 * Entry point mínimo importado por dados/src/.runtime-index.js.
 * O singleton evita recarregar módulos/renderers a cada mensagem.
 */
export async function dispatchLegacySwitchVNext(
  command: string,
  context: MacrotrancheExecutionContext,
): Promise<boolean> {
  liveHook ??= createLiveHook();
  return liveHook.dispatch(command, context);
}
