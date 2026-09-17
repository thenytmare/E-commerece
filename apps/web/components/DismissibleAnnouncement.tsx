'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

/**
 * The announcement strip, with a close control.
 *
 * Dismissal is keyed on the message itself, so changing the text brings the
 * bar back for everyone rather than staying hidden for anyone who closed the
 * previous one.
 */
const STORAGE_KEY = 'storefront:announcement-dismissed';

function keyFor(message: string): string {
  // Cheap, stable hash — this only needs to change when the message does.
  let hash = 0;
  for (let i = 0; i < message.length; i += 1) {
    hash = (hash * 31 + message.charCodeAt(i)) | 0;
  }
  return String(hash);
}

export function DismissibleAnnouncement({ message }: { message: string }) {
  // Rendered on the server, so it starts visible and hides after mount if this
  // browser already dismissed it — never the other way round, which would
  // flash the bar at everyone who had closed it.
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(STORAGE_KEY) === keyFor(message));
    } catch {
      // Private mode — just leave it visible.
    }
  }, [message]);

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, keyFor(message));
    } catch {
      // Not persisting is fine; it stays hidden for this page view.
    }
  };

  return (
    <div className="relative bg-primary px-10 py-2 text-center text-sm text-primary-foreground">
      {message}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 transition-opacity hover:opacity-80"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
