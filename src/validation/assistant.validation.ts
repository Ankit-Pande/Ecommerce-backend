import { z } from "zod";

// HTML tag, control character, "....." jaisa repeat aur faltu space hatao.
const cleanText = (text: string) =>
  text
    .replace(/<[^>]*>/g, " ")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/([^\w\s])\1{2,}/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

const message = z
  .object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(2000).transform(cleanText).pipe(z.string().min(1).max(1000)),
  })
  .strict();

export const chatSchema = z.object({
  body: z
    .object({
      messages: z
        .array(message)
        .min(1)
        .max(30)
        .transform((list) => list.slice(-10))
        .refine((list) => {
          const last = list[list.length - 1];
          return last.role === "user" && last.content.length >= 2 && last.content.length <= 500;
        }, "Question must be 2 to 500 characters"),
      page: z.number().int().min(0).max(9).default(0),
      confirm: z.boolean().optional(),
    })
    .strict(),
});
