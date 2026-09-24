import { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import { REFRESH_TTL_DAYS } from "./token";

const REFRESH_COOKIE = "refreshToken";
const isProd = env.NODE_ENV === "production";

// Refresh token httpOnly cookie me — JS (XSS) padh nahi sakta. Frontend alag domain pe
// hai, isliye prod me SameSite=None + Secure. Path /api/auth: baaki API pe cookie jaati hi nahi.
const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/api/auth",
};

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOptions,
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

// cookie-parser ke bina seedha header se padh lo.
export function readRefreshCookie(req: Request): string | undefined {
  for (const part of req.headers.cookie?.split(";") ?? []) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== REFRESH_COOKIE) continue;
    try {
      return decodeURIComponent(rest.join("="));
    } catch {
      return undefined;
    }
  }
  return undefined;
}
