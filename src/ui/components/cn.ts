// Tiny class-name joiner. Avoids pulling in clsx for a 1-call use case.
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}
