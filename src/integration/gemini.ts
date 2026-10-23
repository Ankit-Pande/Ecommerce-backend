import { env } from "../config/env";
import { logger } from "../config/winston";
import { AppError } from "../utils/appError";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
const EMBEDDING_SIZE = 768;

export const geminiReady = Boolean(env.GEMINI_API_KEY);

export type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
export type GeminiTool = { name: string; description: string; parameters?: Record<string, unknown> };

// Sends one POST to the Gemini API (15 second timeout) and turns failures into friendly errors.
async function callGemini<T>(path: string, body: unknown): Promise<T> {
  if (!env.GEMINI_API_KEY) throw new AppError("AI assistant is not configured", 503);

  const response = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 429) {
    throw new AppError("AI is busy right now, please try again in a minute", 429);
  }
  if (!response.ok) {
    const details = (await response.text()).slice(0, 300);
    logger.warn("Gemini request failed", { path, status: response.status, body: details });
    throw new AppError(`AI service error (${response.status})`, 503);
  }
  return (await response.json()) as T;
}

// Turns texts into 768-number vectors (products use RETRIEVAL_DOCUMENT, shopper questions RETRIEVAL_QUERY).
export async function embedTexts(texts: string[], task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"): Promise<number[][]> {
  const requests = texts.map((text) => ({
    model: `models/${env.GEMINI_EMBED_MODEL}`,
    content: { parts: [{ text }] },
    taskType: task,
    outputDimensionality: EMBEDDING_SIZE,
  }));
  const data = await callGemini<{ embeddings: { values: number[] }[] }>(
    `${env.GEMINI_EMBED_MODEL}:batchEmbedContents`,
    { requests },
  );
  return data.embeddings.map((embedding) => embedding.values);
}

// Asks the chat model once with the conversation and tools; returns its text or tool calls.
export async function chatOnce(system: string, contents: GeminiContent[], tools: GeminiTool[]): Promise<GeminiPart[]> {
  const data = await callGemini<{ candidates?: { content?: { parts?: GeminiPart[] } }[] }>(
    `${env.GEMINI_CHAT_MODEL}:generateContent`,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: tools }],
      generationConfig: { maxOutputTokens: 1024 },
    },
  );
  return data.candidates?.[0]?.content?.parts ?? [];
}
