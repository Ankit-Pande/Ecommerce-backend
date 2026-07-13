// Shared app-wide types. (req.user express.d.ts me hai.)

// Standard API success response shape (controllers isi pattern me bhejte hain).
export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

// Cursor-paginated list result (product/order/admin listing use karte hain).
export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}
