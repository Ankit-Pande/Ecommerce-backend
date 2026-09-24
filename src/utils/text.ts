// "red" / "RED" -> "Red". Admin colour likhte waqt aur catalog filter padhte waqt —
// dono jagah ek hi normalization, warna "red" filter "Red" products ko kabhi nahi dhundhega.
export function titleCase(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
