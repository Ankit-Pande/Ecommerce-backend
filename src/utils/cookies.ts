import { CookieOptions, Request, Response } from "express";
import { env } from "../config/env";
import { REFRESH_TTL_DAYS } from "./token";

const REFRESH_COOKIE = "refreshToken";
const isProduction = env.NODE_ENV === "production";

const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  path: "/api/auth",
};

export function setRefreshCookie(res: Response, token: string) {
  res.cookie(REFRESH_COOKIE, token, { ...cookieOptions, maxAge: REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000 });
}

export function clearRefreshCookie(res: Response) {
  res.clearCookie(REFRESH_COOKIE, cookieOptions);
}

export function readRefreshCookie(req: Request): string | undefined {
  const cookie = req.headers.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${REFRESH_COOKIE}=`));
  return cookie?.slice(REFRESH_COOKIE.length + 1);
}
