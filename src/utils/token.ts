import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./appError";

export const REFRESH_TOKEN_DAYS = 15;
const ACCESS_TOKEN_LIFE = "15m";

type AccessTokenData = { userId: string; sessionId: string };
type RefreshTokenData = AccessTokenData & { jti: string };

// Signs a 15-minute access token.
export function signAccessToken(data: AccessTokenData): string {
  return jwt.sign(data, env.JWT_ACCESS_SECRET, { expiresIn: ACCESS_TOKEN_LIFE });
}

// Signs a 15-day refresh token; jti is the session's current token id.
export function signRefreshToken(data: RefreshTokenData): string {
  return jwt.sign(data, env.JWT_REFRESH_SECRET, { expiresIn: `${REFRESH_TOKEN_DAYS}d` });
}

// Checks an access token and returns its user and session, or throws 401.
export function verifyAccessToken(token: string): AccessTokenData {
  try {
    const data = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ["HS256"] });
    if (typeof data === "string" || !data.userId || !data.sessionId) {
      throw new Error("Token data missing");
    }
    return { userId: data.userId, sessionId: data.sessionId };
  } catch (error) {
    throw new AppError(error instanceof jwt.TokenExpiredError ? "Token expired" : "Invalid token", 401);
  }
}

// Checks a refresh token and returns its user, session and token id, or throws 401.
export function verifyRefreshToken(token: string): RefreshTokenData {
  try {
    const data = jwt.verify(token, env.JWT_REFRESH_SECRET, { algorithms: ["HS256"] });
    if (typeof data === "string" || !data.userId || !data.sessionId || !data.jti) {
      throw new Error("Token data missing");
    }
    return { userId: data.userId, sessionId: data.sessionId, jti: data.jti };
  } catch {
    throw new AppError("Invalid or expired refresh token", 401);
  }
}
