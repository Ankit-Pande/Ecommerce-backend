import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./appError";

export const REFRESH_TTL_DAYS = 15;
const ACCESS_TTL = "15m";

type AccessPayload = { userId: string; sessionId: string };
type RefreshPayload = AccessPayload & { jti: string };

export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

export function signRefreshToken(payload: RefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_TTL_DAYS}d` });
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const data = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    if (typeof data === "string" || !data.userId || !data.sessionId) throw new Error("bad payload");
    return { userId: data.userId, sessionId: data.sessionId };
  } catch (error) {
    throw new AppError(error instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token", 401);
  }
}

export function verifyRefreshToken(token: string): RefreshPayload {
  try {
    const data = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
    if (typeof data === "string" || !data.userId || !data.sessionId || !data.jti) throw new Error("bad payload");
    return { userId: data.userId, sessionId: data.sessionId, jti: data.jti };
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }
}
