// Aisi error jiska message user ko dikhana hai, saath me status code (jaise 404 "Order not found").
export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}
