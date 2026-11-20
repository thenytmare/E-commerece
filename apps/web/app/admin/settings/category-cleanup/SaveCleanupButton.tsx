'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { applyCategoryCleanupAction } from '@/lib/actions/admin-category-cleanup';

export function SaveCleanupButton({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const save = () => {
    startTransition(async () => {
      const outcome = await applyCategoryCleanupAction();
      setResult(outcome);
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <div className="flex flex-col gap-3">
      {result && (
        <p
          role={result.success ? 'status' : 'alert'}
          className={
            result.success
              ? 'rounded-md border border-green-600/30 bg-green-600/10 p-3 text-sm'
              : 'rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm'
          }
        >
          {result.message}
        </p>
      )}
      <div>
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => setOpen(true)}
          className="min-h-[44px] rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Save the clean-up
        </button>
      </div>
      <ConfirmationDialog
        isOpen={open}
        title="Save the category clean-up?"
        description="All products move to the 11 new categories and the old categories are removed. Have you taken a database backup in Coolify?"
        confirmText="Yes, save it"
        variant="warning"
        isLoading={pending}
        onCancel={() => setOpen(false)}
        onConfirm={save}
      />
    </div>
  );
}
