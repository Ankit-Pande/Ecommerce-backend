-- A product can come in many colours and sizes; the old single colour moves into the list.
ALTER TABLE "Product" ADD COLUMN "colors" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Product" ADD COLUMN "sizes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
UPDATE "Product" SET "colors" = ARRAY["color"] WHERE "color" IS NOT NULL;

DROP INDEX "Product_searchText_idx";
ALTER TABLE "Product" DROP COLUMN "searchText";
DROP INDEX "Product_color_idx";
ALTER TABLE "Product" DROP COLUMN "color";

ALTER TABLE "Product" ADD COLUMN "searchText" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("name", '') || ' ' || coalesce("specs"::text, ''))) STORED;
CREATE INDEX "Product_searchText_idx" ON "Product" USING GIN ("searchText");
CREATE INDEX "Product_colors_idx" ON "Product" USING GIN ("colors");

-- Cart and order remember the chosen size and colour ('' = product has no such option).
ALTER TABLE "CartItem" ADD COLUMN "size" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CartItem" ADD COLUMN "color" TEXT NOT NULL DEFAULT '';
DROP INDEX "CartItem_cartId_productId_key";
CREATE UNIQUE INDEX "CartItem_cartId_productId_size_color_key" ON "CartItem"("cartId", "productId", "size", "color");

ALTER TABLE "OrderItem" ADD COLUMN "size" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "color" TEXT;
