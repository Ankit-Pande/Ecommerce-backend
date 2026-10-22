import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

const IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const PNG_START = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
});

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  // Accepts only jpg, png and webp uploads.
  fileFilter: (_req, file, callback) => {
    if (!IMAGE_TYPES.includes(file.mimetype)) {
      return callback(new AppError("Only jpg, png and webp images are allowed", 400));
    }
    callback(null, true);
  },
});

// Checks the file bytes really are a jpg, png or webp image, uploads it to Cloudinary and returns its URL.
export function uploadImage(buffer: Buffer): Promise<string> {
  const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  const isPng = buffer.subarray(0, 8).equals(PNG_START);
  const isWebp = buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  if (!isJpeg && !isPng && !isWebp) return Promise.reject(new AppError("Invalid image content", 400));

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

// Uploads all files of a request and returns their URLs in the same order.
export function uploadFiles(files: Express.Multer.File[] | undefined): Promise<string[]> {
  return Promise.all((files ?? []).map((file) => uploadImage(file.buffer)));
}
