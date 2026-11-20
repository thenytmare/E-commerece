import { permanentRedirect } from 'next/navigation';

/** Saved items moved to /saved, which works for guests too. Old links still land there. */
export default function OldWishlistPage() {
  permanentRedirect('/saved');
}
