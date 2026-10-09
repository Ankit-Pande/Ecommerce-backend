import { env } from "../config/env";
import { countInWindow, redis } from "../config/redis";
import { AppError } from "../utils/appError";
import { generateOtp, hashOtp } from "../utils/otp";
import { sendOtpSms } from "../integration/msg91";

const OTP_VALID_SECONDS = 120;
const WAIT_BEFORE_RESEND_SECONDS = 60;
const ONE_HOUR = 3600;
const MAX_SEND_PER_HOUR = 5;
const MAX_WRONG_TRIES = 3;

const otpKey = (phone: string) => `otp:${phone}`;

const CHECK_OTP_SCRIPT = `
local code = redis.call('HGET', KEYS[1], 'code')
if not code then return 0 end
if code == ARGV[1] then redis.call('DEL', KEYS[1]) return 1 end
if redis.call('HINCRBY', KEYS[1], 'wrong', 1) >= tonumber(ARGV[2]) then redis.call('DEL', KEYS[1]) return -2 end
return -1`;

export const otpService = {
  // OTP bhejo: do OTP ke beech 60 second, ek ghante me 5, aur poore din ki SMS limit; OTP 2 minute chalega.
  async send(phone: string): Promise<void> {
    const canSend = await redis.set(`otp:gap:${phone}`, "1", "EX", WAIT_BEFORE_RESEND_SECONDS, "NX");
    if (!canSend) throw new AppError("Please wait a minute before requesting a new OTP", 429);

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
      .expire(otpKey(phone), OTP_VALID_SECONDS)
      .exec();
    await sendOtpSms(phone, otp);
  },

  // OTP check (Redis me ek hi baar me): 1 = sahi, 0 = OTP hai hi nahi, -1 = galat, -2 = 3 baar galat (OTP mit gaya).
  async verify(phone: string, otp: string): Promise<void> {
    const result = Number(await redis.eval(CHECK_OTP_SCRIPT, 1, otpKey(phone), hashOtp(phone, otp), MAX_WRONG_TRIES));
    if (result === 1) return;
    if (result === 0) throw new AppError("OTP expired or not requested", 400);
    if (result === -2) throw new AppError("Too many wrong attempts. Request a new OTP.", 400);
    throw new AppError("Invalid OTP", 400);
  },
};
