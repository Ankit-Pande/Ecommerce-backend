import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { getOrSetCache, redis } from "../config/redis";
import { logger } from "../config/winston";
import { embedTexts, geminiReady } from "../integration/gemini";
import { productCard } from "../utils/price";
import { readBudget } from "./catalog.service";

export const PAGE_SIZE = 5;
const MAX_RESULTS = 50;
const MAX_WORDS = 8;
const MAX_DISTANCE = 0.45;
const QUERY_VECTOR_SECONDS = 7 * 24 * 3600;

type Sort = "latest" | "price_asc" | "price_desc" | "rating" | "discount";

export type Question = {
  text: string;
  words: string[];
  brandIds?: string[];
  categoryIds?: string[];
  categoryNames?: string[];
  colors?: string[];
  gender?: string[];
  ageGroup?: string;
  size?: string;
  minPaise?: number;
  maxPaise?: number;
  sort?: Sort;
  discount?: boolean;
  trending?: boolean;
  featured?: boolean;
};

type CardRow = Parameters<typeof productCard>[0] & { gender: string | null; ageGroup: string | null };
export type Card = ReturnType<typeof productCard> & { gender: string | null; ageGroup: string | null };

const WHO = [
  { pattern: /\b(boys?|ladk[ae]|beta)\b/, gender: ["Men", "Unisex"], ageGroup: "Kids" },
  { pattern: /\b(girls?|ladki|ladkiyon|beti)\b/, gender: ["Women", "Unisex"], ageGroup: "Kids" },
  {
    pattern:
      /\b(kids?|child|children|baby|babies|ba(?:c|ch)+(?:a|e|on|o)|toddlers?|(?:[1-9]|1[0-2])\s*(?:years?|yrs?|saal|sal)\s*(?:old|ka|ki|ke))\b/,
    ageGroup: "Kids",
  },
  {
    pattern: /\b(women|woman|womens|female|ladies|lady|mahila|aurat|wife|mummy|mom|maa|didi|behen|sister)\b/,
    gender: ["Women", "Unisex"],
    ageGroup: "Adult",
  },
  {
    pattern: /\b(men|man|mens|male|gents|purush|husband|papa|dad|bhai|brother)\b/,
    gender: ["Men", "Unisex"],
    ageGroup: "Adult",
  },
  { pattern: /\b(adults?|elderly|senior|budh[ae]|dada|dadi|nana|nani)\b/, ageGroup: "Adult" },
];

const SORTS: { pattern: RegExp; sort: Sort }[] = [
  { pattern: /\b(sast[aeiy]|cheap|cheapest|lowest|budget)\b/, sort: "price_asc" },
  { pattern: /\b(mehe?ng[aei]|mahang[aei]|premium|expensive|costly)\b/, sort: "price_desc" },
  { pattern: /\b(best|top rated|ac+h+[aei]|good|rated|rating|badhiya|reviews?)\b/, sort: "rating" },
  { pattern: /\b(nay[aei]|new|latest|recent|recently|newest)\b/, sort: "latest" },
];

const SPECIALS: { pattern: RegExp; filter: "discount" | "trending" | "featured" }[] = [
  { pattern: /\b(offers?|discount|sale|deals?)\b/, filter: "discount" },
  { pattern: /\b(tr[ae]n?d+i?ng|trendy|popular)\b/, filter: "trending" },
  { pattern: /\bfeatured\b/, filter: "featured" },
];

const SIZE =
  /\b(?:size|uk)\s*(\d{1,2}|xxl|xl|xs|s|m|l)\b|\b(\d{1,2})\s*(?:number|no|size|uk)\b|\b(\d{1,2})\s*-\s*(\d{1,2})\s*(?:years?|yrs?|saal|sal)\b/;

const ALIASES: Record<string, string> = {
  mobile: "phone",
  mobiles: "phone",
  clothes: "clothing",
  kapde: "clothing",
  kapda: "clothing",
  joota: "shoe",
  joote: "shoe",
  juta: "shoe",
  jute: "shoe",
  chappal: "sandal",
  ghadi: "watch",
  kurti: "kurta",
  sari: "saree",
};

