import { env } from "../config/env";
import { logger } from "../config/winston";

// Google Gemini FREE tier — REST API se (SDK nahi, ek dependency kam).
// Key na ho to app chalti rahegi: embeddings skip, assistant lite mode me.
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";
// Models env se badle ja sakte hain. Defaults key pe LIVE verify kiye hue hain:
// - chat: gemini-flash-lite-latest (2.0-flash free quota band ho chuki — 429 deta tha)
// - embed: gemini-embedding-001 (text-embedding-004 retire — 404 deta tha),
//   outputDimensionality: 768 — DB ka vector(768) column isi size ka hai.
const CHAT_MODEL = process.env.GEMINI_CHAT_MODEL ?? "gemini-flash-lite-latest";
const EMBED_MODEL = process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001";
const EMBED_DIMS = 768;

export const geminiEnabled = (): boolean => !!env.GEMINI_API_KEY;

// Text -> 768-dim embedding (semantic search ke liye).
export async function embedText(text: string): Promise<number[] | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const res = await fetch(
      `${BASE}/${EMBED_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: `models/${EMBED_MODEL}`,
          content: { parts: [{ text: text.slice(0, 8000) }] },
          outputDimensionality: EMBED_DIMS,
        }),
      }
    );
    if (!res.ok) {
      logger.warn(`Gemini embed failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as { embedding?: { values?: number[] } };
    return data.embedding?.values ?? null;
  } catch (err) {
    logger.warn("Gemini embed error", { err });
    return null;
  }
}

// 100 texts ek call me — 1 lakh products ka backfill 1000 calls me ho jaata hai
// (one-by-one me 1,00,000 calls lagti — free tier pe ghanton ka kaam).
export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  if (!env.GEMINI_API_KEY || texts.length === 0) return texts.map(() => null);
  try {
    const res = await fetch(
      `${BASE}/${EMBED_MODEL}:batchEmbedContents?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requests: texts.map((t) => ({
            model: `models/${EMBED_MODEL}`,
            content: { parts: [{ text: t.slice(0, 8000) }] },
            outputDimensionality: EMBED_DIMS,
          })),
        }),
      }
    );
    if (!res.ok) {
      logger.warn(`Gemini batch embed failed: ${res.status}`);
      return texts.map(() => null);
    }
    const data = (await res.json()) as { embeddings?: { values?: number[] }[] };
    return texts.map((_, i) => data.embeddings?.[i]?.values ?? null);
  } catch (err) {
    logger.warn("Gemini batch embed error", { err });
    return texts.map(() => null);
  }
}

// Chat reply — system prompt + recent history + user message.
export async function generateReply(
  system: string,
  history: { role: "user" | "model"; text: string }[],
  message: string
): Promise<string | null> {
  if (!env.GEMINI_API_KEY) return null;
  try {
    const res = await fetch(
      `${BASE}/${CHAT_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [
            ...history.map((h) => ({ role: h.role, parts: [{ text: h.text }] })),
            { role: "user", parts: [{ text: message }] },
          ],
          generationConfig: { maxOutputTokens: 400, temperature: 0.4 },
        }),
      }
    );
    if (!res.ok) {
      logger.warn(`Gemini chat failed: ${res.status}`);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    logger.warn("Gemini chat error", { err });
    return null;
  }
}
