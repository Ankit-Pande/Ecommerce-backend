import { createHash } from "crypto";
import { prisma } from "../config/db";
import { CACHE_SECONDS, remember } from "../config/cache";
import { CARD_SELECT, productCard } from "../utils/price";
import { catalogService, readBudget } from "./catalog.service";
import { embeddingService } from "./embedding.service";

export const PAGE_SIZE = 5;
const MAX_RESULTS = 50;

type Sort = "latest" | "price_asc" | "price_desc" | "discount" | "rating";
type Card = ReturnType<typeof productCard>;

// Kiske liye: shabd -> gender/ageGroup (Unisex hamesha saath me).
const WHO: { pattern: RegExp; gender?: string[]; ageGroup?: string }[] = [
  { pattern: /\b(boys?|ladk[ae]|beta)\b/, gender: ["Men", "Unisex"], ageGroup: "Kids" },
  { pattern: /\b(girls?|ladki|ladkiyon|beti)\b/, gender: ["Women", "Unisex"], ageGroup: "Kids" },
  { pattern: /\b(kids?|child|children|baby|babies|bach+[ae]|bach+on|toddlers?)\b/, ageGroup: "Kids" },
  {
    pattern: /\b(women|woman|womens|female|ladies|lady|mahila|aurat|wife|mummy|mom|maa|didi|behen|sister)\b/,
    gender: ["Women", "Unisex"],
  },
  { pattern: /\b(men|man|mens|male|gents|purush|husband|papa|dad|bhai|brother)\b/, gender: ["Men", "Unisex"] },
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
  products product item items saman samaan`.split(/\s+/),
);

export type Question = {
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

const toPaise = (rupees?: number) => (rupees === undefined ? undefined : Math.round(rupees * 100));

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
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word))
    .join(" ");
  return result;
}

// Sawal me search karne layak kuch hai ya nahi.
export function hasSearch(q: Question): boolean {
  return Boolean(
    q.words || q.gender || q.ageGroup || q.discount || q.trending || q.minPaise || q.maxPaise || q.sort !== "latest",
  );
}

// Pehle instant (Redis/DB naam-search), na mile to meaning wali search; dono Redis me cache.
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
  if (instant.items.length > 0 || !q.words) return instant.items;

  const key = createHash("sha1").update(JSON.stringify(q)).digest("hex");
  return remember(`ai:semantic:${key}`, CACHE_SECONDS, async () => {
    const ids = await embeddingService.searchIds(q.meaning, q, MAX_RESULTS);
    if (ids.length === 0) return [];
    const rows = await prisma.product.findMany({ where: { id: { in: ids } }, select: CARD_SELECT });
    const position = new Map(ids.map((id, index) => [id, index]));
    rows.sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
    return rows.map(productCard);
  });
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
