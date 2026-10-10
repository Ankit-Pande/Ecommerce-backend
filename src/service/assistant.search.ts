import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import { prisma } from "../config/db";
import { logger } from "../config/winston";
import { CACHE_SECONDS, getOrSetCache } from "../config/cache";
import { orderByIds } from "../utils/paginate";
import { CARD_SELECT, productCard } from "../utils/price";
import { readBudget, toPaise } from "./catalog.service";
import { embeddingService, productFilterSql, SearchFilters } from "./embedding.service";

export const PAGE_SIZE = 5;
const MAX_RESULTS = 50;

type Sort = "latest" | "price_asc" | "price_desc" | "discount" | "rating";
export type Card = ReturnType<typeof productCard>;
type Question = SearchFilters & {
  words: string;
  meaning: string;
  sort: Sort;
  labels: string[];
  categoryLabel?: string;
};
type Vocabulary = {
  brands: { id: string; name: string }[];
  categories: { id: string; name: string; parentId: string | null }[];
  colors: string[];
};

const WHO_WORDS: { pattern: RegExp; label: string; gender?: string[]; ageGroup?: string }[] = [
  { pattern: /\b(boys?|ladk[ae]|beta)\b/, label: "Boys", gender: ["Men", "Unisex"], ageGroup: "Kids" },
  { pattern: /\b(girls?|ladki|ladkiyon|beti)\b/, label: "Girls", gender: ["Women", "Unisex"], ageGroup: "Kids" },
  {
    pattern: /\b(kids?|child|children|baby|babies|ba(?:c|ch)+(?:a|e|on|o)|toddlers?)\b/,
    label: "Kids",
    ageGroup: "Kids",
  },
  {
    pattern: /\b(women|woman|womens|female|ladies|lady|mahila|aurat|wife|mummy|mom|maa|didi|behen|sister)\b/,
    label: "Women",
    gender: ["Women", "Unisex"],
    ageGroup: "Adult",
  },
  {
    pattern: /\b(men|man|mens|male|gents|purush|husband|papa|dad|bhai|brother)\b/,
    label: "Men",
    gender: ["Men", "Unisex"],
    ageGroup: "Adult",
  },
  { pattern: /\b(adults?|old|elderly|senior|budh[ae]|dada|dadi|nana|nani)\b/, label: "Adults", ageGroup: "Adult" },
];

const SORT_WORDS: { pattern: RegExp; label: string; sort?: Sort; discount?: boolean; trending?: boolean }[] = [
  { pattern: /\b(sast[aeiy]|cheap|cheapest|lowest|budget)\b/, label: "saste pehle", sort: "price_asc" },
  { pattern: /\b(mehe?ng[aei]|mahang[aei]|premium|expensive|costly)\b/, label: "mehenge pehle", sort: "price_desc" },
  {
    pattern: /\b(best|achh?a|accha|good|rated|rating|badhiya|reviews?)\b/,
    label: "achhi rating pehle",
    sort: "rating",
  },
  { pattern: /\b(offers?|discount|sale|deals?)\b/, label: "offer wale", sort: "discount", discount: true },
  { pattern: /\b(trending|popular)\b/, label: "trending", trending: true },
];

const FILLER_WORDS = new Set(
  `mujhe muje mere mera meri hum humein liye ke ki ka ko se me mein main hai hain ho chahiye chaiye chahie dikhao dikha
  dikhaiye dikhana batao bataiye show please plz pls kuch koi ek for a an the i want need some with wala wali wale nice
  aur and or ya bhi do de dena find search get buy kharidna lena is are my to of in on any products product item items
  saman samaan rupee rupees rupaye rupay rs`.split(/\s+/),
);

const PERSON_WORDS = new Set(["men", "women", "kid", "boy", "girl"]);

const SORT_SQL: Record<Sort, Prisma.Sql> = {
  latest: Prisma.sql`p."createdAt" DESC`,
  price_asc: Prisma.sql`p."sellPaise" ASC`,
  price_desc: Prisma.sql`p."sellPaise" DESC`,
  discount: Prisma.sql`p."discountPercent" DESC`,
  rating: Prisma.sql`p."ratingAverage" DESC`,
};

// Shabd ka seedha roop, taaki "shoes" aur "shoe", "watches" aur "watch" ek gine jayein.
const baseWord = (word: string) => word.replace(/(ch|sh|ss|x)es$/, "$1").replace(/([^s])s$/, "$1");

