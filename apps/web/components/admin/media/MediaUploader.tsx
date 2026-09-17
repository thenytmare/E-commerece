'use client';

import React, { useState, useRef } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';

interface Props {
  folderId?: string | null;
  onUploadComplete: () => void;
}

export function MediaUploader({ folderId, onUploadComplete }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [uploads, setUploads] = useState<{ name: string; progress: number; status: 'uploading' | 'done' | 'error' }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = async (files: FileList) => {
    const newUploads = Array.from(files).map(f => ({ name: f.name, progress: 0, status: 'uploading' as const }));
    setUploads(prev => [...prev, ...newUploads]);

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      if (folderId) formData.append('folderId', folderId);

      try {
        const res = await fetch('/api/admin/media/upload', { method: 'POST', body: formData });
        if (!res.ok) throw new Error('Upload failed');
        setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'done' as const } : u));
      } catch {
        setUploads(prev => prev.map(u => u.name === file.name ? { ...u, status: 'error' as const } : u));
      }
    }
    onUploadComplete();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
    setIsOpen(false);
  };

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90">
        <Upload className="h-4 w-4" /> Upload
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setIsOpen(false)}>
          <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md space-y-4" onClick={e => e.stopPropagation()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDrop}>
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Upload Files</h3>
              <button onClick={() => setIsOpen(false)}><X className="h-5 w-5" /></button>
            </div>
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Drag & drop files here or click to browse</p>
            </div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); }} accept="image/*,.pdf,.doc,.docx,.txt,.zip,.csv,.xlsx" />

            {uploads.length > 0 && (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {uploads.map(u => (
                  <div key={u.name} className="flex items-center gap-2 text-sm">
                    {u.status === 'uploading' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> :
                     u.status === 'done' ? <span className="text-success">✓</span> :
                     <span className="text-destructive">✗</span>}
                    <span className="flex-1 truncate">{u.name}</span>
                    <span className="text-xs text-muted-foreground">{u.status === 'uploading' ? 'Uploading...' : u.status === 'done' ? 'Done' : 'Failed'}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end">
              <button onClick={() => { setIsOpen(false); onUploadComplete(); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}