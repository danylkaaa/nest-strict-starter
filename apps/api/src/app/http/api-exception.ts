import { HttpException } from '@nestjs/common'

import type { HttpStatus } from '@nestjs/common'

/** Expected HTTP failure with a stable, machine-readable `code` for API clients. */
export class ApiException extends HttpException {
  readonly code: string

  constructor(status: HttpStatus, code: string, message: string) {
    super(message, status)
    this.code = code
  }
}
