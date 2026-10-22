import { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import { REFRESH_TOKEN_DAYS } from "./token";

const REFRESH_COOKIE = "refreshToken";
const isProduction = env.NODE_ENV === "production";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/api/auth",
};

// Saves the refresh token in an HttpOnly cookie that only /api/auth can read.
export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions, maxAge: REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000 });
}

// Deletes the refresh token cookie (logout and account delete).
export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

// Reads the refresh token from the Cookie header.
export function readRefreshCookie(req: Request): string | undefined {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
  return cookie?.slice(REFRESH_COOKIE.length + 1);
}
