/**
 * Generates a URL-safe slug from a string.
 * Converts to lowercase, replaces non-alphanumeric characters with hyphens,
 * collapses multiple hyphens, and trims leading/trailing hyphens.
 *
 * @example
 *   slugify('Oraimo Spacebuds Neo+')  // => 'oraimo-spacebuds-neo'
 *   slugify('Samsung Galaxy Watch 6')  // => 'samsung-galaxy-watch-6'
 */
export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')           // Replace spaces with hyphens
    .replace(/[^\w-]+/g, '')        // Remove all non-word chars (keep hyphens)
    .replace(/--+/g, '-')           // Collapse multiple hyphens into one
    .replace(/^-+/, '')             // Trim hyphens from start
    .replace(/-+$/, '');            // Trim hyphens from end
}

/**
 * Ensures a slug is unique by appending a suffix if needed.
 * @param generateSlug - function that takes a candidate suffix and returns whether it's taken
 * @param baseSlug - the initial slug to start with
 * @returns a unique slug
 *
 * @example
 *   const unique = await uniqueSlug(
 *     (slug) => db.product.count({ where: { slug } }).then(c => c > 0),
 *     'oraimo-spacebuds-neo'
 *   );
 *   // => 'oraimo-spacebuds-neo' or 'oraimo-spacebuds-neo-2'
 */
export async function uniqueSlug(
  isTaken: (slug: string) => Promise<boolean>,
  baseSlug: string,
): Promise<string> {
  let slug = baseSlug;
  let counter = 2;

  while (await isTaken(slug)) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}