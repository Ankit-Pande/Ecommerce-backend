import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { AppError } from "../utils/appError";
import { REFRESH_TTL_DAYS, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/token";

// Do tab ek saath refresh karein to 60 sec tak purana token bhi chale.
const ROTATION_GRACE_MS = 60 * 1000;
const SESSION_CACHE_SEC = 60;

const sessionKey = (sessionId: string) => `session:${sessionId}`;
const refreshExpiry = () => new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

// Access + refresh token dono banao.
function tokenPair(userId: string, sessionId: string, jti: string) {
  return {
    accessToken: signAccessToken({ userId, sessionId }),
    refreshToken: signRefreshToken({ userId, sessionId, jti }),
  };
}

export const tokenService = {
  // Login par nayi session (har device ki alag).
  async createSession(userId: string) {
    const session = await prisma.session.create({
      data: { userId, jti: randomUUID(), expiresAt: refreshExpiry() },
    });
    return tokenPair(userId, session.id, session.jti);
  },

  // Session zinda hai to user ka role do, warna null (pehle Redis, phir DB).
  async getSessionRole(userId: string, sessionId: string): Promise<Role | null> {
    const cached = await redis.get(sessionKey(sessionId)).catch(() => null);
    if (cached) {
      const saved = JSON.parse(cached) as { userId: string; role: Role };
      return saved.userId === userId ? saved.role : null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: {
        userId: true,
        expiresAt: true,
        user: { select: { role: true, isBlocked: true, isDeleted: true } },
      },
    });
    if (!session || session.userId !== userId || session.expiresAt <= new Date()) return null;
    if (session.user.isBlocked || session.user.isDeleted) return null;

    const role = session.user.role;
    await redis
      .set(sessionKey(sessionId), JSON.stringify({ userId, role }), "EX", SESSION_CACHE_SEC)
      .catch(() => null);
    return role;
  },

  // Naya token do; purana token dobara aaye (chori hua) to session khatam.
  async refreshSession(refreshToken: string) {
    const { userId, sessionId, jti } = verifyRefreshToken(refreshToken);

    const result = await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${sessionId} FOR UPDATE`;
      const session = await db.session.findUnique({
        where: { id: sessionId },
        include: { user: { select: { isBlocked: true, isDeleted: true } } },
      });

      if (!session || session.userId !== userId || session.expiresAt <= new Date()) return null;
      if (session.user.isBlocked || session.user.isDeleted) return null;

      if (jti === session.jti) {
        const nextJti = randomUUID();
        await db.session.update({
          where: { id: sessionId },
          data: { jti: nextJti, previousJti: jti, rotatedAt: new Date(), expiresAt: refreshExpiry() },
        });
        return tokenPair(userId, sessionId, nextJti);
      }

      const withinGrace =
        jti === session.previousJti &&
        session.rotatedAt !== null &&
        Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS;
      if (withinGrace) return tokenPair(userId, sessionId, session.jti);

      await db.session.delete({ where: { id: sessionId } });
      return null;
    });

    if (!result) {
      await redis.del(sessionKey(sessionId)).catch(() => null);
      throw new AppError("Session expired. Please login again.", 401);
    }
    return result;
  },

  // Is device se logout (session DB aur Redis dono se hatao).
  async logout(refreshToken: string) {
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    await prisma.session.deleteMany({ where: { id: payload.sessionId, userId: payload.userId } });
    await redis.del(sessionKey(payload.sessionId)).catch(() => null);
  },

  // User ke saare device se logout (block, role change, delete par).
  async revokeAllSessions(userId: string) {
    const sessions = await prisma.session.findMany({ where: { userId }, select: { id: true } });
    if (sessions.length === 0) return;
    await prisma.session.deleteMany({ where: { userId } });
    await redis.del(...sessions.map((s) => sessionKey(s.id))).catch(() => null);
  },

  // Expire ho chuki sessions hatao (roz).
  async deleteExpiredSessions() {
    await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  },
};
