import { env } from "../config/env";
import { countInWindow, redis } from "../config/redis";
import { AppError } from "../utils/appError";
import { generateOtp, hashOtp } from "../utils/otp";
import { sendOtpSms } from "../integration/msg91";

// OTP 2 min valid, do OTP ke beech 60 sec, ghante me 5, 3 galat par code khatam.
const OTP_TTL = 120;
const RESEND_GAP = 60;
const ONE_HOUR = 3600;
const MAX_SEND_PER_HOUR = 5;
const MAX_WRONG = 3;

const otpKey = (phone: string) => `otp:${phone}`;

// OTP ek hi baar me check karo: sahi ho ya 3 baar galat, dono par OTP mita do (andaza laga kar koi login na kare).
const VERIFY_SCRIPT = `
local code = redis.call('HGET', KEYS[1], 'code')
if not code then return 0 end
if code == ARGV[1] then redis.call('DEL', KEYS[1]) return 1 end
if redis.call('HINCRBY', KEYS[1], 'wrong', 1) >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) return -2 end
return -1`;

export const otpService = {
  // OTP bhejo: 60 sec gap, ghante me 5, roz ki SMS limit.
  async send(phone: string): Promise<void> {
    const allowed = await redis.set(`otp:gap:${phone}`, "1", "EX", RESEND_GAP, "NX");
    if (!allowed) throw new AppError("Please wait a minute before requesting a new OTP", 429);

    if ((await countInWindow(`otp:hour:${phone}`, ONE_HOUR)) > MAX_SEND_PER_HOUR) {
      throw new AppError("Too many OTP requests. Try again after 1 hour.", 429);
    }
    const today = new Date().toISOString().slice(0, 10);
    if ((await countInWindow(`otp:day:${today}`, 2 * 24 * 3600)) > env.DAILY_SMS_CAP) {
      throw new AppError("OTP service busy. Please try again later.", 503);
    }

    const otp = generateOtp();
    await redis
      .multi()
      .hset(otpKey(phone), { code: hashOtp(phone, otp), wrong: 0 })
      .expire(otpKey(phone), OTP_TTL)
      .exec();
    await sendOtpSms(phone, otp);
  },

  // OTP sahi hai ya nahi.
  async verify(phone: string, otp: string): Promise<void> {
    const result = Number(await redis.eval(VERIFY_SCRIPT, 1, otpKey(phone), hashOtp(phone, otp), MAX_WRONG));
    if (result === 1) return;
    if (result === 0) throw new AppError("OTP expired or not requested", 400);
    if (result === -2) throw new AppError("Too many wrong attempts. Request a new OTP.", 400);
    throw new AppError("Invalid OTP", 400);
  },
};
