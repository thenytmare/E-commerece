'use client';

import React, { useState } from 'react';
import { BellRing, Check } from 'lucide-react';
import { subscribeBackInStock } from '@/lib/actions/back-in-stock';

/** Out-of-stock "notify me when available" capture, shown on the product page. */
export function BackInStockForm({ productId }: { productId: string }) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = contact.trim();
    if (!value) return;

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('productId', productId);
    // Accept either an email or a phone number in the single field.
    if (value.includes('@')) {
      formData.append('email', value);
    } else {
      formData.append('phone', value);
    }

    const result = await subscribeBackInStock(null, formData);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        <Check className="h-4 w-4 text-primary" />
        We&apos;ll let you know as soon as this is back in stock.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 border-2 border-primary text-primary rounded-lg font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
      >
        <BellRing className="h-5 w-5" />
        Notify me when available
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <label htmlFor="back-in-stock-contact" className="text-sm text-muted-foreground block">
        Enter your email or phone number
      </label>
      <div className="flex gap-2">
        <input
          id="back-in-stock-contact"
          type="text"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          placeholder="you@example.com or +2547..."
          required
          disabled={submitting}
          className="flex-1 bg-background border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={submitting || !contact.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Saving...' : 'Notify me'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
