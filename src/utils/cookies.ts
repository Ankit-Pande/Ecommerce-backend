import { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import { REFRESH_TTL_DAYS } from "./token";

const REFRESH_COOKIE = "refreshToken";
const isProduction = env.NODE_ENV === "production";

// Cookie ki settings: browser ka JavaScript ise padh nahi sakta, aur ye sirf /api/auth par jaati hai.
const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/api/auth",
};

// Refresh token cookie me rakho (15 din).
export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...cookieOptions,
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

// Logout par cookie hatao.
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

// Request ki cookies me se refresh token dhoondh kar do.
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
