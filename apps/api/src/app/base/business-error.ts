export const DEFAULT_BUSINESS_ERROR_MESSAGE = 'Something went wrong. Please try again.'

/**
 * Base class for expected business failures raised by domain and application code.
 * The message is shown to end users: keep it friendly, in plain English, without internals.
 * Subclasses declare a literal `name` (so unions of them can be matched exhaustively) and may
 * set their own default message; without one they fall back to the generic default.
 */
export abstract class BusinessError extends Error {
  constructor(message: string = DEFAULT_BUSINESS_ERROR_MESSAGE) {
    super(message)
  }
}
