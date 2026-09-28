import { z } from "zod";
import { AGE_GROUPS, csv, GENDERS, page, queryBoolean, slug } from "./common";
import { titleCase } from "../utils/text";

// Search 2 se 80 akshar ("tv", "ac" bhi chalein).
const searchText = z.string().trim().min(2).max(80);

// Sidebar ke filter options (category ke hisaab se).
export const catalogFiltersSchema = z.object({
  query: z.object({
    category: slug.optional(),
    subcategory: slug.optional(),
  }),
});

export const catalogSchema = z.object({
  query: z
    .object({
      q: searchText.optional(),
      category: slug.optional(),
      subcategory: slug.optional(),
      section: z.enum(["trending", "featured"]).optional(),
      brand: csv(slug).optional(),
      color: csv(z.string().min(1).max(40).transform(titleCase)).optional(),
      gender: csv(z.enum(GENDERS)).optional(),
      ageGroup: csv(z.enum(AGE_GROUPS)).optional(),
      minPricePaise: z.coerce.number().int().min(0).max(1000000000).optional(),
      maxPricePaise: z.coerce.number().int().min(0).max(1000000000).optional(),
      discount: queryBoolean.optional(),
      sort: z.enum(["latest", "price_asc", "price_desc", "discount", "rating"]).default("latest"),
      ...page(),
    })
    .refine(
      (q) =>
        q.minPricePaise === undefined ||
        q.maxPricePaise === undefined ||
        q.minPricePaise <= q.maxPricePaise,
      { message: "minPricePaise cannot be greater than maxPricePaise" },
    ),
});
