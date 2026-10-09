import { createHash } from "crypto";
import { prisma } from "../config/db";
import { logger } from "../config/winston";
import { CACHE_SECONDS, getOrSetCache } from "../config/cache";
import { CARD_SELECT, productCard } from "../utils/price";
import { catalogService, readBudget, toPaise } from "./catalog.service";
import { embeddingService } from "./embedding.service";

export const PAGE_SIZE = 5;
const MAX_RESULTS = 50;

type Sort = "latest" | "price_asc" | "price_desc" | "discount" | "rating";
export type Card = ReturnType<typeof productCard>;

// Kiske liye: shabd -> gender/ageGroup (Unisex hamesha saath me).
const WHO: { pattern: RegExp; gender?: string[]; ageGroup?: string }[] = [
  { pattern: /\b(boys?|ladk[ae]|beta)\b/, gender: ["Men", "Unisex"], ageGroup: "Kids" },
  { pattern: /\b(girls?|ladki|ladkiyon|beti)\b/, gender: ["Women", "Unisex"], ageGroup: "Kids" },
  { pattern: /\b(kids?|child|children|baby|babies|ba(?:c|ch)+(?:a|e|on|o)|toddlers?)\b/, ageGroup: "Kids" },
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
  { pattern: /\b(adults?|old|elderly|senior|budh[ae]|dada|dadi|nana|nani)\b/, ageGroup: "Adult" },
];

// Sort aur section wale shabd.
const SORT_WORDS: { pattern: RegExp; sort?: Sort; discount?: boolean; trending?: boolean }[] = [
  { pattern: /\b(sast[aeiy]|cheap|cheapest|lowest|budget)\b/, sort: "price_asc" },
  { pattern: /\b(mehe?ng[aei]|mahang[aei]|premium|expensive|costly)\b/, sort: "price_desc" },
  { pattern: /\b(best|rated|rating|badhiya|reviews?)\b/, sort: "rating" },
  { pattern: /\b(offers?|discount|sale|deals?)\b/, sort: "discount", discount: true },
  { pattern: /\b(trending|popular)\b/, trending: true },
];

// Bharti ke shabd jo product ka naam nahi hote.
const STOP_WORDS = new Set(
  `mujhe muje mere mera meri hum humein liye ke ki ka ko se me mein main hai hain ho chahiye chaiye chahie dikhao dikha
  dikhaiye dikhana batao bataiye show please plz pls kuch koi ek for a an the i want need some with wala wali wale acha
  achha accha good nice aur and or ya bhi do de dena find search get buy kharidna lena is are my to of in on any koi
  products product item items saman samaan rupee rupees rupaye rupay rs`.split(/\s+/),
);

// Hindi/short shabd -> catalog wala shabd.
const SAME_WORDS: Record<string, string> = {
  lal: "red",
  kala: "black",
  kali: "black",
  safed: "white",
  neela: "blue",
  neeli: "blue",
  hara: "green",
  hari: "green",
  peela: "yellow",
  peeli: "yellow",
  gulabi: "pink",
  bhura: "brown",
  tshirt: "t-shirt",
  tshirts: "t-shirt",
  joota: "shoes",
  joote: "shoes",
  jootey: "shoes",
  chappal: "slippers",
  ghadi: "watch",
  kurti: "kurta",
  kurtis: "kurta",
};

type Question = {
  words: string;
  meaning: string;
  gender?: string[];
  ageGroup?: string[];
  sort: Sort;
  discount?: boolean;
  trending?: boolean;
  minPaise?: number;
  maxPaise?: number;
};

// Sawal se search ke shabd, price, kiske liye aur sort nikalo.
export function readQuestion(question: string): Question {
  const budget = readBudget(question);
  let text = budget.text.toLowerCase();
  const result: Question = {
    words: "",
    meaning: budget.text,
    sort: "latest",
    minPaise: toPaise(budget.minPrice),
    maxPaise: toPaise(budget.maxPrice),
  };

  for (const who of WHO) {
    if (!who.pattern.test(text)) continue;
    result.gender ??= who.gender;
    if (who.ageGroup && !result.ageGroup) result.ageGroup = [who.ageGroup];
    text = text.replace(new RegExp(who.pattern, "g"), " ");
  }
  for (const word of SORT_WORDS) {
    if (!word.pattern.test(text)) continue;
    if (word.sort && result.sort === "latest") result.sort = word.sort;
    if (word.discount) result.discount = true;
    if (word.trending) result.trending = true;
    text = text.replace(new RegExp(word.pattern, "g"), " ");
  }

  result.words = text
    .split(/[^a-z0-9ऀ-ॿ-]+/)
    .map((word) => SAME_WORDS[word] ?? word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word))
    .join(" ");
  return result;
}

