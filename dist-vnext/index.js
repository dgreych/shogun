// vNext modular em construção. O bootstrap operacional continua legado até o gate explícito de cutover.
export { GYOMEI_R0_CONFIG } from './config.js';
export { LegacyCommandExecutorAdapter, } from './adapters/legacy-command-executor.js';
export { LegacyMenuPresentationAdapter, } from './adapters/legacy-menu-presentation.js';
export { extractLegacyMessageText, resolveLiveCommandDispatchInput, } from './adapters/live-message-context.js';
export { CommandDispatchHarness, } from './commands/dispatch-harness.js';
export { BUILTIN_COMMAND_ALIASES, normalizeCommandAliases, normalizeCommandToken, resolveCommandInput, } from './commands/input-resolver.js';
export { CommandRegistry } from './commands/registry.js';
export { CommandRouter } from './commands/router.js';
export { MENU_COMMAND_DESCRIPTORS, MENU_COMMAND_TOKENS, findMenuCommandDescriptor, } from './menu/catalog.js';
export { MenuDomainDispatchTarget, } from './menu/domain.js';
export { DOWNLOAD_MENU_DEFINITION, MENU_DEFINITIONS, STICKER_MENU_DEFINITION, } from './menu/definitions.js';
export { renderDownloadMenu } from './menu/download.js';
export { renderStickerMenu } from './menu/sticker.js';
export { MODERATION_COMMAND_DESCRIPTORS, MODERATION_COMMAND_TOKENS, findModerationCommandDescriptor, } from './moderation/catalog.js';
export { ModerationDomainDispatchTarget, } from './moderation/domain.js';
export { MacrotrancheCompatibilityDomainDispatchTarget, } from './macrotranche/domain.js';
export { CompositeVNextDispatchTarget } from './runtime/composite-dispatch.js';
export { CommandCompatibilityDispatch, CompatibilityDispatch, } from './runtime/compatibility-dispatch.js';
export { LegacySwitchHook, dispatchLegacySwitchVNext, } from './runtime/legacy-switch-hook.js';
export { LiveCommandDispatcher, } from './runtime/live-command-dispatcher.js';
export { LEGACY_PERSISTENCE_BOUNDARIES } from './runtime/database.js';
export { GENERATED_RUNTIME_BOUNDARIES, PRODUCTION_STATE_BOUNDARIES, assertDeployableCodePath, classifyDeploymentPath, isProductionStatePath, normalizeRepositoryPath, } from './runtime/state.js';
export { createVNextCommandRuntime, } from './runtime/vnext-command-runtime.js';
//# sourceMappingURL=index.js.map