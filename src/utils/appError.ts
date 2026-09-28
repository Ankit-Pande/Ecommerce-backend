// Aisi error jiska message user ko dikhana hai (jaise "Order not found").
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
