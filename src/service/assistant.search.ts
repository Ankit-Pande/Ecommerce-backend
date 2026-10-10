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
const BIG_PAGE_SIZE = 10;
const MAX_RESULTS = 50;
const MAX_WORDS = 8;

type Sort = "latest" | "price_asc" | "price_desc" | "discount" | "rating";
type Word = { text: string; categoryIds: string[] };
export type Question = SearchFilters & {
  words: Word[];
  meaning: string;
  labels: Record<string, string>;
  sort?: Sort;
  pageSize?: number;
};
type Vocabulary = {
  brands: { id: string; name: string }[];
  categories: { id: string; name: string; parentId: string | null }[];
  colors: string[];
};

export const CARD_FIELDS = { ...CARD_SELECT, gender: true, ageGroup: true } satisfies Prisma.ProductSelect;
export type Card = ReturnType<typeof toCard>;

const WHO_WORDS: { pattern: RegExp; label: string; gender?: string[]; ageGroup: string }[] = [
  { pattern: /\b(boys?|ladk[ae]|beta)\b/, label: "Boys", gender: ["Men", "Unisex"], ageGroup: "Kids" },
  { pattern: /\b(girls?|ladki|ladkiyon|beti)\b/, label: "Girls", gender: ["Women", "Unisex"], ageGroup: "Kids" },
  {
    pattern:
      /\b(kids?|child|children|baby|babies|ba(?:c|ch)+(?:a|e|on|o)|toddlers?|(?:[1-9]|1[0-2])\s*(?:years?|yrs?|saal|sal)\s*(?:old|ka|ki|ke))\b/,
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

const SORT_WORDS: { pattern: RegExp; sort: Sort; label: string }[] = [
  { pattern: /\b(sast[aeiy]|cheap|cheapest|lowest|budget)\b/, sort: "price_asc", label: "lowest price" },
  { pattern: /\b(mehe?ng[aei]|mahang[aei]|premium|expensive|costly)\b/, sort: "price_desc", label: "highest price" },
  {
    pattern: /\b(best|top rated|ac+h+[aei]|good|rated|rating|badhiya|reviews?)\b/,
    sort: "rating",
    label: "top rated",
  },
  { pattern: /\b(nay[aei]|new|latest|recent|recently|newest)\b/, sort: "latest", label: "newest" },
];

const SPECIAL_WORDS: { pattern: RegExp; filter: "discount" | "trending" | "featured"; label: string }[] = [
  { pattern: /\b(offers?|discount|sale|deals?)\b/, filter: "discount", label: "offers" },
  { pattern: /\b(trending|popular)\b/, filter: "trending", label: "trending" },
  { pattern: /\b(featured)\b/, filter: "featured", label: "featured" },
];

const FILLER_WORDS = new Set(
  `mujhe muje mere mera meri hum humein hame liye ke ki ka ko se me mein main hai hain ho tha thi chahiye chaiye chahie
  chahta chahti chahte dikhao dikha dikhaiye dikhana dekhna dekho dekhiye batao bataiye bhejo show please plz pls kuch
  koi ek for an the want need looking some with wala wali wale nice aur and or ya bhi do de dena find search get buy
  kharidna lena is are am my to of in on at by from all any this that it very can you your have has what which kya kaun
  kaunsa kaunsi kaise kitna kitne kahan ye yeh wo woh isme usme products product item items saman samaan rupee rupees
  rupaye rupay rs hi hello hey namaste joda jodi jola pair number size no mast super cool stylish sundar beautiful
  awesome available milega milegi tak andar ander niche neeche upar price range`.split(/\s+/),
);

const PERSON_WORDS = new Set(["men", "women", "kid", "boy", "girl"]);

const SIZE_WORDS = /\b(?:size|uk)\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:number|no|size|uk)\b/;
const COUNT_AT_START = /^\s*(?:show me|show|top|mujhe|muje|sirf|only)?\s*(\d{1,2})(?=\s|$)/i;
const UNIT_AFTER_COUNT =
  /^\s*(?:number|no|size|uk|inch|gb|tb|kg|ton|saal|sal|years?|months?|mahine|mahina|din|days?|litre|liter|ml|watt|k[aie])\b/i;

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

const hashOf = (value: unknown) => createHash("sha1").update(JSON.stringify(value)).digest("hex");

// Product card ke saath kiske liye (gender, age) bhi, taaki pata chale results me Men aur Women dono hain ya nahi.
export function toCard(row: Prisma.ProductGetPayload<{ select: typeof CARD_FIELDS }>) {
  return { ...productCard(row), gender: row.gender, ageGroup: row.ageGroup };
}

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

// Naam ke saare shabd sawal me hon, ya jude hue likhe hon ("tshirt" = T-Shirt, "smartwatch" = Smart Watch), to naam match hai.
const isMentioned = (nameWords: string[], asked: Set<string>) =>
  nameWords.length > 0 && (nameWords.every((word) => asked.has(word)) || asked.has(nameWords.join("")));

// Naam ke shabd (aur unka jude hue roop) "use ho gaye", taaki dobara search ke shabd na banein.
const markUsed = (used: Set<string>, nameWords: string[]) =>
  [...nameWords, nameWords.join("")].forEach((word) => used.add(word));

// Category ke saath uski andar wali categories bhi (jaise "Footwear" ke saath "Sneakers").
function withChildren(vocabulary: Vocabulary, ids: string[]): string[] {
  const children = vocabulary.categories.filter((category) => category.parentId && ids.includes(category.parentId));
  return [...new Set([...ids, ...children.map((category) => category.id)])];
}

// Category ka naam bina Men's / Women's / Kids ke, jaise "Men's Jeans" -> "Jeans".
const categoryLabel = (name: string) =>
  name
    .split(" ")
    .filter((word) => !PERSON_WORDS.has(wordsOf(word)[0]))
    .join(" ");

// Kitne product chahiye ("10 shoes dikhao", "top 20 phones"); "8 number", "6 month" jaisa number ginti nahi.
function readCount(text: string): { text: string; count?: number } {
  const match = text.match(COUNT_AT_START);
  if (!match) return { text };
  const rest = text.slice(match[0].length);
  if (UNIT_AFTER_COUNT.test(rest)) return { text };
  return { text: rest, count: Number(match[1]) };
}

// Sawal samjho: price, ginti, size, kiske liye, sort, offer/trending, DB se brand, rang, category; bache shabd naam me dhoondhne ke liye.
export async function readQuestion(question: string): Promise<Question> {
  const budget = readBudget(question);
  const counted = readCount(budget.text);
  const q: Question = { words: [], meaning: budget.text, labels: {} };
  const vocabulary = await getVocabulary();
  const used = new Set<string>();
  let text = counted.text.toLowerCase();
  const size = text.match(SIZE_WORDS);
  if (size) text = text.replace(size[0], " ");

  const allWords = new Set(wordsOf(text));
  const brands = vocabulary.brands.filter((brand) => isMentioned(wordsOf(brand.name), allWords));
  brands.forEach((brand) => markUsed(used, wordsOf(brand.name)));

  const who = WHO_WORDS.find((item) => item.pattern.test(text));
  const sort = SORT_WORDS.find((item) => item.pattern.test(text));
  const specials = SPECIAL_WORDS.filter((item) => item.pattern.test(text));
  for (const item of [...WHO_WORDS, ...SORT_WORDS, ...SPECIAL_WORDS]) {
    text = text.replace(new RegExp(item.pattern, "g"), " ");
  }

  const asked = new Set(wordsOf(text).filter((word) => !used.has(word)));
  const colors = vocabulary.colors.filter((color) => isMentioned(wordsOf(color), asked));
  colors.forEach((color) => markUsed(used, wordsOf(color)));

  const categories = vocabulary.categories
    .map((category) => ({ ...category, key: wordsOf(category.name).filter((word) => !PERSON_WORDS.has(word)) }))
    .filter((category) => isMentioned(category.key, asked));
  const chosen = categories.filter(
    (category) =>
      !categories.some(
        (other) => other.key.length > category.key.length && category.key.every((word) => other.key.includes(word)),
      ),
  );
  chosen.forEach((category) => markUsed(used, category.key));

  const leftover = [...new Set(text.match(/[a-z0-9ऀ-ॿ]+(?:\.\d+)?/g))]
    .filter((word) => (word.length >= 2 || /^\d$/.test(word)) && !FILLER_WORDS.has(word) && !used.has(baseWord(word)))
    .slice(0, MAX_WORDS);
  q.words = leftover.map((word) => ({
    text: word,
    categoryIds: withChildren(
      vocabulary,
      vocabulary.categories
        .filter((category) => wordsOf(category.name).includes(baseWord(word)))
        .map((category) => category.id),
    ),
  }));

  if (brands.length > 0) {
    q.brandIds = brands.map((brand) => brand.id);
    q.labels.brand = brands.map((brand) => brand.name).join(", ");
  }
  if (colors.length > 0) {
    q.colors = colors;
    q.labels.color = colors.join(", ");
  }
  if (leftover.length > 0) q.labels.words = leftover.join(" ");
  if (chosen.length > 0) {
    q.categoryIds = withChildren(
      vocabulary,
      chosen.map((category) => category.id),
    );
    q.labels.category = [...new Set(chosen.map((category) => categoryLabel(category.name)))].join(", ");
  }
  if (who) {
    if (who.gender) q.gender = who.gender;
    q.ageGroup = [who.ageGroup];
    q.labels.who = who.label;
  }
  if (sort) {
    q.sort = sort.sort;
    q.labels.sort = sort.label;
  }
  for (const special of specials) {
    q[special.filter] = true;
    q.labels[special.filter] = special.label;
  }
  if (size) {
    q.size = size[1] ?? size[2];
    q.labels.size = `size ${q.size}`;
  }
  if (budget.minPrice) q.minPaise = toPaise(budget.minPrice);
  if (budget.maxPrice) q.maxPaise = toPaise(budget.maxPrice);
  if (q.minPaise && q.maxPaise) q.labels.price = `${rupees(q.minPaise)} - ${rupees(q.maxPaise)}`;
  else if (q.maxPaise) q.labels.price = `under ${rupees(q.maxPaise)}`;
  else if (q.minPaise) q.labels.price = `above ${rupees(q.minPaise)}`;
  if (counted.count) q.pageSize = counted.count > PAGE_SIZE ? BIG_PAGE_SIZE : PAGE_SIZE;
  return q;
}

// Sawal me product ki baat (naam ka shabd ya category) hai.
export const hasProductWords = (q: Question) => q.words.length > 0 || Boolean(q.categoryIds);

// Sawal me sirf badlav wali baat hai (Men, sasta, red, samsung, under 1000, 10 dikhao).
export const hasRefineWords = (q: Question) => Object.keys(q.labels).length > 0 || q.pageSize !== undefined;

// Search karne layak kuch hai (sirf "Men" ya "sasta" akela kaafi nahi).
export function canSearch(q: Question): boolean {
  return Boolean(
    q.words.length > 0 ||
    q.categoryIds ||
    q.brandIds ||
    q.colors ||
    q.minPaise ||
    q.maxPaise ||
    q.discount ||
    q.trending ||
    q.featured ||
    q.size,
  );
}

// Pichhle sawal par naya badlav lagao; jo baad me bola wahi chalega.
export function applyRefine(base: Question, extra: Question): Question {
  return {
    ...base,
    ...extra,
    words: base.words,
    meaning: `${base.meaning} ${extra.meaning}`,
    labels: { ...base.labels, ...extra.labels },
  };
}

// Sawal ka sort; offer maanga ho to zyada discount pehle.
const sortOf = (q: Question): Sort => q.sort ?? (q.discount ? "discount" : "latest");

// Ids ke kram me product cards.
async function cardsInOrder(ids: string[]): Promise<Card[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: CARD_FIELDS });
  return orderByIds(rows, ids).map(toCard);
}

