export function pageQuery(cursor: string | undefined, limit: number) {
  return { take: limit + 1, ...(cursor && { cursor: { id: cursor }, skip: 1 }) };
}

export function paginate<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
