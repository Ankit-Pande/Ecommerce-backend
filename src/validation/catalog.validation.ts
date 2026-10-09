import { z } from "zod";
import { AGE_GROUPS, commaList, GENDERS, pageParams, queryBoolean, slug } from "./common";
import { titleCase } from "../utils/text";

const searchText = z.string().trim().min(2).max(80);

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
      brand: commaList(slug).optional(),
      color: commaList(z.string().min(1).max(40).transform(titleCase)).optional(),
      gender: commaList(z.enum(GENDERS)).optional(),
      ageGroup: commaList(z.enum(AGE_GROUPS)).optional(),
      minPricePaise: z.coerce.number().int().min(0).max(1000000000).optional(),
      maxPricePaise: z.coerce.number().int().min(0).max(1000000000).optional(),
      discount: queryBoolean.optional(),
      sort: z.enum(["latest", "price_asc", "price_desc", "discount", "rating"]).default("latest"),
      ...pageParams(),
    })
    .refine(
      (q) => q.minPricePaise === undefined || q.maxPricePaise === undefined || q.minPricePaise <= q.maxPricePaise,
      { message: "minPricePaise cannot be greater than maxPricePaise" },
    ),
});
