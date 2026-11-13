'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function MediaDialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close(); }, []);
  return createPortal(
    <dialog ref={ref} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }}
      onClick={e => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter' && e.target instanceof HTMLInputElement) e.preventDefault(); }}
      className="w-[calc(100%-2rem)] max-w-4xl rounded-lg border border-border bg-card p-0 text-foreground backdrop:bg-black/50">
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" aria-label={`Close ${title}`} onClick={onClose} className="rounded border px-3 py-1">Close</button>
        </div>
        <div className="overflow-y-auto p-4 space-y-4">{children}</div>
      </div>
    </dialog>, document.body
  );
}
