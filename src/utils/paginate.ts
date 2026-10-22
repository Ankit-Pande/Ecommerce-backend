// Prisma options for one page: one extra row tells if there is a next page, and the cursor row itself is skipped.
export function pageQuery(cursor: string | undefined, limit: number) {
  return { take: limit + 1, ...(cursor && { cursor: { id: cursor }, skip: 1 }) };
}

// Cuts the extra row off and returns the page items with the next cursor (null on the last page).
export function paginate<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
