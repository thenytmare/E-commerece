'use client';

import { useState, useTransition } from 'react';
import { Button, Heading, Text } from '@repo/ui';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { deleteMyAccountAction } from '@/lib/actions/account';

export function DeleteAccountSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await deleteMyAccountAction();
      // On success the action redirects server-side and this line is never
      // reached — only a failure returns here.
      if (result?.success === false) {
        setError(result.error ?? 'Could not delete your account. Please try again or contact support.');
        setIsOpen(false);
      }
    });
  };

  return (
    <div className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
      <Heading as="h2" size="sm" className="mb-2">
        Delete account
      </Heading>
      <Text variant="muted" className="mb-4">
        Permanently remove your personal details from your account. Your past order history is kept, as
        required for legal and tax record-keeping — see our{' '}
        <a href="/privacy" className="underline underline-offset-4">
          privacy policy
        </a>
        .
      </Text>
      {error ? (
        <Text className="mb-4 text-destructive">
          {error}
        </Text>
      ) : null}
      <Button variant="destructive" size="sm" onClick={() => setIsOpen(true)}>
        Delete my account
      </Button>
      <ConfirmationDialog
        isOpen={isOpen}
        title="Delete your account?"
        description="This removes your name, email, and phone number from your account and signs you out. It cannot be undone. Past orders are kept on record as required by law, but are no longer linked to your personal details after this."
        confirmText="Delete my account"
        cancelText="Keep my account"
        variant="danger"
        isLoading={isPending}
        onConfirm={handleConfirm}
        onCancel={() => setIsOpen(false)}
      />
    </div>
  );
}
