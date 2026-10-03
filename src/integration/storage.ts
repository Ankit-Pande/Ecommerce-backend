import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

// Image upload: memory me, max 2MB, sirf jpg/png/webp.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new AppError("Only jpg, png and webp images are allowed", 400));
    }
    cb(null, true);
  },
});

// File ke pehle bytes dekh kar check karo ki asli image hai (naam/type jhooth ho sakta hai).
function isRealImage(buffer: Buffer): boolean {
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const png = buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const webp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return jpeg || png || webp;
}

// Ek image Cloudinary par daalo, URL wapas lo.
export function uploadImage(buffer: Buffer): Promise<string> {
  if (!isRealImage(buffer)) return Promise.reject(new AppError("Invalid image content", 400));

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: "apnakart", resource_type: "image" },
      (error, result) => {
        if (error || !result) {
          logger.error("Cloudinary upload failed", { error });
          return reject(new AppError("Image upload failed, try again", 502));
        }
        resolve(result.secure_url);
      },
    );
    stream.end(buffer);
  });
}

// Saari files upload karo, URLs ki list wapas lo.
export async function uploadFiles(files: Express.Multer.File[] | undefined): Promise<string[]> {
  return Promise.all((files ?? []).map((file) => uploadImage(file.buffer)));
}
