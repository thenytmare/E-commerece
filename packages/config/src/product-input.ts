import { z } from 'zod';

/**
 * Checks for the nested JSON the admin product form sends (variants, images,
 * features). Everything is validated before anything is written, so a bad
 * payload can never leave a product half updated.
 */

const MAX_VARIANTS = 50;
const MAX_IMAGES = 50;
const MAX_FEATURES = 50;

const price = z.number().finite().min(0, 'Variant price cannot be negative').max(100_000_000);

export const variantInputSchema = z.object({
  id: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1, 'Each variant needs a name').max(100),
  hex: z.string().trim().regex(/^#[0-9a-fA-F]{3,8}$/, 'Variant colour must be a hex value like #FF0000'),
  price: price.optional(),
  /** On-hand stock. Existing rows require expectedStock for concurrency checks. */
  stock: z.number().int().min(0, 'Stock cannot be negative').max(1_000_000).optional(),
  expectedStock: z.number().int().min(0).max(1_000_000).optional(),
});

export type VariantInput = z.infer<typeof variantInputSchema>;

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function parseJson(raw: string | null | undefined): { ok: true; value: unknown } | { ok: false } {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(raw) };
  } catch {
    return { ok: false };
  }
}

function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Invalid data';
}

/** Returns undefined when the field was not sent at all. */
export function parseVariantsJson(raw: string | null | undefined): ParseResult<VariantInput[] | undefined> {
  const json = parseJson(raw);
  if (!json.ok) return { ok: false, error: 'The variants data is not valid.' };
  if (json.value === undefined) return { ok: true, value: undefined };

  const parsed = z.array(variantInputSchema).max(MAX_VARIANTS).safeParse(json.value);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const ids = parsed.data.map((v) => v.id).filter((id): id is string => Boolean(id));
  if (new Set(ids).size !== ids.length) {
    return { ok: false, error: 'The same variant was sent twice.' };
  }
  return { ok: true, value: parsed.data };
}

export function parseImageUrlsJson(raw: string | null | undefined): ParseResult<string[] | undefined> {
  const json = parseJson(raw);
  if (!json.ok) return { ok: false, error: 'The image list is not valid.' };
  if (json.value === undefined) return { ok: true, value: undefined };
  const parsed = z.array(z.string().trim().min(1).max(2048)).max(MAX_IMAGES).safeParse(json.value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: 'The image list is not valid.' };
}

export function parseImageVariantsJson(raw: string | null | undefined): ParseResult<(number | null)[]> {
  const json = parseJson(raw);
  if (!json.ok) return { ok: false, error: 'The image variant data is not valid.' };
  if (json.value === undefined) return { ok: true, value: [] };
  const parsed = z
    .array(z.number().int().min(0).nullable())
    .max(MAX_IMAGES)
    .safeParse(json.value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: 'The image variant data is not valid.' };
}

export function parseFeaturesJson(raw: string | null | undefined): ParseResult<string[] | undefined> {
  const json = parseJson(raw);
  if (!json.ok) return { ok: false, error: 'The features list is not valid.' };
  if (json.value === undefined) return { ok: true, value: undefined };
  const parsed = z.array(z.string().trim().min(1).max(300)).max(MAX_FEATURES).safeParse(json.value);
  return parsed.success
    ? { ok: true, value: parsed.data }
    : { ok: false, error: 'The features list is not valid.' };
}
