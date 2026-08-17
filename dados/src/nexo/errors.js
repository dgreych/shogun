class NexoError extends Error {
  constructor(message, code = 'NEXO_ERROR', details = null) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.details = details;
  }
}

class NexoValidationError extends NexoError {
  constructor(message, details = null) {
    super(message, 'NEXO_VALIDATION_ERROR', details);
  }
}

class NexoConflictError extends NexoError {
  constructor(message, details = null) {
    super(message, 'NEXO_CONFLICT', details);
  }
}

class NexoNotFoundError extends NexoError {
  constructor(message, details = null) {
    super(message, 'NEXO_NOT_FOUND', details);
  }
}

export {
  NexoError,
  NexoValidationError,
  NexoConflictError,
  NexoNotFoundError
};