// Product us shabd wali category me hai (jaise "toys" -> Toys & Games).
const inCategory = (word: Word) => Prisma.sql`p."categoryId" IN (${Prisma.join(word.categoryIds)})`;

// Ek shabd ka match: product ke naam/rang me, ya us shabd wali category me.
function wordMatch(word: Word): Prisma.Sql {
  const inName = Prisma.sql`p."searchText" @@ plainto_tsquery('english', ${word.text})`;
  if (word.categoryIds.length === 0) return inName;
  return Prisma.sql`(${inName} OR ${inCategory(word)})`;
}

// DB search: jitne zyada shabd mile utna upar, phir category wale (1-2 shabd ho to sab, zyada ho to aadhe); har category (aur kiske liye na bola ho to Men, Women, Kids) ke baari-baari (Redis cache).
async function dbMatches(q: Question): Promise<Card[]> {
  const sort = sortOf(q);
  const key = hashOf({ ...q, meaning: undefined, labels: undefined, pageSize: undefined });
  return getOrSetCache(`ai:db:${key}`, CACHE_SECONDS, async () => {
    const where = productFilterSql(q);
    const order = [SORT_SQL[sort], Prisma.sql`p."id" DESC`];
    if (q.words.length > 0) {
      const matches = q.words.map(wordMatch);
      const hits = Prisma.join(
        matches.map((match) => Prisma.sql`(${match})::int`),
        " + ",
      );
      const need = q.words.length <= 2 ? q.words.length : Math.ceil(q.words.length / 2);
      where.push(Prisma.sql`(${Prisma.join(matches, " OR ")})`, Prisma.sql`(${hits}) >= ${need}`);
      const categoryWords = q.words.filter((word) => word.categoryIds.length > 0);
      if (categoryWords.length > 0) {
        const categoryHits = categoryWords.map((word) => Prisma.sql`(${inCategory(word)})::int`);
        order.unshift(Prisma.sql`(${Prisma.join(categoryHits, " + ")}) DESC`);
      }
      order.unshift(Prisma.sql`(${hits}) DESC`);
    }
    const groups =
      q.gender || q.ageGroup ? Prisma.sql`p."categoryId"` : Prisma.sql`p."categoryId", p."gender", p."ageGroup"`;
    order.unshift(Prisma.sql`ROW_NUMBER() OVER (PARTITION BY ${groups} ORDER BY ${Prisma.join(order, ", ")})`);
    const rows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT p."id" FROM "Product" p
      WHERE ${Prisma.join(where, " AND ")}
      ORDER BY ${Prisma.join(order, ", ")}
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

// Bache shabd khud kisi category ke na hon (party, wedding), tabhi category pakki hai; "laptop bag" me "bag" ho to nahi.
const isSureCategory = (q: Question) => Boolean(q.categoryIds) && !q.words.some((word) => word.categoryIds.length > 0);

// Meaning wali search (description bhi samajhti hai), category pakki ho to usi ke andar; 3 akshar ka shabd na ho ya Gemini limit ho to khaali.
async function meaningMatches(q: Question): Promise<Card[]> {
  if (!q.words.some((word) => /[a-zऀ-ॿ]{3}/.test(word.text))) return [];
  const filters = isSureCategory(q) ? q : { ...q, categoryIds: undefined };
  const cards = await getOrSetCache(`ai:meaning:${hashOf(filters)}`, CACHE_SECONDS, async () => {
    const ids = await embeddingService.searchIds(q.meaning, filters, MAX_RESULTS);
    return cardsInOrder(ids);
  }).catch((error) => {
    logger.warn("Meaning search skipped", { error: (error as Error).message });
    return [];
  });
  return sortCards(cards, sortOf(q));
}

// Search ka kram: DB (shabd + filter), phir meaning wali search; phir category pakki ho to usi ke products (party, wedding chhod kar), warna bina category ke shabd ("laptop bag" -> bags).
async function searchAll(q: Question): Promise<{ cards: Card[]; similar: boolean; used: Question }> {
  const exact = await dbMatches(q);
  if (exact.length > 0 || q.words.length === 0) return { cards: exact, similar: false, used: q };
  const byMeaning = await meaningMatches(q);
  if (byMeaning.length > 0 || !q.categoryIds) return { cards: byMeaning, similar: true, used: q };
  if (isSureCategory(q)) return { cards: await dbMatches({ ...q, words: [] }), similar: true, used: q };
  const { category: _category, ...labels } = q.labels;
  const withoutCategory = { ...q, categoryIds: undefined, labels };
  return { cards: await dbMatches(withoutCategory), similar: true, used: withoutCategory };
}

// Results me Men aur Women dono (ya Kids aur bade dono) hain?
function isMixed(cards: Card[]): boolean {
  const genders = new Set(cards.map((card) => card.gender));
  const ages = new Set(cards.map((card) => card.ageGroup));
  return (genders.has("Men") && genders.has("Women")) || (ages.has("Kids") && ages.has("Adult"));
}

// Ek page ke product (5, ya zyada maange to 10); kiske liye na bola ho aur results mix hon to askWho (Men/Women/Kids button).
export async function findProducts(q: Question, page: number) {
  const size = q.pageSize ?? PAGE_SIZE;
  const { cards, similar, used } = await searchAll(q);
  return {
    products: cards.slice(page * size, (page + 1) * size),
    hasMore: cards.length > (page + 1) * size,
    askWho: page === 0 && !q.gender && !q.ageGroup && isMixed(cards),
    similar,
    labels: used.labels,
  };
}
