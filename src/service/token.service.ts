import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { AppError } from "../utils/appError";
import { REFRESH_TTL_DAYS, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/token";

const OLD_TOKEN_GRACE_MS = 60 * 1000;
const SESSION_CACHE_SECONDS = 60;

const sessionKey = (sessionId: string) => `session:${sessionId}`;
const newExpiry = () => new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

function makeTokens(userId: string, sessionId: string, jti: string) {
  return {
    accessToken: signAccessToken({ userId, sessionId }),
    refreshToken: signRefreshToken({ userId, sessionId, jti }),
  };
}

export const tokenService = {
  async createSession(userId: string) {
    const session = await prisma.session.create({ data: { userId, jti: randomUUID(), expiresAt: newExpiry() } });
    return makeTokens(userId, session.id, session.jti);
  },

  async getSessionRole(userId: string, sessionId: string): Promise<Role | null> {
    const cached = await redis.get(sessionKey(sessionId)).catch(() => null);
    if (cached) {
      const saved = JSON.parse(cached) as { userId: string; role: Role };
      return saved.userId === userId ? saved.role : null;
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { userId: true, expiresAt: true, user: { select: { role: true, isBlocked: true, isDeleted: true } } },
    });
    if (!session || session.userId !== userId || session.expiresAt <= new Date()) return null;
    if (session.user.isBlocked || session.user.isDeleted) return null;

    const { role } = session.user;
    await redis
      .set(sessionKey(sessionId), JSON.stringify({ userId, role }), "EX", SESSION_CACHE_SECONDS)
      .catch(() => null);
    return role;
  },

  async refreshSession(refreshToken: string) {
    const { userId, sessionId, jti } = verifyRefreshToken(refreshToken);

    const tokens = await prisma.$transaction(async (db) => {
      await db.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${sessionId} FOR UPDATE`;
      const session = await db.session.findUnique({
        where: { id: sessionId },
        include: { user: { select: { isBlocked: true, isDeleted: true } } },
      });
      if (!session || session.userId !== userId || session.expiresAt <= new Date()) return null;
      if (session.user.isBlocked || session.user.isDeleted) return null;

      if (jti === session.jti) {
        const newJti = randomUUID();
        await db.session.update({
          where: { id: sessionId },
          data: { jti: newJti, previousJti: jti, rotatedAt: new Date(), expiresAt: newExpiry() },
        });
        return makeTokens(userId, sessionId, newJti);
      }

      const isRecentOldToken =
        jti === session.previousJti &&
        session.rotatedAt !== null &&
        Date.now() - session.rotatedAt.getTime() < OLD_TOKEN_GRACE_MS;
      if (isRecentOldToken) return makeTokens(userId, sessionId, session.jti);

      await db.session.delete({ where: { id: sessionId } });
      return null;
    });

    if (!tokens) {
      await redis.del(sessionKey(sessionId)).catch(() => null);
      throw new AppError("Session expired. Please login again.", 401);
    }
    return tokens;
  },

  async logout(refreshToken: string) {
    let token;
    try {
      token = verifyRefreshToken(refreshToken);
    } catch {
      return;
    }
    await prisma.session.deleteMany({ where: { id: token.sessionId, userId: token.userId } });
    await redis.del(sessionKey(token.sessionId)).catch(() => null);
  },

  async logoutAllDevices(userId: string) {
    const sessions = await prisma.session.findMany({ where: { userId }, select: { id: true } });
    if (sessions.length === 0) return;
    await prisma.session.deleteMany({ where: { userId } });
    await redis.del(...sessions.map((session) => sessionKey(session.id))).catch(() => null);
  },

  async deleteExpiredSessions() {
    await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  },
};
