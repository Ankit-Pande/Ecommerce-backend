import { z } from "zod";
import { AGE_GROUPS, csv, GENDERS, page, queryBoolean, slug } from "./common";
import { titleCase } from "../utils/text";

// "tv", "ac", "lg" asli search hain. 2 akshar par trigram index nahi lagta, par aise
// queries gine-chune hain aur cache me baith jaati hain — khatra lambe random text se hai.
const searchText = z.string().trim().min(2).max(80);

// Sidebar ke filter options sirf category ke hisaab se (search text se nahi badalte).
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
      // DB me colour Title Case me hai — URL se "red" aaye to bhi match ho.
      color: csv(z.string().min(1).max(40).transform(titleCase)).optional(),
      gender: csv(z.enum(GENDERS)).optional(),
      ageGroup: csv(z.enum(AGE_GROUPS)).optional(),
      // Paise me — /catalog/filters bhi paise deta hai, dono ek jaisa rahe.
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
