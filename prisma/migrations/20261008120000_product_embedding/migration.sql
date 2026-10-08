CREATE EXTENSION IF NOT EXISTS "vector";

ALTER TABLE "Product" ADD COLUMN "embedding" halfvec(768);

CREATE INDEX "Product_embedding_idx" ON "Product" USING hnsw ("embedding" halfvec_cosine_ops);
