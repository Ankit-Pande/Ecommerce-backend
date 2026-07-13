-- Full-text search ke liye tsvector column + auto-update trigger + GIN index.
-- Prisma schema me tsvector native nahi, isliye yeh manual migration.
-- name + description dono se search vector banta hai (name ka weight zyada = 'A').

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "searchVector" tsvector;

-- Trigger function: insert/update pe searchVector apne aap bharo.
CREATE OR REPLACE FUNCTION product_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_search_vector_trigger ON "Product";
CREATE TRIGGER product_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_search_vector_update();

-- Purane rows (agar koi ho) ke liye ek baar backfill.
UPDATE "Product" SET "searchVector" =
  setweight(to_tsvector('simple', coalesce(name, '')), 'A') ||
  setweight(to_tsvector('simple', coalesce(description, '')), 'B');

-- GIN index — full-text search 50k+ products pe fast.
CREATE INDEX IF NOT EXISTS "Product_searchVector_idx"
  ON "Product" USING GIN ("searchVector");