const PERSON_WORDS = new Set(["men", "women", "kid", "boy", "girl"]);

const FILLER = new Set(
  `mujhe muje mere mera meri hum humein hame liye ke ki ka ko se me mein main hai hain ho tha thi chahiye chaiye chahie
  chahta chahti chahte dikhao dikha dikhaiye dikhana dekhna dekho dekhiye batao bataiye bhejo show please plz pls kuch
  koi ek for an the want need looking some with wala wali wale nice aur and or ya bhi do de dena find search get buy
  kharidna lena is are am my to of in on at by from all any this that it very can you your have has what which kya kaun
  kaunsa kaunsi kaise kitna kitne kahan ye yeh wo woh isme usme products product item items saman samaan rupee rupees
  rupaye rupay rs hi hello hey namaste joda jodi jola pair number size no mast super cool stylish sundar beautiful
  awesome available milega milegi tak andar ander niche neeche upar price range list sab sabhi saare sare how many count
  smart`.split(/\s+/),
);

const SORT_SQL: Record<Sort, Prisma.Sql> = {
  latest: Prisma.sql`p."createdAt" DESC`,
  price_asc: Prisma.sql`p."sellPaise" ASC`,
  price_desc: Prisma.sql`p."sellPaise" DESC`,
  rating: Prisma.sql`p."ratingAverage" DESC`,
  discount: Prisma.sql`p."discountPercent" DESC`,
};

const CARD_COLUMNS = Prisma.sql`p."id", p."name", p."slug", p."images", p."pricePaise", p."discountPercent", p."offerEndsAt",
  p."stock", p."ratingSum", p."ratingCount", p."sizes", p."colors", p."gender", p."ageGroup"`;

const hashOf = (value: unknown) => createHash("sha1").update(JSON.stringify(value)).digest("hex");

const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/'s\b/g, "")
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter(Boolean);

const normalize = (word: string) =>
  (ALIASES[word] ?? word.replace(/(ch|sh|ss|x)es$/, "$1").replace(/([^s])s$/, "$1")).replace(/^smart(?=[a-z])/, "");

const keyOf = (name: string) =>
  wordsOf(name)
    .map(normalize)
    .filter((word) => !PERSON_WORDS.has(word) && word !== "smart");

function findMentioned<T extends { key: string[] }>(items: T[], asked: Set<string>): T[] {
  const found = items.filter(
    (item) => item.key.length > 0 && (item.key.every((word) => asked.has(word)) || asked.has(item.key.join(""))),
  );
  return found.filter(
    (item) =>
      !found.some((other) => other.key.length > item.key.length && item.key.every((word) => other.key.includes(word))),
  );
}

async function getVocabulary() {
  return getOrSetCache("ai:vocabulary", async () => {
    const [brands, categories, colors] = await Promise.all([
      prisma.brand.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true, parentId: true } }),
      prisma.$queryRaw<{ color: string }[]>`SELECT DISTINCT unnest("colors") AS color FROM "Product" WHERE "isActive"`,
    ]);
    return { brands, categories, colors: colors.map((row) => row.color) };
  });
}

