'use client';

import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

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
  isLoading
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  const bgIconClass = 
    variant === 'danger' ? 'bg-destructive/10 text-destructive' : 
    variant === 'warning' ? 'bg-yellow-500/10 text-yellow-600' : 
    'bg-blue-500/10 text-blue-600';

  const btnConfirmClass = 
    variant === 'danger' ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground' : 
    variant === 'warning' ? 'bg-yellow-600 hover:bg-yellow-700 text-white' : 
    'bg-primary hover:bg-primary/90 text-primary-foreground';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={isLoading ? undefined : onCancel} />
      <div className="relative bg-card rounded-lg shadow-elevated w-full max-w-md overflow-hidden transform transition-all border border-border">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center ${bgIconClass}`}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <button 
              onClick={isLoading ? undefined : onCancel}
              className="text-muted-foreground hover:text-foreground"
              disabled={isLoading}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="bg-muted/50 px-6 py-4 flex items-center justify-end gap-3 border-t border-border">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-border bg-background hover:bg-muted text-foreground font-medium rounded-md text-sm transition-colors disabled:opacity-50"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 font-medium rounded-md text-sm transition-colors flex items-center justify-center min-w-[80px] disabled:opacity-50 ${btnConfirmClass}`}
          >
            {isLoading ? <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full" /> : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
