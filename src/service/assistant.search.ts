import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/db";
import { getOrSetCache, redis } from "../config/redis";
import { logger } from "../config/winston";
import { embedTexts, geminiReady } from "../integration/gemini";
import { productCard } from "../utils/price";

export const PAGE_SIZE = 5;
const MAX_RESULTS = 50;
const MAX_WORDS = 8;
const MAX_DISTANCE = 0.45;
const QUERY_VECTOR_SECONDS = 7 * 24 * 3600;
const SPEC_NUMBER = "[0-9]+(?:\\.[0-9]+)?";
const SPEC_BIG_UNIT = "^[0-9.]+\\s*(tb|kg|l)";

type Sort = "latest" | "price_asc" | "price_desc" | "rating" | "discount";

export type Question = {
  text: string;
  words: string[];
  modelNumbers?: string[];
  anyWord?: boolean;
  occasions?: string[];
  specs?: string[];
  brandIds?: string[];
  categoryIds?: string[];
  categoryNames?: string[];
  skipNames?: string[];
  colors?: string[];
  gender?: string[];
  ageGroup?: string;
  size?: string;
  minPaise?: number;
  maxPaise?: number;
  minRating?: number;
  sort?: Sort;
  discount?: boolean;
  trending?: boolean;
  featured?: boolean;
};

type Alternative = { kind: "colour" | "size" | "brand" | "cheaper" | "costlier" | "rating"; values: string };

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
  { pattern: /\b(sast[aeiy]|cheap|cheapest|lowest|budget|kam (?:daam|dam|kimat|keemat|price))\b/, sort: "price_asc" },
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

const RATING =
  /(\d(?:\.\d)?)\s*\+?\s*(?:stars?|★)|\bratings?\s*(?:above|over|more than)?\s*(\d(?:\.\d)?)|(\d(?:\.\d)?)\s*\+?\s*ratings?\b/;

const JOINER = /\b(aur|and|ya|or)\b|[,&/]/;

const UNIT_WORD = /^\d+(?:\.\d+)?(?:kg|g|ml|l|gb|tb|mah|mp|hz|w)$/;

const NUMBER = String.raw`(\d[\d,]*(?:\.\d+)?)\s*(k|hazar|lakh|lac)?\b`;
const RUPEE_WORD = String.raw`(?:rs\.?|rupees?|rupaye|rupay)?`;
const PRICE_RANGE = new RegExp(String.raw`${NUMBER}\s*(?:-|to|se)\s*${NUMBER}`, "i");
const PRICE_BELOW = new RegExp(
  String.raw`(?:under|below|upto|up to|less than|max)\s*(?:rs\.?|₹)?\s*${NUMBER}|${NUMBER}\s*${RUPEE_WORD}\s*(?:tak|(?:ke )?and[ae]r|(?:ke |se )?n(?:ee|i)chh?e|se kam|me|mein|ka|ki|ke)\b`,
  "i",
);
const PRICE_ABOVE = new RegExp(
  String.raw`(?:above|over|more than|min)\s*(?:rs\.?|₹)?\s*${NUMBER}|${NUMBER}\s*${RUPEE_WORD}\s*(?:se upar|se zyada|ke upar)`,
  "i",
);
const PRICE_BARE = new RegExp(
  String.raw`(₹|\brs\.?)?\s*\b(\d[\d,]*(?:\.\d+)?)\s*(k|hazar|lakh|lac)?\b(?!\s*(?:gb|tb|mb|mah|mp|hz|inch|inches|w|watts?|ml|l|ltr|litres?|kg|g|gm|grams?|cm|mm|years?|saal|sal|months?|model|number|no|size|uk)\b)`,
  "gi",
);
const MIN_BARE_PRICE = 500;
const MAX_BUDGET_PAISE = 1_000_000_000;

