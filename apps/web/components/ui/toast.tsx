'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';

/**
 * Toast notifications.
 *
 * Replaces the native `window.alert()` calls the admin panel used for every
 * failed action — those block the main thread, can't be styled, and looked
 * nothing like the rest of the UI.
 */
export type ToastVariant = 'success' | 'error' | 'info';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/** Errors stay up longer — they usually need reading, not just noticing. */
const AUTO_DISMISS_MS: Record<ToastVariant, number> = {
  success: 4000,
  info: 5000,
  error: 8000,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (message: string, variant: ToastVariant = 'info') => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), AUTO_DISMISS_MS[variant])
      );
    },
    [dismiss]
  );

  // Clear pending timers on unmount so a dismissed provider can't schedule
  // state updates against an unmounted tree.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES: Record<ToastVariant, { wrapper: string; Icon: typeof Info }> = {
  success: {
    wrapper: 'border-success/40 bg-success/10 text-foreground',
    Icon: CheckCircle2,
  },
  error: {
    wrapper: 'border-destructive/40 bg-destructive/10 text-foreground',
    Icon: AlertTriangle,
  },
  info: {
    wrapper: 'border-info/40 bg-info/10 text-foreground',
    Icon: Info,
  },
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      // `polite` so a toast is announced without interrupting whatever the
      // screen reader is currently saying.
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map(({ id, message, variant }) => {
        const { wrapper, Icon } = VARIANT_STYLES[variant];
        return (
          <div
            key={id}
            role={variant === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-elevated backdrop-blur ${wrapper}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p className="flex-1 text-sm">{message}</p>
            <button
              type="button"
              onClick={() => onDismiss(id)}
              className="shrink-0 rounded text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside a <ToastProvider>');
  }
  return context;
}
