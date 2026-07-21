export interface ErrorDetail {
  field: string;
  issue: string;
}

/**
 * Base application error. All operational errors thrown by the app extend this
 * so the global error handler can render a consistent response and decide
 * whether the error is safe to expose.
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: ErrorDetail[];
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: ErrorDetail[],
    isOperational = true,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}