const DEVANAGARI = new Map(
  Object.entries({
    लाल: "lal",
    काला: "kala",
    काली: "kala",
    सफेद: "safed",
    सफ़ेद: "safed",
    नीला: "neela",
    नीली: "neela",
    हरा: "hara",
    हरी: "hara",
    पीला: "peela",
    पीली: "peela",
    गुलाबी: "gulabi",
    भूरा: "bhura",
    जूता: "juta",
    जूते: "juta",
    चप्पल: "chappal",
    कमीज: "kameez",
    कमीज़: "kameez",
    पैंट: "pant",
    कुर्ता: "kurta",
    कुर्ती: "kurti",
    साड़ी: "saree",
    घड़ी: "ghadi",
    फोन: "phone",
    फ़ोन: "phone",
    मोबाइल: "mobile",
    कपड़े: "kapde",
    शर्ट: "shirt",
    जींस: "jeans",
    लहंगा: "lehenga",
    ड्रेस: "dress",
    सैंडल: "sandal",
    लैपटॉप: "laptop",
    हेडफोन: "headphone",
    लिपस्टिक: "lipstick",
    काजल: "kajal",
    आटा: "atta",
    चावल: "chawal",
    दाल: "dal",
    तेल: "tel",
    चाय: "chai",
    चीनी: "cheeni",
    घी: "ghee",
    तक: "tak",
    हज़ार: "hazar",
    हजार: "hazar",
    लाख: "lakh",
    अंदर: "andar",
    नीचे: "neeche",
    ऊपर: "upar",
    कम: "kam",
    से: "se",
    के: "ke",
    का: "ka",
    की: "ki",
    में: "me",
    रुपये: "rupaye",
    रुपए: "rupaye",
    नंबर: "number",
    साइज़: "size",
    साइज: "size",
    आदमी: "men",
    पुरुष: "purush",
    औरत: "aurat",
    महिला: "mahila",
    लड़का: "ladka",
    लड़की: "ladki",
    बच्चे: "bacche",
    बच्चों: "bacchon",
    सस्ता: "sasta",
    सस्ते: "saste",
    अच्छा: "accha",
    अच्छे: "acche",
    नया: "naya",
    नए: "naye",
    शादी: "shaadi",
    पार्टी: "party",
    ऑफिस: "office",
    त्योहार: "tyohar",
    दिवाली: "diwali",
    टूर: "tour",
    यात्रा: "yatra",
    सफर: "safar",
    सफ़र: "safar",
    जिम: "gym",
    कॉलेज: "college",
    स्कूल: "school",
    कैमरा: "camera",
    बैटरी: "battery",
    गेमिंग: "gaming",
    बल्ब: "bulb",
    बैग: "bag",
    डायपर: "diaper",
    लंबी: "lambi",
    चलने: "chalne",
    बड़ी: "badi",
    बड़ा: "bada",
    ज़्यादा: "zyada",
    ज्यादा: "zyada",
    मुझे: "mujhe",
    लिए: "liye",
    दिखाओ: "dikhao",
    चाहिए: "chahiye",
    और: "aur",
    या: "ya",
    वाला: "wala",
    वाली: "wali",
    वाले: "wale",
  }),
);

const ALIASES = new Map(
  Object.entries({
    mobile: "phone",
    cloth: "fashion",
    clothes: "fashion",
    clothing: "fashion",
    kapde: "fashion",
    kapda: "fashion",
    outfit: "fashion",
    wear: "fashion",
    joota: "shoe",
    joote: "shoe",
    juta: "shoe",
    jute: "shoe",
    chappal: "slipper",
    ghadi: "watch",
    kurti: "kurta",
    sari: "saree",
    kameez: "shirt",
    pant: "trouser",
    patloon: "trouser",
    earphone: "headphone",
    screen: "display",
    nappy: "diaper",
    nappies: "diaper",
    ghar: "home",
    lipistic: "lipstick",
    chawal: "rice",
    daal: "dal",
    tel: "oil",
    chai: "tea",
    cheeni: "sugar",
    chini: "sugar",
    lal: "red",
    laal: "red",
    kala: "black",
    kaala: "black",
    kali: "black",
    safed: "white",
    safaid: "white",
    neela: "blue",
    nila: "blue",
    neeli: "blue",
    hara: "green",
    hari: "green",
    peela: "yellow",
    pila: "yellow",
    gulabi: "pink",
    bhura: "brown",
    narangi: "orange",
    baingani: "purple",
    jamuni: "purple",
    aasmani: "skyblue",
    sunehra: "gold",
    chandi: "silver",
    mehroon: "maroon",
    shaadi: "wedding",
    shadi: "wedding",
    vivah: "wedding",
    marriage: "wedding",
    sangeet: "wedding",
    sagai: "wedding",
    engagement: "wedding",
    reception: "wedding",
    partywear: "party",
    parties: "party",
    bday: "birthday",
    diwali: "festive",
    deepawali: "festive",
    holi: "festive",
    eid: "festive",
    navratri: "festive",
    dussehra: "festive",
    festival: "festive",
    tyohar: "festive",
    tyohaar: "festive",
    puja: "festive",
    pooja: "festive",
    workout: "gym",
    exercise: "gym",
    daftar: "office",
    tour: "travel",
    trip: "travel",
    safar: "travel",
    yatra: "travel",
    journey: "travel",
    vacation: "travel",
    holiday: "travel",
    ghumne: "travel",
    travelling: "travel",
    traveling: "travel",
  }),
);

const OCCASIONS = new Set(["wedding", "festive", "party", "birthday", "office", "gym", "travel", "college", "school"]);

const PERSON_WORDS = new Set(["men", "women", "kid", "boy", "girl", "baby"]);

