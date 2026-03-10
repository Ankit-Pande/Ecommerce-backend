/*
  Warnings:

  - You are about to alter the column `price` on the `products` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.
  - You are about to alter the column `discountPrice` on the `products` table. The data in that column could be lost. The data in that column will be cast from `DoublePrecision` to `Decimal(65,30)`.

*/
-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "embedding" vector(768),
ALTER COLUMN "price" SET DATA TYPE DECIMAL(65,30),
ALTER COLUMN "discountPrice" SET DATA TYPE DECIMAL(65,30);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "aiTokenCount" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "tokenResetAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
