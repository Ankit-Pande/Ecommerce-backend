import { z } from "zod";

// Chat message + optional history (frontend last 6 bhejta hai — koi chat history
// table nahi, plan ke mutabik stateless).
export const chatSchema = z.object({
  body: z.object({
    // Blank/adha-adhura (min 2) reject + script/HTML injection wala text reject.
    message: z
      .string()
      .trim()
      .min(2, "Question too short")
      .max(500)
      .refine((v) => !/<\s*script|<\s*\/|javascript:/i.test(v), "Invalid characters in question"),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "model"]),
          text: z.string().max(1000),
        })
      )
      .max(10)
      .default([]),
    // "Aur dikhao" ka page number (0 = pehle 5 products).
    offset: z.coerce.number().int().min(0).max(20).default(0),
  }),
});
