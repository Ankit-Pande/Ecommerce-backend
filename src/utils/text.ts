// "red" ya "RED" ko "Red" banao, taaki colour filter hamesha match kare.
export function titleCase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