const FILLER = new Set(
  `mujhe muje mujhko mere mera meri hum humein hame humko tum tumhe aap aapka apna apni apne liye lie ke ki ka ko se me
  mein main par pe hai hain ho hoga hogi hona hone tha thi raha rahe rahi rha rhe hu hoon hun chahiye chaiye chahie
  chahta chahti chahte dikhao dikha dikhado dikhaiye dikhana dekhna dekho dekhiye batao bataiye batana bhejo show please
  plz pls kuch kuchh koi ek for an the want need looking some with without wala wali wale nice aur and or ya bhi do de
  dena dijiye lo le lena lekar karo kro karna karni karne kar karke sakta sakte sakti ja jaa jaana jana jaunga jayenge
  find search get buy suggest recommend kharidna is are am my to of in on at by from all any this that it very can you
  your have has what which kya kaun kaunsa kaunsi kaise kaisa kaisi kitna kitne kitni kahan jo jisme jiska jiski ye yeh
  wo woh is isme usme products product item items saman samaan rupee rupees rupaye rupay rs daam kimat keemat hi hello
  hey namaste yaar joda jodi jola pair number size no mast super cool stylish sundar beautiful awesome sahi available
  milega milegi milenge tak andar ander niche neeche upar price range list sab sabhi saare sare sabse thoda zara bas abhi
  jaldi how many count smart above over plus star stars rang colour color long lasting lambi lamba chalne chalta chalti
  chale backup big bada badi bade large zyada jyada jada powerful fast tez quality gift gifts tohfa`.split(/\s+/),
);

const SORT_SQL: Record<Sort, Prisma.Sql> = {
  latest: Prisma.sql`product."createdAt" DESC`,
  price_asc: Prisma.sql`product."sellPaise" ASC`,
  price_desc: Prisma.sql`product."sellPaise" DESC`,
  rating: Prisma.sql`product."ratingAverage" DESC, product."ratingCount" DESC`,
  discount: Prisma.sql`product."discountPercent" DESC`,
};

export const VISIBLE_PRODUCT = Prisma.sql`product."isActive" AND EXISTS (SELECT 1 FROM "Category" category
  LEFT JOIN "Category" parent ON parent."id" = category."parentId"
  WHERE category."id" = product."categoryId" AND category."isActive" AND (parent."id" IS NULL OR parent."isActive"))`;

export const ON_OFFER = Prisma.sql`product."discountPercent" > 0
  AND (product."offerEndsAt" IS NULL OR product."offerEndsAt" > NOW())`;

const CARD_COLUMNS = Prisma.sql`product."id", product."name", product."slug", product."images", product."pricePaise",
  product."discountPercent", product."offerEndsAt", product."stock", product."ratingSum", product."ratingCount",
  product."sizes", product."colors", product."gender", product."ageGroup"`;

// SQL: the word is in the product name or specs (full-text search).
function nameMatch(word: string) {
  return Prisma.sql`product."searchText" @@ plainto_tsquery('english', ${word})`;
}

// SQL: the word is in the name, specs or description.
function textMatch(word: string) {
  return Prisma.sql`(${nameMatch(word)} OR product."descriptionText" @@ plainto_tsquery('english', ${word}))`;
}

// SQL: how many of the words match.
function countOf(words: string[], match: (word: string) => Prisma.Sql) {
  const counts = words.map((word) => Prisma.sql`(${match(word)})::int`);
  return Prisma.sql`(${Prisma.join(counts, " + ")})`;
}

// A short hash of any value, used in cache keys.
function hashOf(value: unknown) {
  return createHash("sha1").update(JSON.stringify(value)).digest("hex");
}

// Paise as rupee text: 149900 -> "₹1,499".
export function priceText(paise: number) {
  return `₹${Math.round(paise / 100).toLocaleString("en-IN")}`;
}

