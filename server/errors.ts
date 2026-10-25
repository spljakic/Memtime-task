import type { ErrorCode } from '../shared/contracts';
export class AppError extends Error {
  constructor(
    public status: number,
    public code: ErrorCode,
    message: string,
    public retryAfter?: number,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}
