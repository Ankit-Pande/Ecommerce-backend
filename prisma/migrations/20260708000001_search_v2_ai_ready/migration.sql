-- Search v2: ab searchVector me name + brand + category + color + description sab hai.
-- "red nike shoes" jaisi query me color/brand/category bhi match honge.
-- Weight: name = A (sabse zyada), brand/category/color = B, description = C.

CREATE OR REPLACE FUNCTION product_search_vector_update() RETURNS trigger AS $$
DECLARE
  brand_name text;
  category_name text;
BEGIN
  SELECT name INTO brand_name FROM "Brand" WHERE id = NEW."brandId";
  SELECT name INTO category_name FROM "Category" WHERE id = NEW."categoryId";

  NEW."searchVector" :=
    setweight(to_tsvector('simple', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(brand_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(category_name, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.color, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Trigger ab color/brandId/categoryId badalne pe bhi chalega.
DROP TRIGGER IF EXISTS product_search_vector_trigger ON "Product";
CREATE TRIGGER product_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description, color, "brandId", "categoryId" ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_search_vector_update();

-- Backfill: name = name se trigger fire hota hai, saare rows ka vector fresh ban jaata hai.
UPDATE "Product" SET name = name;

-- AI assistant (baad me) ke liye reserved — abhi koi code use nahi karta.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "gender" TEXT;
