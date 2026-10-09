// DB se limit+1 row mangao; ek extra aayi to agla page hai, uska nextCursor do.
export function paginate<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}

// List ki DB query ke liye: limit se ek row zyada lo, aur cursor ho to uske baad se shuru karo.
export function pageQuery(cursor: string | undefined, limit: number) {
  return { take: limit + 1, ...(cursor && { cursor: { id: cursor }, skip: 1 }) };
}

// Rows ko usi kram me lagao jis kram me ids di gayi hain.
export function orderByIds<T extends { id: string }>(rows: T[], ids: string[]): T[] {
  const position = new Map(ids.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}
