import { z } from "zod";
import { AGE_GROUPS, commaList, GENDERS, pageParams, queryBoolean, slug } from "./common";
import { titleCase } from "../utils/text";

export const catalogSchema = z.object({
  query: z
    .object({
      q: z.string().trim().min(2).max(80).optional(),
      category: slug.optional(),
      subcategory: slug.optional(),
      section: z.enum(["trending", "featured"]).optional(),
      brand: commaList(slug).optional(),
      color: commaList(z.string().min(1).max(40).transform(titleCase)).optional(),
      size: commaList(z.string().min(1).max(30)).optional(),
      gender: commaList(z.enum(GENDERS)).optional(),
      ageGroup: commaList(z.enum(AGE_GROUPS)).optional(),
      minPricePaise: z.coerce.number().int().min(0).max(1000000000).optional(),
      maxPricePaise: z.coerce.number().int().min(0).max(1000000000).optional(),
      discount: queryBoolean.optional(),
      minRating: z.coerce.number().min(0).max(5).optional(),
      sort: z.enum(["latest", "price_asc", "price_desc", "discount", "rating"]).optional(),
      ...pageParams(),
    })
    .refine(
      (query) =>
        query.minPricePaise === undefined ||
        query.maxPricePaise === undefined ||
        query.minPricePaise <= query.maxPricePaise,
      { message: "minPricePaise cannot be greater than maxPricePaise" },
    ),
});
