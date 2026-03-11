/**
 * Structured error types for the Metrone server SDK.
 *
 * All errors carry a machine-readable `code` that agents can switch on,
 * plus a human-readable `message` for logs.
 */

export class MetroneError extends Error {
  public readonly code: string
  public readonly status?: number
  public readonly retryable: boolean

  constructor(code: string, message: string, status?: number, retryable = false) {
    super(message)
    this.name = 'MetroneError'
    this.code = code
    this.status = status
    this.retryable = retryable
  }
}

export class MetroneConfigError extends MetroneError {
  constructor(message: string) {
    super('CONFIG_INVALID', message)
    this.name = 'MetroneConfigError'
  }
}

export class MetroneAuthError extends MetroneError {
  constructor(message = 'Invalid or missing API key') {
    super('AUTH_FAILED', message, 401, false)
    this.name = 'MetroneAuthError'
  }
}

export class MetroneRateLimitError extends MetroneError {
  public readonly retryAfterMs: number

  constructor(retryAfterMs: number) {
    super('RATE_LIMITED', `Rate limit exceeded. Retry after ${retryAfterMs}ms.`, 429, true)
    this.name = 'MetroneRateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class MetroneQuotaError extends MetroneError {
  constructor(message = 'Monthly event quota exceeded') {
    super('QUOTA_EXCEEDED', message, 429, false)
    this.name = 'MetroneQuotaError'
  }
}

export class MetroneNetworkError extends MetroneError {
  constructor(message = 'Network request failed') {
    super('NETWORK_ERROR', message, undefined, true)
    this.name = 'MetroneNetworkError'
  }
}

export class MetroneTimeoutError extends MetroneError {
  constructor(timeoutMs: number) {
    super('TIMEOUT', `Request timed out after ${timeoutMs}ms`, undefined, true)
    this.name = 'MetroneTimeoutError'
  }
}

export class MetroneValidationError extends MetroneError {
  public readonly fields: Array<{ field: string; message: string }>

  constructor(fields: Array<{ field: string; message: string }>) {
    const summary = fields.map(f => `${f.field}: ${f.message}`).join('; ')
    super('VALIDATION_FAILED', `Validation failed: ${summary}`, 400, false)
    this.name = 'MetroneValidationError'
    this.fields = fields
  }
}

export class MetroneServerError extends MetroneError {
  constructor(status: number, message = 'Internal server error') {
    super('SERVER_ERROR', message, status, true)
    this.name = 'MetroneServerError'
  }
}
