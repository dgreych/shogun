// vNext modular em construção. O bootstrap operacional continua legado até o gate explícito de cutover.
export { SHOGUN_CONFIG, type ShogunRuntimeConfig } from './config.js';
export type { AppContext } from './app/context.js';
export {
  LegacyCommandExecutorAdapter,
  type LegacyCommandExecutionInput,
} from './adapters/legacy-command-executor.js';
export {
  LegacyMenuPresentationAdapter,
  type LegacyMenuPresentationDependencies,
} from './adapters/legacy-menu-presentation.js';
export {
  extractLegacyMessageText,
  resolveLiveCommandDispatchInput,
  type InteractiveMessageParseErrorReporter,
  type LegacyLiveContextPort,
  type LiveMessageContextSeed,
} from './adapters/live-message-context.js';
export type { WhatsAppMessageAdapter } from './adapters/whatsapp.js';
export type { CommandHandler } from './commands/contracts.js';
export {
  CommandDispatchHarness,
  type CommandDispatchHarnessInput,
  type CommandDispatchHarnessResult,
} from './commands/dispatch-harness.js';
export {
  BUILTIN_COMMAND_ALIASES,
  normalizeCommandAliases,
  normalizeCommandToken,
  resolveCommandInput,
  type CommandResolutionSource,
  type NormalizedCommandAlias,
  type ResolvedCommandInput,
} from './commands/input-resolver.js';
export { CommandRegistry } from './commands/registry.js';
export { CommandRouter } from './commands/router.js';
export type { ConversationEnvelope, ConversationKind } from './domain/conversation.js';
export {
  MENU_COMMAND_DESCRIPTORS,
  MENU_COMMAND_TOKENS,
  findMenuCommandDescriptor,
  type LegacyMenuRendererKey,
  type MenuCommandDescriptor,
} from './menu/catalog.js';
export {
  MenuDomainDispatchTarget,
  type MenuExecutionContext,
  type MenuPresentationPort,
  type MenuPresentationRequest,
} from './menu/domain.js';
export {
  DOWNLOAD_MENU_DEFINITION,
  MENU_DEFINITIONS,
  STICKER_MENU_DEFINITION,
  type MenuDefinition,
  type MenuEntry,
  type MenuSection,
} from './menu/definitions.js';
export { renderDownloadMenu, type DownloadMenuRenderOptions } from './menu/download.js';
export { renderStickerMenu, type StickerMenuRenderOptions } from './menu/sticker.js';
export {
  MODERATION_COMMAND_DESCRIPTORS,
  MODERATION_COMMAND_TOKENS,
  findModerationCommandDescriptor,
  type ModerationCommandDescriptor,
  type ModerationCommandKind,
} from './moderation/catalog.js';
export {
  ModerationDomainDispatchTarget,
  type ModerationExecutionContext,
} from './moderation/domain.js';
export {
  MacrotrancheCompatibilityDomainDispatchTarget,
  type MacrotrancheExecutionContext,
} from './macrotranche/domain.js';
export type { NexoPort, NexoStatus } from './nexo/contracts.js';
export type { GyomeiClientPort } from './runtime/client.js';
export { CompositeVNextDispatchTarget } from './runtime/composite-dispatch.js';
export {
  CommandCompatibilityDispatch,
  CompatibilityDispatch,
  type CompatibilityDispatchOwner,
  type LegacyFallbackExecutor,
  type VNextCommandDispatchTarget,
  type VNextEnvelopeDispatcher,
} from './runtime/compatibility-dispatch.js';
export {
  LegacySwitchHook,
  dispatchLegacySwitchVNext,
  type LegacySwitchOwnedTarget,
} from './runtime/legacy-switch-hook.js';
export {
  LiveCommandDispatcher,
  type LiveCommandDispatchInput,
  type LiveCommandDispatchReceipt,
} from './runtime/live-command-dispatcher.js';
export { LEGACY_PERSISTENCE_BOUNDARIES, type LegacyPersistencePort } from './runtime/database.js';
export type { GyomeiRuntime } from './runtime/runtime.js';
export {
  GENERATED_RUNTIME_BOUNDARIES,
  PRODUCTION_STATE_BOUNDARIES,
  assertDeployableCodePath,
  classifyDeploymentPath,
  isProductionStatePath,
  normalizeRepositoryPath,
  type DeploymentPathDisposition,
} from './runtime/state.js';
export {
  createVNextCommandRuntime,
  type VNextCommandRuntimeOptions,
} from './runtime/vnext-command-runtime.js';
export type { ServiceRegistry } from './services/index.js';
