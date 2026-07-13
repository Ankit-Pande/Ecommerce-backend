import { z } from "zod";

// Profile update — naam aur email (email invoice bhejne ke kaam aayega).
export const updateMeSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(80).optional(),
    email: z.string().trim().toLowerCase().email().optional(),
  }),
});
