import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./appError";

export const REFRESH_TTL_DAYS = 15;

interface AccessPayload {
  userId: string;
  sessionId: string;
}

interface RefreshPayload {
  userId: string;
  sessionId: string;
  jti: string;
}

// Chhoti umar ka access token banao (15 minute).
export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY as jwt.SignOptions["expiresIn"],
  });
}

// Lambi umar ka refresh token banao (15 din).
export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
}

// Access token check karo, galat ya expired ho to 401.
export function verifyAccessToken(token: string): AccessPayload {
  try {
    const data = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    if (typeof data === "string" || !data.userId || !data.sessionId) throw new Error("bad payload");
    return { userId: data.userId, sessionId: data.sessionId };
  } catch (error) {
    const expired = error instanceof jwt.TokenExpiredError;
    throw new AppError(expired ? "Token expired" : "Invalid token", 401);
  }
}

// Refresh token check karo, galat ya expired ho to 401.
export function verifyRefreshToken(token: string): RefreshPayload {
  try {
    const data = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
    if (typeof data === "string" || !data.userId || !data.sessionId || !data.jti) throw new Error("bad payload");
    return { userId: data.userId, sessionId: data.sessionId, jti: data.jti };
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }
}
