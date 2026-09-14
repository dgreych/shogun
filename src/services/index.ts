/**
 * Registro nominal de serviços para composição futura. R0 deliberadamente
 * não instancia BunnyFy, NEXO, serviço legado, persistência ou automações.
 */
export type ServiceRegistry = Readonly<Record<string, unknown>>;
