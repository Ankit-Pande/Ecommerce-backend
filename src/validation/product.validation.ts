import { z } from "zod";
import { commaList, pageParams, slug } from "./common";

export const productSlugSchema = z.object({
  params: z.object({ slug }),
});

export const batchProductSchema = z.object({
  query: z.object({ slugs: commaList(slug, 10) }),
});

export const listReviewSchema = z.object({
  params: z.object({ slug }),
  query: z.object(pageParams(10)),
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
