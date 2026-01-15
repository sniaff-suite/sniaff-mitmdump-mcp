export enum ErrorCode {
  // Session errors
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  SESSION_INVALID_STATE = 'SESSION_INVALID_STATE',
  PROXY_ALREADY_RUNNING = 'PROXY_ALREADY_RUNNING',
  PROXY_NOT_RUNNING = 'PROXY_NOT_RUNNING',

  // Process errors
  MITMDUMP_NOT_FOUND = 'MITMDUMP_NOT_FOUND',
  MITMDUMP_START_FAILED = 'MITMDUMP_START_FAILED',
  MITMDUMP_CRASHED = 'MITMDUMP_CRASHED',
  PORT_UNAVAILABLE = 'PORT_UNAVAILABLE',

  // State errors
  STATE_READ_FAILED = 'STATE_READ_FAILED',
  STATE_WRITE_FAILED = 'STATE_WRITE_FAILED',

  // Database errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  QUERY_FAILED = 'QUERY_FAILED',
  ENTRY_NOT_FOUND = 'ENTRY_NOT_FOUND',

  // Validation errors
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',

  // Generic
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TIMEOUT = 'TIMEOUT',
}

export class MitmError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'MitmError';
  }

  toJSON(): { code: ErrorCode; message: string; details?: Record<string, unknown> } {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    };
  }
}
