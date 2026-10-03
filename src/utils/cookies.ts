import { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import { REFRESH_TTL_DAYS } from "./token";

const REFRESH_COOKIE = "refreshToken";
const isProd = env.NODE_ENV === "production";

// httpOnly cookie — browser ka JS isse padh nahi sakta; sirf /api/auth par jaati hai.
const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? "none" : "lax",
  path: "/api/auth",
};

// Refresh token cookie me set karo.
export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOptions,
    maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000,
  });
}

// Logout par cookie hatao.
export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

// Request ki cookie se refresh token nikalo.
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
