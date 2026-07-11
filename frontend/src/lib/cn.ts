/**
 * Join conditional class names. Falsy parts are dropped.
 * Kept dependency-free; primitives are authored so later classes win where
 * it matters, so a tailwind-merge dependency isn't needed yet.
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
