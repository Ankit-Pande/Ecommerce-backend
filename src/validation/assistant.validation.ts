import { z } from "zod";

const MAX_QUESTION_LENGTH = 300;
const MAX_LINES = 2;
const HTML = /<[^>]*>|javascript:|\bon\w+\s*=/i;
const TWO_LETTERS = /[a-zऀ-ॿ].*[a-zऀ-ॿ]/i;

// Removes tags, control characters, repeated symbols and extra spaces from a chat message.
function cleanText(text: string) {
  return text
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/([^\w\s])\1{2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

// Returns why the last message cannot be asked, or null when it is fine.
function questionError(message: { role: string; content: string }) {
  if (message.role !== "user") return "Last message must be a question";
  if (HTML.test(message.content)) return "HTML or script is not allowed";
  if (message.content.split("\n").length > MAX_LINES) return `Write the question in at most ${MAX_LINES} lines`;
  const text = cleanText(message.content);
  if (text.length < 2 || text.length > MAX_QUESTION_LENGTH) {
    return `Question must be 2 to ${MAX_QUESTION_LENGTH} characters`;
  }
  if (!TWO_LETTERS.test(text)) return "Write the question in words";
  return null;
}

const message = z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) }).strict();

export const chatSchema = z.object({
  body: z
    .object({
      messages: z
        .array(message)
        .min(1)
        .max(30)
        .superRefine((list, context) => {
          const error = questionError(list[list.length - 1]);
          if (error) context.addIssue({ code: "custom", message: error });
        })
        .transform((list) =>
          list
            .slice(-20)
            .map(({ role, content }) => ({ role, content: cleanText(content).slice(0, 1000) }))
            .filter((item) => item.content.length > 0),
        ),
      confirm: z.boolean().optional(),
    })
    .strict(),
});