// Text ke shabd: chhote akshar me, "'s" hata kar, seedhe roop me.
const wordsOf = (text: string) =>
  text
    .toLowerCase()
    .replace(/'s\b/g, "")
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter(Boolean)
    .map(baseWord);

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

// Brand, category aur rang ki list DB se (Redis cache me; admin kuch badle to apne aap nayi).
async function getVocabulary(): Promise<Vocabulary> {
  return getOrSetCache("ai:vocabulary", CACHE_SECONDS, async () => {
    const [brands, categories, colors] = await Promise.all([
      prisma.brand.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true, parentId: true } }),
      prisma.product.groupBy({ by: ["color"], where: { isActive: true, color: { not: null } } }),
    ]);
    return { brands, categories, colors: colors.map((row) => row.color as string) };
  });
}

// Naam ke saare shabd sawal me hon to wo naam match hai.
const isMentioned = (nameWords: string[], asked: Set<string>) =>
  nameWords.length > 0 && nameWords.every((word) => asked.has(word));

// Sawal samjho: price, kiske liye, sort, aur DB ki list se brand, category, rang; bache shabd naam me dhoondhne ke liye.
export async function readQuestion(question: string): Promise<Question> {
  const budget = readBudget(question);
  let text = budget.text.toLowerCase();
  const q: Question = {
    words: "",
    meaning: budget.text,
    sort: "latest",
    labels: [],
    minPaise: toPaise(budget.minPrice),
    maxPaise: toPaise(budget.maxPrice),
  };

  for (const who of WHO_WORDS) {
    if (!who.pattern.test(text)) continue;
    if (!q.gender && !q.ageGroup) q.labels.push(who.label);
    q.gender ??= who.gender;
    if (who.ageGroup && !q.ageGroup) q.ageGroup = [who.ageGroup];
    text = text.replace(new RegExp(who.pattern, "g"), " ");
  }
  for (const word of SORT_WORDS) {
    if (!word.pattern.test(text)) continue;
    q.labels.push(word.label);
    if (word.sort && q.sort === "latest") q.sort = word.sort;
    if (word.discount) q.discount = true;
    if (word.trending) q.trending = true;
    text = text.replace(new RegExp(word.pattern, "g"), " ");
  }

  const vocabulary = await getVocabulary();
  const asked = new Set(wordsOf(text));
  const used = new Set<string>();
  const markUsed = (words: string[]) => words.forEach((word) => used.add(word));

  const brands = vocabulary.brands.filter((brand) => isMentioned(wordsOf(brand.name), asked));
  if (brands.length > 0) {
    q.brandIds = brands.map((brand) => brand.id);
    brands.forEach((brand) => markUsed(wordsOf(brand.name)));
    q.labels.unshift(...brands.map((brand) => brand.name));
  }

  const colors = vocabulary.colors.filter((color) => isMentioned(wordsOf(color), asked));
  if (colors.length > 0) {
    q.colors = colors;
    colors.forEach((color) => markUsed(wordsOf(color)));
    q.labels.unshift(...colors);
  }

  const categories = vocabulary.categories
    .map((category) => ({ ...category, key: wordsOf(category.name).filter((word) => !PERSON_WORDS.has(word)) }))
    .filter((category) => isMentioned(category.key, asked));
  if (categories.length > 0) {
    const mostExact = Math.max(...categories.map((category) => category.key.length));
    const chosen = categories.filter((category) => category.key.length === mostExact);
    const chosenIds = chosen.map((category) => category.id);
    const children = vocabulary.categories.filter(
      (category) => category.parentId && chosenIds.includes(category.parentId),
    );
    q.categoryIds = [...chosenIds, ...children.map((category) => category.id)];
    chosen.forEach((category) => markUsed(category.key));
    if (chosen.length === 1) q.categoryLabel = chosen[0].name;
  }

  q.words = text
    .split(/[^a-z0-9ऀ-ॿ-]+/)
    .filter((word) => (word.length >= 2 || /^\d$/.test(word)) && !FILLER_WORDS.has(word) && !used.has(baseWord(word)))
    .join(" ");
  if (q.maxPaise) q.labels.push(`${rupees(q.maxPaise)} tak`);
  if (q.minPaise && !q.maxPaise) q.labels.push(`${rupees(q.minPaise)} se upar`);
  return q;
}

// Sawal me "Men / Women / Kids" jaisa jawab hai ya nahi.
export function answersWho(text: string): boolean {
  const lower = text.toLowerCase();
  return WHO_WORDS.some((who) => who.pattern.test(lower));
}

// Sawal me search karne layak kuch hai ya nahi.
export function hasSomethingToSearch(q: Question): boolean {
  return Boolean(
    q.words || q.brandIds || q.categoryIds || q.colors || q.discount || q.trending || q.minPaise || q.maxPaise,
  );
}

