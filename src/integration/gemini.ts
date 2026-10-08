import { env } from "../config/env";
import { AppError } from "../utils/appError";

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";
export const EMBED_SIZE = 768;

export const geminiReady = Boolean(env.GEMINI_API_KEY);

export type GeminiPart = {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
};
export type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };
export type GeminiTool = { name: string; description: string; parameters?: Record<string, unknown> };

// Gemini API ko request (15 sec me jawab na aaye to rok do).
async function callGemini<T>(path: string, body: unknown): Promise<T> {
  if (!env.GEMINI_API_KEY) throw new AppError("AI assistant is not configured", 503);
  const res = await fetch(`${BASE_URL}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new AppError(`AI service error (${res.status})`, 503);
  return (await res.json()) as T;
}

// Text ki list ka embedding (product save ke liye DOCUMENT, user ke sawal ke liye QUERY).
export async function embedTexts(texts: string[], task: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY") {
  const model = `models/${env.GEMINI_EMBED_MODEL}`;
  const data = await callGemini<{ embeddings: { values: number[] }[] }>(
    `${env.GEMINI_EMBED_MODEL}:batchEmbedContents`,
    {
      requests: texts.map((text) => ({
        model,
        content: { parts: [{ text }] },
        taskType: task,
        outputDimensionality: EMBED_SIZE,
      })),
    },
  );
  return data.embeddings.map((e) => e.values);
}

// Chat ka ek round: model ya to text dega ya function call.
export async function chatOnce(system: string, contents: GeminiContent[], tools: GeminiTool[]) {
  const data = await callGemini<{ candidates?: { content?: { parts?: GeminiPart[] } }[] }>(
    `${env.GEMINI_CHAT_MODEL}:generateContent`,
    {
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: tools }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
    },
  );
  return data.candidates?.[0]?.content?.parts ?? [];
}
