-- Facets (category ke brands/colors) DISTINCT queries ke liye composite indexes —
-- 1 lakh+ products pe cold facets 5.5s se ~100ms pe aata hai.
CREATE INDEX IF NOT EXISTS "Product_categoryId_brandId_idx"
  ON "Product" ("categoryId", "brandId");
CREATE INDEX IF NOT EXISTS "Product_categoryId_color_idx"
  ON "Product" ("categoryId", "color");

-- Non-visual categories (grocery, books, personal/baby care) me color ka matlab nahi —
-- wahan color filter dikhna hi nahi chahiye (dal/atta ka color filter bekar hai).
UPDATE "Product" p SET color = NULL
FROM "Category" c
WHERE p."categoryId" = c.id
  AND c.slug IN (
    'staples', 'snacks-beverages', 'fiction', 'non-fiction',
    'childrens-books', 'personal-care', 'baby-care'
  )
  AND p.color IS NOT NULL;
