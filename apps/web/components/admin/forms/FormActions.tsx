'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface FormActionsProps {
  onCancel?: () => void;
  cancelText?: string;
  submitText?: string;
  isSubmitting?: boolean;
}

export function FormActions({ 
  onCancel, 
  cancelText = 'Cancel', 
  submitText = 'Save', 
  isSubmitting 
}: FormActionsProps) {
  return (
    <div className="flex items-center justify-end gap-3 pt-6 border-t border-border mt-6">
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium border border-border bg-background rounded-md text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {cancelText}
        </button>
      )}
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex items-center justify-center min-w-[100px] px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : submitText}
      </button>
    </div>
  );
}
