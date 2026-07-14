'use client';

import React from 'react';
import { Bold, Italic, List, Link as LinkIcon, Type } from 'lucide-react';

interface RichTextFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextField({ value, onChange, placeholder }: RichTextFieldProps) {
  // UI Placeholder for a Rich Text Editor (e.g. TipTap or Quill later)
  return (
    <div className="border border-border rounded-md overflow-hidden flex flex-col focus-within:ring-2 focus-within:ring-primary focus-within:border-transparent">
      <div className="bg-muted px-3 py-2 border-b border-border flex items-center gap-1">
        <button type="button" className="p-1.5 rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors"><Bold className="h-4 w-4" /></button>
        <button type="button" className="p-1.5 rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors"><Italic className="h-4 w-4" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" className="p-1.5 rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors"><List className="h-4 w-4" /></button>
        <div className="w-px h-4 bg-border mx-1" />
        <button type="button" className="p-1.5 rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors"><LinkIcon className="h-4 w-4" /></button>
        <button type="button" className="p-1.5 rounded text-muted-foreground hover:bg-background hover:text-foreground transition-colors"><Type className="h-4 w-4" /></button>
      </div>
      <textarea 
        className="w-full min-h-[150px] p-3 focus:outline-none resize-y bg-background text-sm"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
