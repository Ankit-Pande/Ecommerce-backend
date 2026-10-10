ALTER TABLE "Product" ADD COLUMN "specs" JSONB;

DROP INDEX "Product_searchText_idx";
ALTER TABLE "Product" DROP COLUMN "searchText";
ALTER TABLE "Product" ADD COLUMN "searchText" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("name", '') || ' ' || coalesce("color", '') || ' ' || coalesce("specs"::text, ''))) STORED;

CREATE INDEX "Product_searchText_idx" ON "Product" USING GIN ("searchText");
