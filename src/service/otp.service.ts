import crypto from "crypto";
import { env } from "../config/env";
import { countInWindow, redis } from "../config/redis";
import { sendOtpSms } from "../integration/msg91";
import { AppError } from "../utils/appError";

const OTP_VALID_SECONDS = 120;
const RESEND_WAIT_SECONDS = 60;
const MAX_SEND_PER_HOUR = 5;
const MAX_WRONG_TRIES = 3;

const CHECK_OTP_SCRIPT = `
local code = redis.call('HGET', KEYS[1], 'code')
if not code then return 0 end
if code == ARGV[1] then redis.call('DEL', KEYS[1]) return 1 end
if redis.call('HINCRBY', KEYS[1], 'wrong', 1) >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) return -2 end
return -1`;

// Only a hash of the OTP is kept in Redis.
function hashOtp(phone: string, otp: string): string {
  return crypto.createHmac("sha256", env.OTP_SECRET).update(`${phone}:${otp}`).digest("hex");
}

export const otpService = {
  // Sends a new 6-digit OTP (one per minute, 5 per hour per phone, a daily SMS cap); a failed SMS can be retried at once.
  async send(phone: string) {
    const canSend = await redis.set(`otp:gap:${phone}`, "1", "EX", RESEND_WAIT_SECONDS, "NX");
    if (!canSend) throw new AppError("Please wait a minute before requesting a new OTP", 429);

    if ((await countInWindow(`otp:hour:${phone}`, 3600)) > MAX_SEND_PER_HOUR) {
      throw new AppError("Too many OTP requests. Try again after 1 hour.", 429);
    }
    const today = new Date().toISOString().slice(0, 10);
    if ((await countInWindow(`otp:day:${today}`, 2 * 24 * 3600)) > env.DAILY_SMS_CAP) {
      throw new AppError("OTP service busy. Please try again later.", 503);
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    await redis
      .multi()
      .hset(`otp:${phone}`, { code: hashOtp(phone, otp), wrong: 0 })
      .expire(`otp:${phone}`, OTP_VALID_SECONDS)
      .exec();
    await sendOtpSms(phone, otp).catch(async (error) => {
      await redis.del(`otp:gap:${phone}`).catch(() => null);
      throw error;
    });
  },

  // Checks the OTP; it works once, and 3 wrong tries delete it.
  async verify(phone: string, otp: string) {
    const result = Number(await redis.eval(CHECK_OTP_SCRIPT, 1, `otp:${phone}`, hashOtp(phone, otp), MAX_WRONG_TRIES));
    if (result === 1) return;
    if (result === 0) throw new AppError("OTP expired or not requested", 400);
    if (result === -2) throw new AppError("Too many wrong attempts. Request a new OTP.", 400);
    throw new AppError("Invalid OTP", 400);
  },
};
