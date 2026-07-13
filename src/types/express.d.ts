import { Role } from "@prisma/client";

// req.user — authCheck middleware set karta hai. Header-based auth (no cookie).
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: Role;
        jti: string;
      };
    }
  }
}

export {};
