CREATE TYPE "CancelledBy" AS ENUM ('USER', 'ADMIN', 'SYSTEM');

ALTER TABLE "Order" ADD COLUMN "cancelledBy" "CancelledBy";
