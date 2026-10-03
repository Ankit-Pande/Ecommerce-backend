import { z } from "zod";
import { csv, page, slug } from "./common";

export const productSlugSchema = z.object({
  params: z.object({ slug }),
});

// Kai product ek saath: ?slugs=a,b,c (max 10)
export const batchProductSchema = z.object({
  query: z.object({ slugs: csv(slug, 10) }),
});

export const listReviewSchema = z.object({
  params: z.object({ slug }),
  query: z.object(page(10)),
});

export const saveReviewSchema = z.object({
  params: z.object({ slug }),
  body: z
    .object({
      rating: z.number({ required_error: "Please select a star rating" }).int().min(1).max(5),
      comment: z.string().trim().min(3).max(1000).optional(),
    })
    .strict(),
});
