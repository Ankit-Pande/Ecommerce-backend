// Chat message se filters nikalo BINA LLM ke — 80% sawal yahin handle (plan ke mutabik).
// "red nike shoes under 2000" -> { color: "red", maxPrice: 2000, term: "nike shoes" }

export type ParsedQuery = {
  term: string;              // filters hatane ke baad bacha search text
  color?: string;
  maxPrice?: number;         // rupee
  minPrice?: number;
  brandId?: string;
  categoryId?: string;
};

const COLORS = [
  "black", "white", "red", "blue", "green", "yellow", "pink", "grey", "gray",
  "brown", "orange", "purple", "gold", "silver",
  // Hindi bhi — "lal wale joote"
  "kala", "safed", "lal", "neela", "hara", "peela", "gulabi",
];
const HINDI_COLOR: Record<string, string> = {
  kala: "black", safed: "white", lal: "red", neela: "blue",
  hara: "green", peela: "yellow", gulabi: "pink", gray: "grey",
};

// "500", "2k", "1.5k", "50k" -> rupee number.
function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(/,/g, ""));
  return /k$/i.test(raw) ? Math.round(n * 1000) : Math.round(n);
}

export function parseQuery(
  message: string,
  brands: { id: string; name: string }[],
  categories: { id: string; name: string }[]
): ParsedQuery {
  let text = ` ${message.toLowerCase()} `;
  const out: ParsedQuery = { term: "" };

  // Price max: "under/upto 2000" (keyword pehle) YA "5000 tak / 2k ke andar" (number pehle).
  const maxM = text.match(/(?:under|below|upto|up to|se kam|max)\s*(?:rs\.?|₹)?\s*([\d,.]+k?)/i);
  if (maxM) { out.maxPrice = parseAmount(maxM[1]); text = text.replace(maxM[0], " "); }
  const maxHi = text.match(/(?:rs\.?|₹)?\s*([\d,.]+k?)\s*(?:tak|ke andar|ke niche|se kam)/i);
  if (!out.maxPrice && maxHi) { out.maxPrice = parseAmount(maxHi[1]); text = text.replace(maxHi[0], " "); }
  const minM = text.match(/(?:above|over|min|se zyada|se upar)\s*(?:rs\.?|₹)?\s*([\d,.]+k?)/i);
  if (minM) { out.minPrice = parseAmount(minM[1]); text = text.replace(minM[0], " "); }

  // Color — pehla match.
  for (const c of COLORS) {
    if (text.includes(` ${c} `)) {
      out.color = HINDI_COLOR[c] ?? c;
      text = text.replace(` ${c} `, " ");
      break;
    }
  }

  // Brand/category naam message me ho to id laga do (search tight ho jaati hai).
  for (const b of brands) {
    if (text.includes(` ${b.name.toLowerCase()} `)) { out.brandId = b.id; break; }
  }
  for (const c of categories) {
    if (text.includes(` ${c.name.toLowerCase()} `)) { out.categoryId = c.id; break; }
  }

  out.term = text.replace(/\s+/g, " ").trim();
  return out;
}

// "10 dikhao / top 5 / 8 options" -> kitne products chahiye. Default 3, max 20.
// Price se clash nahi hota — "5000 tak" me tak/under count-words nahi hain.
export function parseCount(message: string): number | null {
  const m = message.toLowerCase().match(
    /\b(?:top|best)\s*(\d{1,2})\b|\b(\d{1,2})\s*(?:items?|products?|options?|piece|dikhao|dikha do|chahiye)\b/
  );
  if (!m) return null;
  const n = parseInt(m[1] ?? m[2], 10);
  return Math.min(Math.max(n, 3), 20);
}

// "lal shoes aur black pant" -> alag-alag items (max 3). Split na bane to poora message hi.
export function splitItems(message: string): string[] {
  const parts = message
    .split(/\s+aur\s+|\s+and\s+|,/i)
    .map((p) => p.trim())
    .filter((p) => p.length >= 3);
  return parts.length >= 2 ? parts.slice(0, 3) : [message];
}
