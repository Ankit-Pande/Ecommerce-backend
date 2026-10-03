import { z } from "zod";
import { phone } from "./common";

export const updateMeSchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(80).optional(),
      email: z.string().trim().toLowerCase().email().optional(),
      alternatePhone: phone.nullable().optional(),
    })
    .strict(),
});
