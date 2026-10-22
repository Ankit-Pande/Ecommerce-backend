// An expected error with an HTTP status; the error handler sends its message to the client as it is.
export class AppError extends Error {
  statusCode: number;

  // Saves the message and the HTTP status (400 when not given).
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
