import { Request, Response, CookieOptions } from "express";
import { env } from "../config/env";

// Refresh token httpOnly cookie — JS (XSS) isse padh nahi sakta.
// Path /api/auth tak seemit — sirf refresh/logout pe browser bhejta hai (aur endpoints
// ko cookie ki zaroorat nahi). SameSite=Lax same-site (localhost:3000 <-> :5000) pe chalta.
export const REFRESH_COOKIE = "refreshToken";

const isProd = env.NODE_ENV === "production";

// "30d"/"15m" -> milliseconds.
function expiryToMs(exp: string): number {
  const m = exp.match(/^(\d+)([smhd])$/);
  if (!m) return 30 * 86400 * 1000;
  const n = Number(m[1]);
  const unit = m[2];
  const sec = unit === "s" ? n : unit === "m" ? n * 60 : unit === "h" ? n * 3600 : n * 86400;
  return sec * 1000;
}

const baseOptions: CookieOptions = {
  httpOnly: true,
  secure: isProd, // prod me HTTPS-only
  sameSite: "lax",
  path: "/api/auth",
};

export function setRefreshCookie(res: Response, token: string): void {
  res.cookie(REFRESH_COOKIE, token, {
    ...baseOptions,
    maxAge: expiryToMs(env.JWT_REFRESH_EXPIRY),
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseOptions);
}

// Dependency-free cookie read (cookie-parser ki zaroorat nahi).
export function readRefreshCookie(req: Request): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === REFRESH_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
