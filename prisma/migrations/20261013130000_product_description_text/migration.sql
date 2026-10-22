-- Words in the description (use, occasion, features) are searchable too.
ALTER TABLE "Product" ADD COLUMN "descriptionText" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', "description")) STORED;
CREATE INDEX "Product_descriptionText_idx" ON "Product" USING GIN ("descriptionText");
