// Makes every word start with a capital letter ("navy blue" -> "Navy Blue").
export function titleCase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
