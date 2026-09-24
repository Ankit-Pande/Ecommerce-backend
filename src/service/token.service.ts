import { randomUUID } from "crypto";
import { Role } from "@prisma/client";
import { prisma } from "../config/db";
import { redis } from "../config/redis";
import { AppError } from "../utils/appError";
import { REFRESH_TTL_DAYS, signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/token";

// Do tab ek saath refresh karein to purana token itni der tak nayi session de deta hai.
const ROTATION_GRACE_MS = 60 * 1000;
// Redis me session ka role thodi der ke liye — har request pe DB na jaana pade.
const SESSION_CACHE_SEC = 60;

const sessionKey = (sessionId: string) => `session:${sessionId}`;
const refreshExpiry = () => new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);

function tokenPair(userId: string, sessionId: string, jti: string) {
  return {
    accessToken: signAccessToken({ userId, sessionId }),
    refreshToken: signRefreshToken({ userId, sessionId, jti }),
  };
}

export const tokenService = {
  // Login: naya device = nayi session row. Multi-device allowed.
  async createSession(userId: string) {
    const session = await prisma.session.create({
      data: { userId, jti: randomUUID(), expiresAt: refreshExpiry() },
    });
    return tokenPair(userId, session.id, session.jti);
  },

  // authCheck ke liye: session zinda hai to user ka current role, warna null.
  // Pehle Redis, na mile (ya Redis down) to DB — DB hi asli sach hai.
  async getSessionRole(userId: string, sessionId: string): Promise<Role | null> {
    const cached = await redis.get(sessionKey(sessionId)).catch(() => null);
    if (cached) {
      try {
        const saved = JSON.parse(cached) as { userId: string; role: Role };
        return saved.userId === userId ? saved.role : null;
      } catch {
        // Value kharab hai — cache chhodo, neeche DB se padh lo.
      }
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

  // Refresh token rotate: har refresh pe naya jti, purana bekaar.
  // Purana jti grace ke baad dobara aaye = token chori hua -> session khatam.
  async refreshSession(refreshToken: string) {
    const { userId, sessionId, jti } = verifyRefreshToken(refreshToken);

    const result = await prisma.$transaction(async (tx) => {
      // Ek session ke refresh/logout ek-ek karke chalein.
      await tx.$queryRaw`SELECT "id" FROM "Session" WHERE "id" = ${sessionId} FOR UPDATE`;
      const session = await tx.session.findUnique({
        where: { id: sessionId },
        include: { user: { select: { isBlocked: true, isDeleted: true } } },
      });

      if (!session || session.userId !== userId || session.expiresAt <= new Date()) return null;
      if (session.user.isBlocked || session.user.isDeleted) return null;

      if (jti === session.jti) {
        const nextJti = randomUUID();
        await tx.session.update({
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

      await tx.session.delete({ where: { id: sessionId } });
      return null;
    });

    if (!result) {
      await redis.del(sessionKey(sessionId)).catch(() => null);
      throw new AppError("Session expired. Please login again.", 401);
    }
    return result;
  },

  // Logout (sirf ye device). Token galat/expired ho to bhi logout safal maano.
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

  // Block / role change / account delete: user ke saare device logout.
  async revokeAllSessions(userId: string) {
    const sessions = await prisma.session.findMany({ where: { userId }, select: { id: true } });
    if (sessions.length === 0) return;
    await prisma.session.deleteMany({ where: { userId } });
    await redis.del(...sessions.map((s) => sessionKey(s.id))).catch(() => null);
  },

  // Roz ek baar: expire ho chuki sessions hatao.
  async deleteExpiredSessions() {
    await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  },
};
