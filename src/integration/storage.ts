import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { AppError } from "../utils/appError";
import { logger } from "../config/winston";

// Product/category/banner images -> Cloudinary. DB me sirf URL save hota hai.
// multer-storage-cloudinary hata diya (cloudinary v2 ke saath install hi fail hota tha) —
// ab memoryStorage + seedha upload_stream. Ek dependency kam, wahi kaam.
cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

// Cloudinary configured hai ya nahi. Nahi hai (dev/demo) to local disk pe save karte hain
// taaki admin image upload bina Cloudinary account ke bhi chale.
const cloudinaryReady = Boolean(
  env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET
);

// Local uploads folder (Cloudinary fallback). app.ts isse /uploads pe serve karta hai.
export const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const PUBLIC_BASE = process.env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`;

// Buffer ke magic bytes se extension detect (mimetype yahan available nahi hota).
function extFromBuffer(buf: Buffer): string {
  if (buf[0] === 0x89 && buf[1] === 0x50) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8) return "jpg";
  if (buf.length > 11 && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  return "jpg";
}

function saveLocally(buffer: Buffer): string {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.${extFromBuffer(buffer)}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buffer);
  return `${PUBLIC_BASE}/uploads/${name}`;
}

const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

const fileFilter: multer.Options["fileFilter"] = (_req, file, cb) => {
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(
      new AppError("Only jpg, jpeg, png and webp images are allowed", 400)
    );
  }
  return cb(null, true);
};

// max 2MB per image. MulterError (size/type) error.ts central handler pakadta hai.
export const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

// Buffer -> Cloudinary -> URL. Controller validate ke BAAD isko call karta hai
// (galat data pe image upload hi na ho).
export function uploadImage(buffer: Buffer): Promise<string> {
  // Cloudinary nahi hai to local disk pe save (dev/demo). URL DB me wahi jaata hai.
  if (!cloudinaryReady) {
    try {
      return Promise.resolve(saveLocally(buffer));
    } catch (err) {
      logger.error("Local image save failed", { err });
      return Promise.reject(new AppError("Image upload failed, try again", 502));
    }
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "ecommerce", resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          return reject(new AppError("Image upload failed, try again", 502));
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}
