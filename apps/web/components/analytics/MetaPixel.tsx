import { headers } from 'next/headers';
import { getMetaPixelId } from '@/lib/meta-pixel';
import { MetaPixelClient } from './MetaPixelClient';

/**
 * Server-side gate: renders nothing until NEXT_PUBLIC_META_PIXEL_ID is set,
 * and reads the per-request CSP nonce middleware.ts generates so the client
 * component can put it on the script tag.
 */
export async function MetaPixel() {
  const pixelId = getMetaPixelId();
  if (!pixelId) return null;

  const nonce = (await headers()).get('x-nonce') ?? '';
  return <MetaPixelClient pixelId={pixelId} nonce={nonce} />;
}
