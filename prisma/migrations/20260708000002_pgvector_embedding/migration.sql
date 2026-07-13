-- AI semantic search ke liye pgvector (Postgres ke andar hi, alag vector DB nahi).
-- Supabase pe extension pehle se available hai, bas enable karna hai.
CREATE EXTENSION IF NOT EXISTS vector;

-- Gemini text-embedding-004 = 768 dimensions.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "embedding" vector(768);

-- HNSW index — cosine distance pe fast nearest-neighbor (50k+ products ke liye sahi).
CREATE INDEX IF NOT EXISTS "Product_embedding_idx"
  ON "Product" USING hnsw ("embedding" vector_cosine_ops);