export async function readQuestion(question: string): Promise<Question> {
  const budget = readBudget(question);
  const vocabulary = await getVocabulary();
  const q: Question = { text: budget.text, words: [] };
  if (budget.minPaise) q.minPaise = budget.minPaise;
  if (budget.maxPaise) q.maxPaise = budget.maxPaise;

  let text = budget.text.toLowerCase().replace(/(\d+)\s+(gb|tb|mah|mp|hz|w)\b/g, "$1$2");
  const size = text.match(SIZE);
  if (size) {
    q.size = size[3] ? `${size[3]}-${size[4]} Years` : (size[1] ?? size[2]).toUpperCase();
    text = text.replace(size[0], " ");
  }

  const askedWords = (value: string) =>
    wordsOf(value)
      .filter((word) => !FILLER.has(word))
      .map(normalize);
  const brands = findMentioned(
    vocabulary.brands.map((brand) => ({ ...brand, key: keyOf(brand.name) })),
    new Set(askedWords(text)),
  );
  const brandWords = brands.flatMap((brand) => [...brand.key, brand.key.join("")]);

  const who = WHO.find((item) => item.pattern.test(text));
  const sort = SORTS.find((item) => item.pattern.test(text));
  for (const item of SPECIALS) if (item.pattern.test(text)) q[item.filter] = true;
  for (const { pattern } of [...WHO, ...SORTS, ...SPECIALS]) text = text.replace(new RegExp(pattern, "g"), " ");

  const asked = new Set(askedWords(text).filter((word) => !brandWords.includes(word)));
  const take = <T extends { key: string[] }>(items: T[]) => {
    const found = findMentioned(items, asked);
    for (const item of found) [...item.key, item.key.join("")].forEach((word) => asked.delete(word));
    return found;
  };
  const colors = take(vocabulary.colors.map((name) => ({ name, key: keyOf(name) })));
  const categories = take(vocabulary.categories.map((category) => ({ ...category, key: keyOf(category.name) })));

  if (brands.length > 0) q.brandIds = brands.map((brand) => brand.id);
  if (colors.length > 0) q.colors = colors.map((color) => color.name);
  if (categories.length > 0) {
    const ids = categories.map((category) => category.id);
    const children = vocabulary.categories.filter((category) => category.parentId && ids.includes(category.parentId));
    q.categoryIds = [...new Set([...ids, ...children.map((category) => category.id)])];
    q.categoryNames = categories.map((category) =>
      category.name.replace(/\b(men|women|boys?|girls?|kids?)('s)?\s+/gi, ""),
    );
  }
  if (who) {
    if (who.gender) q.gender = who.gender;
    q.ageGroup = who.ageGroup;
  }
  if (sort) q.sort = sort.sort;
  else if (budget.bare) q.sort = "price_desc";

  q.words = [...asked].filter((word) => word.length >= 2 && !/^\d+$/.test(word)).slice(0, MAX_WORDS);
  return q;
}

function filterSql(q: Question): Prisma.Sql[] {
  const where = [
    Prisma.sql`p."isActive"`,
    Prisma.sql`EXISTS (SELECT 1 FROM "Category" c LEFT JOIN "Category" pc ON pc."id" = c."parentId"
      WHERE c."id" = p."categoryId" AND c."isActive" AND (pc."id" IS NULL OR pc."isActive"))`,
  ];
  if (q.brandIds) where.push(Prisma.sql`p."brandId" IN (${Prisma.join(q.brandIds)})`);
  if (q.categoryIds && q.categoryNames) {
    const byName = q.categoryNames.map((name) => Prisma.sql`p."searchText" @@ plainto_tsquery('english', ${name})`);
    where.push(Prisma.sql`(p."categoryId" IN (${Prisma.join(q.categoryIds)}) OR ${Prisma.join(byName, " OR ")})`);
  }
  if (q.colors) where.push(Prisma.sql`p."colors" && ARRAY[${Prisma.join(q.colors)}]::text[]`);
  if (q.gender) where.push(Prisma.sql`(p."gender" IN (${Prisma.join(q.gender)}) OR p."gender" IS NULL)`);
  if (q.ageGroup) where.push(Prisma.sql`(p."ageGroup" = ${q.ageGroup} OR p."ageGroup" IS NULL)`);
  if (q.minPaise) where.push(Prisma.sql`p."sellPaise" >= ${q.minPaise}`);
  if (q.maxPaise) where.push(Prisma.sql`p."sellPaise" <= ${q.maxPaise}`);
  if (q.discount) {
    where.push(Prisma.sql`p."discountPercent" > 0 AND (p."offerEndsAt" IS NULL OR p."offerEndsAt" > NOW())`);
  }
  if (q.trending) where.push(Prisma.sql`p."isTrending"`);
  if (q.featured) where.push(Prisma.sql`p."isFeatured"`);
  if (q.size) where.push(Prisma.sql`${q.size} ILIKE ANY(p."sizes")`);
  return where;
}

function toCard(row: CardRow): Card {
  return { ...productCard(row), gender: row.gender, ageGroup: row.ageGroup };
}

async function searchDb(q: Question): Promise<Card[]> {
  const where = filterSql(q);
  const rank = [SORT_SQL[q.sort ?? (q.discount ? "discount" : "latest")], Prisma.sql`p."id" DESC`];
  if (q.words.length > 0) {
    const matches = q.words.map((word) => Prisma.sql`p."searchText" @@ plainto_tsquery('english', ${word})`);
    const hits = Prisma.join(
      matches.map((match) => Prisma.sql`(${match})::int`),
      " + ",
    );
    const need = q.words.length <= 2 ? q.words.length : Math.ceil(q.words.length / 2);
    where.push(Prisma.sql`(${Prisma.join(matches, " OR ")})`, Prisma.sql`(${hits}) >= ${need}`);
    rank.unshift(Prisma.sql`(${hits}) DESC`);
  }
  const mixCategories = Prisma.sql`ROW_NUMBER() OVER (PARTITION BY p."categoryId" ORDER BY ${Prisma.join(rank, ", ")})`;
  const order = q.sort ? rank : [mixCategories, ...rank];

  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT ${CARD_COLUMNS} FROM "Product" p
    WHERE ${Prisma.join(where, " AND ")}
    ORDER BY ${Prisma.join(order, ", ")}
    LIMIT ${MAX_RESULTS}`;
  return rows.map(toCard);
}

async function queryVector(text: string): Promise<string> {
  const key = `ai:vector:${hashOf(text.toLowerCase())}`;
  const saved = await redis.get(key).catch(() => null);
  if (saved) return saved;

  const [values] = await embedTexts([text], "RETRIEVAL_QUERY");
  const vector = `[${values.join(",")}]`;
  await redis.set(key, vector, "EX", QUERY_VECTOR_SECONDS).catch(() => null);
  return vector;
}

async function searchByMeaning(q: Question): Promise<Card[]> {
  const vector = await queryVector(q.text);
  const where = [...filterSql(q), Prisma.sql`(p."embedding" <=> ${vector}::halfvec) < ${MAX_DISTANCE}`];

  const [, rows] = await prisma.$transaction([
    prisma.$executeRaw`SET LOCAL hnsw.iterative_scan = strict_order`,
    prisma.$queryRaw<CardRow[]>`
      SELECT ${CARD_COLUMNS} FROM "Product" p
      WHERE ${Prisma.join(where, " AND ")}
      ORDER BY p."embedding" <=> ${vector}::halfvec
      LIMIT ${MAX_RESULTS}`,
  ]);
  const cards = rows.map(toCard);

  if (q.sort === "price_asc") cards.sort((a, b) => a.finalPricePaise - b.finalPricePaise);
  if (q.sort === "price_desc") cards.sort((a, b) => b.finalPricePaise - a.finalPricePaise);
  if (q.sort === "rating") cards.sort((a, b) => b.rating.average - a.rating.average);
  if (q.sort === "discount") cards.sort((a, b) => b.discountPercent - a.discountPercent);
  return cards;
}

export async function findProducts(q: Question, page: number) {
  let cards = await getOrSetCache(`ai:db:${hashOf({ ...q, text: undefined })}`, () => searchDb(q));
  let similar = false;

  if (cards.length === 0 && q.words.length > 0 && geminiReady) {
    cards = await getOrSetCache(`ai:meaning:${hashOf(q)}`, () => searchByMeaning(q)).catch((error) => {
      logger.warn("Meaning search failed", { error: error.message });
      return [];
    });
    similar = true;
  }

  const genders = new Set(cards.map((card) => card.gender));
  const ages = new Set(cards.map((card) => card.ageGroup));
  const isMixed = (genders.has("Men") && genders.has("Women")) || (ages.has("Kids") && ages.has("Adult"));

  return {
    products: cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    hasMore: cards.length > (page + 1) * PAGE_SIZE,
    askWho: page === 0 && !q.gender && !q.ageGroup && isMixed,
    similar,
  };
}
