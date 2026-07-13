import crypto from "crypto";
import jwt, {
  JsonWebTokenError,
  TokenExpiredError,
  SignOptions,
} from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./appError";
import { Role } from "@prisma/client";

export interface TokenPayload {
  userId: string;
  role: Role;
  jti: string;
}

// Verify ke baad payload ka shape confirm — koi galat token andar na aaye.
function isValidTokenPayload(data: unknown): data is TokenPayload {
  if (!data || typeof data !== "object") return false;
  const p = data as Record<string, unknown>;
  return (
    typeof p.userId === "string" &&
    typeof p.role === "string" &&
    typeof p.jti === "string"
  );
}

export function generateJti(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function signAccessToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  } as SignOptions);
}

export function signRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  } as SignOptions);
}

export function verifyAccessToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (!isValidTokenPayload(decoded)) {
      throw new AppError("Invalid token payload", 401);
    }
    return decoded;
  } catch (error) {
    if (error instanceof TokenExpiredError)
      throw new AppError("Token expired", 401);
    if (error instanceof JsonWebTokenError)
      throw new AppError("Invalid token", 401);
    if (error instanceof AppError) throw error;
    throw new AppError("Token verification failed", 401);
  }
}

export function verifyRefreshToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET);
    if (!isValidTokenPayload(decoded)) {
      throw new AppError("Invalid refresh token payload", 401);
    }
    return decoded;
  } catch (error) {
    if (error instanceof TokenExpiredError)
      throw new AppError("Refresh token expired", 401);
    if (error instanceof JsonWebTokenError)
      throw new AppError("Invalid refresh token", 401);
    if (error instanceof AppError) throw error;
    throw new AppError("Refresh token verification failed", 401);
  }
}
