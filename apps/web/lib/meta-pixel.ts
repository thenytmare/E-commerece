/**
 * Meta (Facebook/Instagram) Pixel configuration.
 *
 * The pixel only runs once an ID is set — leaving the env var unset keeps the
 * storefront exactly as it is today, so this is safe to ship before the
 * marketing side of things is ready.
 */
export function getMetaPixelId(): string | undefined {
  const id = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  return id && id.trim() !== '' ? id.trim() : undefined;
}

export function isMetaPixelConfigured(): boolean {
  return getMetaPixelId() !== undefined;
}
