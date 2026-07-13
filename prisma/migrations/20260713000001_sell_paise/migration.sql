-- Selling price (discount ke baad) alag column me — price filter/sort isi pe hote hain
-- (Flipkart/Amazon selling price pe filter karte hain, MRP pe nahi).
-- Trigger pricePaise/discountPercent badalte hi sellPaise + searchVector dono refresh karta hai.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "sellPaise" INTEGER NOT NULL DEFAULT 0;

-- Trigger function extend: searchVector ke saath sellPaise bhi set karo.
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

  NEW."sellPaise" := NEW."pricePaise" - ROUND(NEW."pricePaise" * NEW."discountPercent" / 100.0)::int;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Price/discount badalne pe bhi trigger chale.
DROP TRIGGER IF EXISTS product_search_vector_trigger ON "Product";
CREATE TRIGGER product_search_vector_trigger
  BEFORE INSERT OR UPDATE OF name, description, color, "brandId", "categoryId", "pricePaise", "discountPercent" ON "Product"
  FOR EACH ROW EXECUTE FUNCTION product_search_vector_update();

-- Backfill saare existing rows (dummy update se trigger fire hota hai).
UPDATE "Product" SET "pricePaise" = "pricePaise";

-- Storefront sort/filter index.
CREATE INDEX IF NOT EXISTS "Product_isActive_sellPaise_idx"
  ON "Product" ("isActive", "sellPaise");
