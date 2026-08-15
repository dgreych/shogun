class TavernError extends Error {
  constructor(message, code = 'TAVERN_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class TavernValidationError extends TavernError {
  constructor(message, details = null) {
    super(message, 'TAVERN_VALIDATION_ERROR', details);
  }
}

class TavernRuleError extends TavernError {
  constructor(message, details = null) {
    super(message, 'TAVERN_RULE_ERROR', details);
  }
}

class TavernNotFoundError extends TavernError {
  constructor(message, details = null) {
    super(message, 'TAVERN_NOT_FOUND', details);
  }
}

class TavernConflictError extends TavernError {
  constructor(message, details = null) {
    super(message, 'TAVERN_CONFLICT', details);
  }
}

export {
  TavernError,
  TavernValidationError,
  TavernRuleError,
  TavernNotFoundError,
  TavernConflictError
};
