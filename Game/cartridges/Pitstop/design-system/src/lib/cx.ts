/* Join class names, dropping anything falsy.
 *
 * Deliberately hand-rolled rather than pulled from `clsx`: this library ships
 * to a design agent that renders it from a bundle, and every dependency added
 * here is one more thing that has to resolve in that runtime. Six lines is a
 * cheaper price than a dependency. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}
