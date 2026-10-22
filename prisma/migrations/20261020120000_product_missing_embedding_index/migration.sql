-- The embedding job looks every minute for active products without an embedding; this keeps that lookup instant.
CREATE INDEX "Product_missing_embedding_idx" ON "Product" ("id") WHERE "embedding" IS NULL AND "isActive";