// Sawal me search karne layak kuch hai ya nahi.
export function hasSearch(q: Question): boolean {
  return Boolean(q.words || q.discount || q.trending || q.minPaise || q.maxPaise || q.sort !== "latest");
}

// Har shabd poora mile (naam, colour, brand ya category me); "phones" ko "headphones" na maane.
async function exactMatches(cards: Card[], words: string): Promise<Card[]> {
  const rows = await prisma.product.findMany({
    where: { id: { in: cards.map((card) => card.id) } },
    select: {
      id: true,
      name: true,
      color: true,
      brand: { select: { name: true } },
      category: { select: { name: true, parent: { select: { name: true } } } },
    },
  });
  const patterns = words.split(" ").map((word) => {
    const stem = word.replace(/s$/, "").replace(/[^a-z0-9-]/g, "");
    return new RegExp(`\\b${stem}(s|es)?\\b`, "i");
  });
  const exact = new Set(
    rows
      .filter((p) => {
        const text = [p.name, p.color, p.brand?.name, p.category.name, p.category.parent?.name].join(" ");
        return patterns.every((pattern) => pattern.test(text));
      })
      .map((p) => p.id),
  );
  return cards.filter((card) => exact.has(card.id));
}

// Meaning wali search (Redis cache); Gemini limit par khaali, chat na ruke.
async function meaningMatches(q: Question): Promise<Card[]> {
  const key = createHash("sha1").update(JSON.stringify(q)).digest("hex");
  return getOrSetCache(`ai:semantic:${key}`, CACHE_SECONDS, async () => {
    const ids = await embeddingService.searchIds(q.meaning, q, MAX_RESULTS);
    if (ids.length === 0) return [];
    const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: CARD_SELECT });
    const position = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
    return rows.map(productCard);
  }).catch((error) => {
    logger.warn("Semantic search skipped", { error: (error as Error).message });
    return [];
  });
}

// Pehle instant (Redis/DB naam-search); sab poore mile to wahi, warna meaning wali, wo bhi na mile to sirf poore mile wale.
async function allMatches(q: Question): Promise<Card[]> {
  const instant = await catalogService.list({
    q: q.words || undefined,
    gender: q.gender,
    ageGroup: q.ageGroup,
    minPricePaise: q.minPaise,
    maxPricePaise: q.maxPaise,
    discount: q.discount,
    section: q.trending ? "trending" : undefined,
    sort: q.sort,
    limit: MAX_RESULTS,
  });
  if (!q.words) return instant.items;

  const exact = await exactMatches(instant.items, q.words);
  if (exact.length > 0 && exact.length === instant.items.length) return exact;
  const meaning = await meaningMatches(q);
  return meaning.length > 0 ? meaning : exact;
}

// Results me Men aur Women dono (ya Kids aur bade dono) mile to puchhna padega kiske liye.
async function isMixed(cards: Card[]): Promise<boolean> {
  const rows = await prisma.product.findMany({
    where: { id: { in: cards.map((card) => card.id) } },
    select: { gender: true, ageGroup: true },
  });
  const genders = new Set(rows.map((row) => row.gender));
  const ages = new Set(rows.map((row) => row.ageGroup));
  return (genders.has("Men") && genders.has("Women")) || (ages.has("Kids") && ages.has("Adult"));
}

// Ek page (5 product); khaas cheez (shoes, shirt) me kiske liye saaf na ho to askWho.
export async function findProducts(q: Question, page: number) {
  const all = await allMatches(q);
  const askWho = page === 0 && q.words !== "" && !q.gender && !q.ageGroup && all.length > 0 && (await isMixed(all));
  return {
    products: all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    hasMore: all.length > (page + 1) * PAGE_SIZE,
    askWho,
  };
}
