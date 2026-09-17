import { z } from 'zod';

/**
 * FormData-oriented field helpers. Everything arriving from a form is a
 * string (or absent), so these normalise on the way in while keeping the
 * inferred output types precise — `z.preprocess` would widen them to
 * `unknown` and defeat the point.
 */

/** Checked boxes submit 'on'; unchecked ones are absent entirely. */
const checkbox = z
  .literal('on')
  .optional()
  .transform((v) => v === 'on');

/** Optional free text: blank collapses to null instead of ''. */
const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const requiredNumber = (message: string) =>
  z
    .string()
    .trim()
    .min(1, message)
    .transform(Number)
    .refine((n) => Number.isFinite(n), message);

const optionalNumber = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? Number(v) : null))
  .refine((n) => n === null || Number.isFinite(n), 'Enter a valid number');

const numberDefaultingToZero = (message: string) =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length > 0 ? Number(v) : 0))
    .refine((n) => Number.isFinite(n) && n >= 0, message);

const integerDefaultingToZero = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? Number(v) : 0))
  .refine((n) => Number.isInteger(n), 'Enter a whole number');

export const productSchema = z.object({
  name: z.string().trim().min(2, 'Product name is required'),
  brandId: z.string().trim().min(1, 'Select a brand'),
  categoryId: z.string().trim().min(1, 'Select a category'),
  basePrice: requiredNumber('Enter a valid price').refine(
    (n) => n >= 0,
    'Price cannot be negative'
  ),
  compareAtPrice: optionalNumber,
  costPrice: numberDefaultingToZero('Cost price cannot be negative'),
  shortDescription: optionalText,
  seoTitle: optionalText,
  seoDescription: optionalText,
  isActive: checkbox,
  isFeatured: checkbox,
  hasVariants: checkbox,
});

export const categorySchema = z.object({
  name: z.string().trim().min(2, 'Category name is required'),
  slug: z.string().trim().min(1, 'Slug is required'),
  description: optionalText,
  imageUrl: optionalText,
  seoTitle: optionalText,
  seoDescription: optionalText,
  sortOrder: integerDefaultingToZero,
  isActive: checkbox,
  isFeatured: checkbox,
});

export const brandSchema = z.object({
  name: z.string().trim().min(2, 'Brand name is required'),
  slug: z.string().trim().min(1, 'Slug is required'),
  description: optionalText,
  logoUrl: optionalText,
  website: optionalText,
  country: optionalText,
  seoTitle: optionalText,
  seoDescription: optionalText,
  isActive: checkbox,
  isFeatured: checkbox,
});

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, 'Coupon code must be at least 3 characters')
      // Spaces and punctuation make a code easy to mistype at checkout.
      .regex(/^[A-Za-z0-9_-]+$/, 'Use only letters, numbers, hyphens and underscores'),
    type: z.enum(['PERCENTAGE', 'FIXED'], {
      errorMap: () => ({ message: 'Select a discount type' }),
    }),
    value: requiredNumber('Enter a valid discount value').refine(
      (n) => n > 0,
      'Discount must be greater than zero'
    ),
    minOrder: optionalNumber,
    maxUses: optionalNumber,
    maxUsesPerCustomer: optionalNumber,
    isActive: checkbox,
  })
  // A percentage above 100 produces a negative order total, which both payment
  // providers reject — leaving an order that exists, holds stock, and can
  // never be paid.
  .refine((data) => data.type !== 'PERCENTAGE' || data.value <= 100, {
    message: 'A percentage discount cannot be more than 100%',
    path: ['value'],
  });

export const storeSettingsSchema = z.object({
  name: z.string().trim().min(2, 'Store name is required'),
  phone: z.string().trim().min(7, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email address'),
  address: optionalText,
  currency: z.string().trim().min(3, 'Currency code is required'),
  whatsappNumber: optionalText,
});

export type ProductInput = z.infer<typeof productSchema>;
export type CategoryInput = z.infer<typeof categorySchema>;
export type BrandInput = z.infer<typeof brandSchema>;
export type CouponInput = z.infer<typeof couponSchema>;
export type StoreSettingsInput = z.infer<typeof storeSettingsSchema>;

export type FieldErrors = Record<string, string>;

/**
 * Validate a FormData payload against a schema, returning either the typed
 * data or a flat field->message map suitable for the admin form components.
 */
export function parseFormData<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData
): { data: z.infer<T>; fieldErrors?: undefined } | { data?: undefined; fieldErrors: FieldErrors } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    raw[key] = value;
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) {
    return { data: parsed.data as z.infer<T> };
  }

  const fieldErrors: FieldErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (typeof field === 'string' && !fieldErrors[field]) {
      fieldErrors[field] = issue.message;
    }
  }
  return { fieldErrors };
}
