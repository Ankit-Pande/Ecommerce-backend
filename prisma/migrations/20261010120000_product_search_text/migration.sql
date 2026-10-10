ALTER TABLE "Product" ADD COLUMN "searchText" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("name", '') || ' ' || coalesce("color", ''))) STORED;

CREATE INDEX "Product_searchText_idx" ON "Product" USING GIN ("searchText");
