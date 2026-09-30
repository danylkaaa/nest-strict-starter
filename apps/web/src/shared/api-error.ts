// Mirrors the backend error envelope `{ ok: false, error: { code, message, details? } }`
export class ApiError extends Error {
  readonly code: string;
  /** Set on a repeated idempotency key: the job that the first submit created */
  readonly existingJobId: string | undefined;
  /** Set on a repeated batch key: the batch that the first submit created */
  readonly existingBatchId: string | undefined;

  constructor(code: string, message: string, existingJobId?: string, existingBatchId?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.existingJobId = existingJobId;
    this.existingBatchId = existingBatchId;
  }
}