// Samjhe hue filter se chhota jawab, jaise "Gaming Laptops, ₹40,000 tak: ye rahe products".
function describe(q: Question): string {
  const labels = q.categoryIds && q.categoryLabel ? [q.categoryLabel, ...q.labels] : q.labels;
  return labels.length > 0 ? `${labels.join(", ")}: ye rahe products` : "Ye products mile:";
}

// Ids ke kram me product cards.
async function cardsInOrder(ids: string[]): Promise<Card[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: CARD_SELECT });
  return orderByIds(rows, ids).map(productCard);
}

// DB ki shart: filter + naam/rang ke poore shabd (full-text index).
function dbWhere(q: Question): Prisma.Sql {
  const where = productFilterSql(q);
  if (q.words) where.push(Prisma.sql`p."searchText" @@ plainto_tsquery('english', ${q.words})`);
  return Prisma.join(where, " AND ");
}

// DB search, sort ke saath (Redis cache).
async function dbMatches(q: Question): Promise<Card[]> {
  const key = createHash("sha1").update(JSON.stringify(q)).digest("hex");
  return getOrSetCache(`ai:db:${key}`, CACHE_SECONDS, async () => {
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id" FROM "Product" p
      WHERE ${dbWhere(q)}
      ORDER BY ${SORT_SQL[q.sort]}, p."id" DESC
      LIMIT ${MAX_RESULTS}`;
    return cardsInOrder(rows.map((row) => row.id));
  });
}

// Cards ko sawal ke sort (rating, price, offer) ke hisaab se lagao.
function sortCards(cards: Card[], sort: Sort): Card[] {
  if (sort === "latest") return cards;
  const score: Record<Exclude<Sort, "latest">, (card: Card) => number> = {
    rating: (card) => -card.rating.average,
    price_asc: (card) => card.finalPricePaise,
    price_desc: (card) => -card.finalPricePaise,
    discount: (card) => -card.discountPercent,
  };
  return [...cards].sort((a, b) => score[sort](a) - score[sort](b));
}

// Meaning wali search (description bhi samajhti hai); Gemini limit par khaali, chat na ruke.
async function meaningMatches(q: Question): Promise<Card[]> {
  const key = createHash("sha1").update(JSON.stringify(q)).digest("hex");
  const cards = await getOrSetCache(`ai:meaning:${key}`, CACHE_SECONDS, async () => {
    const ids = await embeddingService.searchIds(q.meaning, { ...q, categoryIds: undefined }, MAX_RESULTS);
    return cardsInOrder(ids);
  }).catch((error) => {
    logger.warn("Meaning search skipped", { error: (error as Error).message });
    return [];
  });
  return sortCards(cards, q.sort);
}

// Search ka kram: DB (filter + shabd), phir bina category ke DB, phir meaning wali search. Jis sawal se mila wo bhi do.
async function searchAll(q: Question): Promise<{ cards: Card[]; usedQuestion: Question }> {
  const fromDb = await dbMatches(q);
  if (fromDb.length > 0 || !q.words) return { cards: fromDb, usedQuestion: q };
  const withoutCategory = { ...q, categoryIds: undefined };
  if (q.categoryIds) {
    const cards = await dbMatches(withoutCategory);
    if (cards.length > 0) return { cards, usedQuestion: withoutCategory };
  }
  return { cards: await meaningMatches(q), usedQuestion: withoutCategory };
}

// Is sawal se milne wale saare products me Men aur Women dono (ya Kids aur bade dono) hain to puchhna padega kiske liye.
async function hasMixedGenderOrAge(q: Question): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ gender: string | null; ageGroup: string | null }[]>`
    SELECT DISTINCT p."gender", p."ageGroup" FROM "Product" p WHERE ${dbWhere(q)}`;
  const genders = new Set(rows.map((row) => row.gender));
  const ages = new Set(rows.map((row) => row.ageGroup));
  return (genders.has("Men") && genders.has("Women")) || (ages.has("Kids") && ages.has("Adult"));
}

// Ek page (5 product) aur chhota jawab; kapde ya joote jaisi cheez me kiske liye saaf na ho to askWho.
export async function findProducts(q: Question, page: number) {
  const { cards, usedQuestion } = await searchAll(q);
  const askWho =
    page === 0 &&
    Boolean(q.words || q.categoryIds) &&
    !q.gender &&
    !q.ageGroup &&
    cards.length > 0 &&
    (await hasMixedGenderOrAge(usedQuestion));
  return {
    products: cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    hasMore: cards.length > (page + 1) * PAGE_SIZE,
    askWho,
    reply: page > 0 ? "Ye rahe aur products:" : describe(usedQuestion),
  };
}