// A category name without its person word ("Men's Shirts" -> "Shirts").
function withoutPerson(name: string) {
  return name.replace(/\b(men|women|boys?|girls?|kids?)('s)?\s+/gi, "");
}

// The lowercase words of a text.
function wordsOf(text: string) {
  return text
    .toLowerCase()
    .replace(/'s\b/g, "")
    .split(/[^a-z0-9ऀ-ॿ]+/)
    .filter(Boolean);
}

// One word in its base form: singular, Hindi word in English, "smartwatch" -> "watch".
function normalize(word: string) {
  const single = word.replace(/(ch|sh|ss|x)es$/, "$1").replace(/([^s])s$/, "$1");
  return (ALIASES.get(word) ?? ALIASES.get(single) ?? single).replace(/^smart(?=[a-z])/, "");
}

// The base words of a name without person words ("Men's Running Shoes" -> ["running", "shoe"]).
function keyOf(name: string) {
  return wordsOf(name)
    .map(normalize)
    .filter((word) => !PERSON_WORDS.has(word) && word !== "smart");
}

// Items whose words were all asked; when a found item is part of a longer found one, only the longer one stays.
function findMentioned<T extends { key: string[] }>(items: T[], asked: Set<string>): T[] {
  const found: T[] = [];
  for (const item of items) {
    const allWordsAsked = item.key.every((word) => asked.has(word));
    const joinedWordAsked = asked.has(item.key.join(""));
    if (item.key.length > 0 && (allWordsAsked || joinedWordAsked)) found.push(item);
  }
  return found.filter((item) => {
    const insideLonger = found.some(
      (other) => other.key.length > item.key.length && item.key.every((word) => other.key.includes(word)),
    );
    return !insideLonger;
  });
}

// Colours named in the question; a plain colour ("blue") also matches its shades ("Navy Blue").
function findColors(colors: string[], asked: Set<string>) {
  const items = colors.map((name) => ({ name, key: keyOf(name) }));
  const exact = findMentioned(items, asked);
  if (exact.some((color) => color.key.length > 1)) return exact;
  const shades = items.filter((color) => color.key.length > 1 && asked.has(color.key[color.key.length - 1]));
  return [...exact, ...shades];
}

// Brands, categories, colours and numeric spec names from the database (cached), so new data needs no code change.
async function getVocabulary() {
  return getOrSetCache("ai:vocabulary", async () => {
    const [brands, categories, colors, specs] = await Promise.all([
      prisma.brand.findMany({ where: { isActive: true }, select: { id: true, name: true } }),
      prisma.category.findMany({ where: { isActive: true }, select: { id: true, name: true, parentId: true } }),
      prisma.$queryRaw<{ color: string }[]>`SELECT DISTINCT unnest("colors") AS color FROM "Product" WHERE "isActive"`,
      prisma.$queryRaw<{ key: string }[]>`
        SELECT spec.key FROM "Product" product, jsonb_each_text(product."specs") AS spec(key, value)
        WHERE product."isActive" GROUP BY spec.key HAVING avg((spec.value ~ '^[0-9]')::int) >= 0.5`,
    ]);
    return { brands, categories, colors: colors.map((row) => row.color), specs: specs.map((row) => row.key) };
  });
}

// Rupees to paise, with k / hazar (thousand) and lakh: ("2", "k") -> 200000.
function toPaise(digits: string, unit?: string): number {
  const rupees = Number(digits.replace(/,/g, ""));
  let multiplier = 1;
  if (unit) multiplier = unit.toLowerCase().startsWith("l") ? 100000 : 1000;
  return Math.round(rupees * multiplier * 100);
}

// Finds the budget ("under 2000", "1k-5k", "500 se upar", a bare "1999") and returns the text without it.
function readBudget(search: string): { text: string; minPaise?: number; maxPaise?: number; bare?: boolean } {
  const range = search.match(PRICE_RANGE);
  const above = search.match(PRICE_ABOVE);
  const below = search.match(PRICE_BELOW);

  let budget: { minPaise?: number; maxPaise?: number } = {};
  let priceText = "";
  if (range) {
    const low = toPaise(range[1], range[2] ?? range[4]);
    const high = toPaise(range[3], range[4]);
    budget = { minPaise: Math.min(low, high), maxPaise: Math.max(low, high) };
    priceText = range[0];
  } else if (above) {
    budget = { minPaise: toPaise(above[1] ?? above[3], above[2] ?? above[4]) };
    priceText = above[0];
  } else if (below) {
    budget = { maxPaise: toPaise(below[1] ?? below[3], below[2] ?? below[4]) };
    priceText = below[0];
  } else {
    for (const match of search.matchAll(PRICE_BARE)) {
      const paise = toPaise(match[2], match[3]);
      if (match[1] || match[3] || (paise >= MIN_BARE_PRICE * 100 && /(00|99)$/.test(match[2]))) {
        budget = { maxPaise: paise };
        priceText = match[0];
        break;
      }
    }
  }

  // Removes the rupee sign, "rs" and extra spaces.
  const tidy = (text: string) =>
    text
      .replace(/₹|\brs\b\.?/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  const highest = Math.max(budget.maxPaise ?? 0, budget.minPaise ?? 0);
  if (!priceText || highest < 10000 || highest > MAX_BUDGET_PAISE) return { text: tidy(search) };

  const bare = !range && !above && !below;
  return { text: tidy(search.replace(priceText, " ")), ...budget, ...(bare && { bare }) };
}

// Reads a question into filters (price, rating, size, brand, colour, category, who, sort…) and left-over words.
export async function readQuestion(rawText: string): Promise<Question> {
  let text = rawText.replace(/[ऀ-ॿ]+/g, (word) => DEVANAGARI.get(word) ?? word).toLowerCase();
  const rating = text.match(RATING);
  const minRating = Number(rating?.[1] ?? rating?.[2] ?? rating?.[3]);
  if (rating) text = text.replace(rating[0], " ");

  const budget = readBudget(text);
  const vocabulary = await getVocabulary();
  const question: Question = { text: budget.text, words: [] };
  if (budget.minPaise) question.minPaise = budget.minPaise;
  if (budget.maxPaise) question.maxPaise = budget.maxPaise;
  if (minRating >= 1 && minRating <= 5) question.minRating = minRating;

  text = budget.text
    .replace(/\b(?:free|fast|same day|next day|cash on) (?:delivery|shipping)\b/g, " ")
    .replace(/\bnoise[\s-]*cancel+(?:ing|ation)\b/g, "anc")
    .replace(/(\d)\s*watts?\b/g, "$1w")
    .replace(/(\d)\s*(?:ltrs?|lit(?:re|er)s?)\b/g, "$1l")
    .replace(/(\d)\s*(?:gms?|grams?)\b/g, "$1g")
    .replace(/(\d+)\s+(gb|tb|mah|mp|hz|w|kg|g|ml|l)\b/g, "$1$2");
  const size = text.match(SIZE);
  if (size) {
    const [found, sizeAfterWord, sizeBeforeWord, fromAge, toAge] = size;
    question.size = fromAge ? `${fromAge}-${toAge} Years` : (sizeAfterWord ?? sizeBeforeWord).toUpperCase();
    text = text.replace(found, " ");
  }

  // The words of a text without filler words, in base form.
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
  for (const item of SPECIALS) if (item.pattern.test(text)) question[item.filter] = true;
  for (const { pattern } of [...WHO, ...SORTS, ...SPECIALS]) text = text.replace(new RegExp(pattern, "g"), " ");

  const asked = new Set(askedWords(text).filter((word) => !brandWords.includes(word)));
  // Removes the words of the found items from the asked words, so each word is used once.
  const take = <T extends { key: string[] }>(found: T[]) => {
    for (const item of found) [...item.key, item.key.join("")].forEach((word) => asked.delete(word));
    return found;
  };
  const colors = take(findColors(vocabulary.colors, asked));
  const categoryItems = vocabulary.categories.map((category) => ({ ...category, key: keyOf(category.name) }));
  const categories = take(findMentioned(categoryItems, asked));
  const occasions = [...asked].filter((word) => OCCASIONS.has(word));
  occasions.forEach((word) => asked.delete(word));
  const specItems = vocabulary.specs.map((name) => ({ name, key: keyOf(name) }));
  const specs = take(findMentioned(specItems, asked));

  const narrower = categoryItems.filter(
    (other) =>
      !categories.includes(other) &&
      categories.some(
        (category) => other.key.length > category.key.length && category.key.every((word) => other.key.includes(word)),
      ),
  );

  if (brands.length > 0) question.brandIds = brands.map((brand) => brand.id);
  if (colors.length > 0) question.colors = colors.map((color) => color.name);
  const askedIds = categories.map((category) => category.id);
  if (categories.length > 0) {
    const children = vocabulary.categories.filter(
      (category) => category.parentId && askedIds.includes(category.parentId),
    );
    question.categoryIds = [...new Set([...askedIds, ...children.map((category) => category.id)])];
    question.categoryNames = categories.map((category) => withoutPerson(category.name));
    if (narrower.length > 0) {
      question.skipNames = narrower.map((category) => withoutPerson(category.name));
    }
  }
  if (specs.length > 0) question.specs = specs.map((spec) => spec.name);
  if (who) {
    if (who.gender) question.gender = who.gender;
    question.ageGroup = who.ageGroup;
  }
  if (sort) question.sort = sort.sort;
  else if (budget.bare) question.sort = "price_desc";

  const words = [...asked].filter((word) => word.length >= 2 && !/^\d{1,2}$/.test(word) && !/[ऀ-ॿ]/.test(word));
  const namesProductType = categories.some(
    (category) =>
      !(category.parentId && askedIds.includes(category.parentId)) &&
      !vocabulary.categories.some((other) => other.parentId === category.id),
  );
  if (occasions.length > 0 && namesProductType) question.occasions = occasions;
  else words.push(...occasions);
  question.words = words.slice(0, MAX_WORDS);
  const modelNumbers = [...asked].filter((word) => /^\d{1,2}$/.test(word));
  if (modelNumbers.length > 0 && question.words.length > 0) question.modelNumbers = modelNumbers;
  if (question.words.length > 1 && JOINER.test(text)) question.anyWord = true;
  return question;
}

// SQL conditions for the hard filters: visible product, brand, category, colour, who, price, rating, offer, size, spec.
function filterSql(question: Question): Prisma.Sql[] {
  const where = [VISIBLE_PRODUCT];
  if (question.brandIds) {
    where.push(Prisma.sql`product."brandId" IN (${Prisma.join(question.brandIds)})`);
  }
  if (question.categoryIds && question.categoryNames) {
    const inCategory = Prisma.sql`product."categoryId" IN (${Prisma.join(question.categoryIds)})`;
    if (question.words.length > 0 || question.gender || question.ageGroup) {
      const byName = question.categoryNames.map(nameMatch);
      const notNarrower = (question.skipNames ?? []).map((name) => Prisma.sql`NOT (${nameMatch(name)})`);
      const byNameOnly = Prisma.join([Prisma.sql`(${Prisma.join(byName, " OR ")})`, ...notNarrower], " AND ");
      where.push(Prisma.sql`(${inCategory} OR (${byNameOnly}))`);
    } else {
      where.push(inCategory);
    }
  }
  if (question.colors) {
    const named = Prisma.join(question.colors.map(nameMatch), " OR ");
    const hasColor = Prisma.sql`product."colors" && ARRAY[${Prisma.join(question.colors)}]::text[]`;
    where.push(Prisma.sql`(${hasColor} OR (cardinality(product."colors") = 0 AND (${named})))`);
  }
  if (question.gender) {
    where.push(Prisma.sql`(product."gender" IN (${Prisma.join(question.gender)}) OR product."gender" IS NULL)`);
  }
  if (question.ageGroup) {
    where.push(Prisma.sql`(product."ageGroup" = ${question.ageGroup} OR product."ageGroup" IS NULL)`);
  }
  if (question.minPaise) where.push(Prisma.sql`product."sellPaise" >= ${question.minPaise}`);
  if (question.maxPaise) where.push(Prisma.sql`product."sellPaise" <= ${question.maxPaise}`);
  if (question.minRating) where.push(Prisma.sql`product."ratingAverage" >= ${question.minRating}`);
  if (question.discount) where.push(ON_OFFER);
  if (question.trending) where.push(Prisma.sql`product."isTrending"`);
  if (question.featured) where.push(Prisma.sql`product."isFeatured"`);
  if (question.size) where.push(Prisma.sql`${question.size} ILIKE ANY(product."sizes")`);
  if (question.specs && !question.categoryIds) {
    for (const key of question.specs) where.push(Prisma.sql`product."specs" ->> ${key}::text IS NOT NULL`);
  }
  return where;
}

// The hard filters plus the words: size words like "5kg" must match, and most of the other words must match.
function whereFor(question: Question) {
  const where = filterSql(question);
  if (question.words.length === 0) return where;

  const units = question.words.filter((word) => UNIT_WORD.test(word));
  const others = question.words.filter((word) => !UNIT_WORD.test(word));
  let need: number;
  if (question.anyWord) need = 1;
  else if (others.length <= 2) need = others.length;
  else need = Math.ceil(others.length / 2);
  where.push(...units.map(textMatch));
  if (others.length > 0) {
    where.push(
      Prisma.sql`(${Prisma.join(others.map(textMatch), " OR ")})`,
      Prisma.sql`${countOf(others, textMatch)} >= ${need}`,
    );
  }
  return where;
}

// Instant search: ids of matching products, asked category first, name matches next, then mixed across categories.
async function searchDb(question: Question, limit: number, extraWhere: Prisma.Sql[]): Promise<string[]> {
  const nameWords = [...question.words, ...(question.modelNumbers ?? [])];
  const nameHits: Prisma.Sql[] = [];
  if (question.words.length > 0) nameHits.push(Prisma.sql`${countOf(nameWords, nameMatch)} DESC`);
  const rank = [...nameHits];
  if (question.words.length > 0) rank.push(Prisma.sql`${countOf(question.words, textMatch)} DESC`);
  if (question.occasions) {
    const nameHasOccasion = Prisma.join(question.occasions.map(nameMatch), " OR ");
    const textHasOccasion = Prisma.join(question.occasions.map(textMatch), " OR ");
    rank.push(Prisma.sql`(${nameHasOccasion}) DESC`, Prisma.sql`(${textHasOccasion}) DESC`);
  }
  let sortName = question.sort;
  if (!sortName) sortName = question.discount ? "discount" : "latest";
  const sort = SORT_SQL[sortName];
  const specs = (question.specs ?? []).map(
    (key) => Prisma.sql`substring(product."specs" ->> ${key}::text from ${SPEC_NUMBER}::text)::numeric
      * (CASE WHEN product."specs" ->> ${key}::text ~* ${SPEC_BIG_UNIT}::text THEN 1000 ELSE 1 END) DESC NULLS LAST`,
  );
  const byPrice = question.sort === "price_asc" || question.sort === "price_desc";
  if (byPrice) rank.push(sort, ...specs);
  else rank.push(...specs, sort);
  rank.push(Prisma.sql`product."id" DESC`);

  const order: Prisma.Sql[] = [];
  if (question.categoryIds) {
    order.push(Prisma.sql`(product."categoryId" IN (${Prisma.join(question.categoryIds)})) DESC`);
  }
  order.push(...nameHits);
  if (!question.sort) {
    order.push(Prisma.sql`ROW_NUMBER() OVER (PARTITION BY product."categoryId" ORDER BY ${Prisma.join(rank, ", ")})`);
  }
  order.push(...rank);

  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT product."id" FROM "Product" product
    WHERE ${Prisma.join([...whereFor(question), ...extraWhere], " AND ")}
    ORDER BY ${Prisma.join(order, ", ")}
    LIMIT ${limit}`;
  return rows.map((row) => row.id);
}

// The embedding of a question text, from Redis or Gemini (kept 7 days).
async function queryVector(text: string): Promise<string> {
  const key = `ai:vector:${hashOf(text.toLowerCase())}`;
  const saved = await redis.get(key).catch(() => null);
  if (saved) return saved;

  const [values] = await embedTexts([text], "RETRIEVAL_QUERY");
  const vector = `[${values.join(",")}]`;
  await redis.set(key, vector, "EX", QUERY_VECTOR_SECONDS).catch(() => null);
  return vector;
}

// Embedding search: the closest products by meaning that pass the hard filters (looks at most 5,000 nearest products).
async function searchByMeaning(question: Question, extraWhere: Prisma.Sql[]): Promise<string[]> {
  const vector = await queryVector(question.text);
  const distance = Prisma.sql`(product."embedding" <=> ${vector}::halfvec) < ${MAX_DISTANCE}`;
  const where = [...filterSql(question), ...extraWhere, distance];

  const [, , rows] = await prisma.$transaction([
    prisma.$executeRaw`SET LOCAL hnsw.iterative_scan = strict_order`,
    prisma.$executeRaw`SET LOCAL hnsw.max_scan_tuples = 5000`,
    prisma.$queryRaw<{ id: string }[]>`
      SELECT product."id" FROM "Product" product
      WHERE ${Prisma.join(where, " AND ")}
      ORDER BY product."embedding" <=> ${vector}::halfvec
      LIMIT ${MAX_RESULTS}`,
  ]);
  return rows.map((row) => row.id);
}

// Fresh cards for the ids, in order and with the same filters, so cached ids never show a hidden product.
async function liveCards(ids: string[], question: Question): Promise<Card[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.$queryRaw<CardRow[]>`
    SELECT ${CARD_COLUMNS} FROM "Product" product
    WHERE product."id" IN (${Prisma.join(ids)}) AND ${Prisma.join(filterSql(question), " AND ")}`;
  const cards = new Map(
    rows.map((row) => [row.id, { ...productCard(row), gender: row.gender, ageGroup: row.ageGroup }]),
  );
  return ids.flatMap((id) => cards.get(id) ?? []);
}

// Spelling search for the search box: names, brands or categories spelled like the text; stops after 2 seconds.
async function searchBySpelling(question: Question, extraWhere: Prisma.Sql[]): Promise<string[]> {
  const text = question.text;
  const where = Prisma.join([...filterSql(question), ...extraWhere], " AND ");
  try {
    const [, rows] = await prisma.$transaction([
      prisma.$executeRaw`SET LOCAL statement_timeout = '2s'`,
      prisma.$queryRaw<{ id: string }[]>`
        SELECT product."id", similarity(product."name", ${text}) AS score FROM "Product" product
        WHERE ${where} AND product."name" % ${text}
        UNION
        SELECT product."id", similarity(product."name", ${text}) FROM "Product" product
        WHERE ${where} AND product."brandId" IN (SELECT "id" FROM "Brand" WHERE "name" % ${text})
        UNION
        SELECT product."id", similarity(product."name", ${text}) FROM "Product" product
        WHERE ${where} AND product."categoryId" IN (
          SELECT category."id" FROM "Category" category LEFT JOIN "Category" parent ON parent."id" = category."parentId"
          WHERE category."name" % ${text} OR parent."name" % ${text})
        ORDER BY 2 DESC
        LIMIT ${MAX_RESULTS}`,
    ]);
    return rows.map((row) => row.id);
  } catch (error) {
    logger.warn("Spelling search failed", { error: (error as Error).message });
    return [];
  }
}

// Matching ids in rank order (instant, then embedding, then spelling search if asked) and the SQL that matches them.
export async function searchIds(
  question: Question,
  limit: number,
  options: { where?: Prisma.Sql[]; spelling?: boolean } = {},
) {
  const extraWhere = options.where ?? [];
  const cacheKey = `ai:db:${limit}:${hashOf({ ...question, text: undefined, extraWhere })}`;
  const ids = await getOrSetCache(cacheKey, () => searchDb(question, limit, extraWhere));
  if (ids.length > 0) return { ids, similar: false, match: whereFor(question) };
  if (question.words.length === 0) return { ids, similar: false, match: [] };

  const key = hashOf({ question, extraWhere });
  let similar: string[] = [];
  if (geminiReady) {
    similar = await getOrSetCache(`ai:meaning:${key}`, () => searchByMeaning(question, extraWhere)).catch((error) => {
      logger.warn("Meaning search failed", { error: error.message });
      return [];
    });
  }
  if (similar.length === 0 && options.spelling) {
    similar = await getOrSetCache(`ai:spelling:${key}`, () => searchBySpelling(question, extraWhere));
  }
  const match: Prisma.Sql[] = [];
  if (similar.length > 0) {
    match.push(VISIBLE_PRODUCT, Prisma.sql`product."id" IN (${Prisma.join(similar)})`);
  }
  return { ids: similar, similar: similar.length > 0, match };
}

// One page (5 products) of assistant results, and whether to ask who it is for when men/women or kids/adults mix.
export async function findProducts(question: Question, page: number) {
  const { ids, similar } = await searchIds(question, MAX_RESULTS);
  const cards = await liveCards(ids, question);
  if (similar && question.sort === "price_asc") {
    cards.sort((first, second) => first.finalPricePaise - second.finalPricePaise);
  }
  if (similar && question.sort === "price_desc") {
    cards.sort((first, second) => second.finalPricePaise - first.finalPricePaise);
  }
  if (similar && question.sort === "rating") {
    cards.sort((first, second) => second.rating.average - first.rating.average);
  }
  if (similar && question.sort === "discount") {
    cards.sort((first, second) => second.discountPercent - first.discountPercent);
  }

  const genders = new Set(cards.map((card) => card.gender));
  const ages = new Set(cards.map((card) => card.ageGroup));
  const isMixed = (genders.has("Men") && genders.has("Women")) || (ages.has("Kids") && ages.has("Adult"));

  return {
    products: cards.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    hasMore: cards.length > (page + 1) * PAGE_SIZE,
    askWho: page === 0 && !question.gender && !question.ageGroup && isMixed,
    similar,
  };
}

// Up to 12 different values of a column among the products that match the question.
async function valuesFor(question: Question, column: Prisma.Sql): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ value: string }[]>`
    SELECT DISTINCT ${column} AS value FROM "Product" product
    WHERE ${Prisma.join(whereFor(question), " AND ")} LIMIT 12`;
  return rows
    .map((row) => row.value)
    .filter(Boolean)
    .sort((first, second) => first.localeCompare(second, "en", { numeric: true }));
}

// One number (like MIN or MAX of a column) among the products that match the question.
async function numberFor(question: Question, column: Prisma.Sql): Promise<number | null> {
  const [row] = await prisma.$queryRaw<{ value: number | null }[]>`
    SELECT ${column} AS value FROM "Product" product WHERE ${Prisma.join(whereFor(question), " AND ")}`;
  return row.value === null ? null : Number(row.value);
}

// When nothing matched, what the store does have: other colours, sizes, brands, prices or ratings (cached).
export async function findAlternative(question: Question): Promise<Alternative | null> {
  return getOrSetCache(`ai:alternative:${hashOf({ ...question, text: undefined })}`, async () => {
    if (question.colors) {
      const values = await valuesFor({ ...question, colors: undefined }, Prisma.sql`unnest(product."colors")`);
      if (values.length > 0) return { kind: "colour", values: values.join(", ") };
    }
    if (question.size) {
      const values = await valuesFor({ ...question, size: undefined }, Prisma.sql`unnest(product."sizes")`);
      if (values.length > 0) return { kind: "size", values: values.join(", ") };
    }
    if (question.brandIds) {
      const values = await valuesFor(
        { ...question, brandIds: undefined },
        Prisma.sql`(SELECT brand."name" FROM "Brand" brand WHERE brand."id" = product."brandId")`,
      );
      if (values.length > 0) return { kind: "brand", values: values.join(", ") };
    }
    if (question.maxPaise) {
      const cheapest = await numberFor({ ...question, maxPaise: undefined }, Prisma.sql`MIN(product."sellPaise")`);
      if (cheapest !== null) return { kind: "cheaper", values: priceText(cheapest) };
    }
    if (question.minPaise) {
      const highest = await numberFor({ ...question, minPaise: undefined }, Prisma.sql`MAX(product."sellPaise")`);
      if (highest !== null) return { kind: "costlier", values: priceText(highest) };
    }
    if (question.minRating) {
      const best = await numberFor({ ...question, minRating: undefined }, Prisma.sql`MAX(product."ratingAverage")`);
      if (best) return { kind: "rating", values: best.toFixed(1) };
    }
    return null;
  });
}
