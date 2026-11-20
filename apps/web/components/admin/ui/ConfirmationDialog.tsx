'use client';

import React, { useCallback, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { useFocusTrap } from '@/lib/hooks/use-focus-trap';

interface ConfirmationDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function ConfirmationDialog({
  isOpen,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  onConfirm,
  onCancel,
  isLoading,
}: ConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(() => {
    if (!isLoading) onCancel();
  }, [isLoading, onCancel]);

  // Traps Tab inside the dialog, locks background scroll, and restores focus
  // to whatever opened it.
  useFocusTrap(dialogRef, isOpen, handleEscape);

  if (!isOpen) return null;

  const bgIconClass =
    variant === 'danger'
      ? 'bg-destructive/10 text-destructive'
      : variant === 'warning'
        ? 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
        : 'bg-blue-500/10 text-blue-600 dark:text-blue-400';

  const btnConfirmClass =
    variant === 'danger'
      ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'
      : variant === 'warning'
        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
        : 'bg-primary hover:bg-primary/90 text-primary-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={isLoading ? undefined : onCancel}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmation-dialog-title"
        aria-describedby="confirmation-dialog-description"
        className="bg-card shadow-elevated border-border relative w-full max-w-md transform overflow-hidden rounded-lg border transition-all"
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${bgIconClass}`}
            >
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3
                id="confirmation-dialog-title"
                className="text-foreground mb-1 text-lg font-semibold"
              >
                {title}
              </h3>
              <p id="confirmation-dialog-description" className="text-muted-foreground text-sm">
                {description}
              </p>
            </div>
            <button
              onClick={isLoading ? undefined : onCancel}
              className="text-muted-foreground hover:text-foreground"
              disabled={isLoading}
              aria-label="Close confirmation dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="bg-muted/50 border-border flex items-center justify-end gap-3 border-t px-6 py-4">
          <button
            onClick={onCancel}
            disabled={isLoading}
            ref={cancelButtonRef}
            className="border-border bg-background hover:bg-muted text-foreground rounded-md border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex min-w-[80px] items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${btnConfirmClass}`}
          >
            {isLoading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
