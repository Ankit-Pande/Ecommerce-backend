// Operational error: known/expected errors (validation, auth, not-found).
// isOperational = true matlab humari expected error. Default 400 (zyaadatar client-side);
// unknown errors error.ts khud 500 deta hai.
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    // extends Error ke baad instanceof reliable rakhne ke liye (TS/compiled JS safe).
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}
