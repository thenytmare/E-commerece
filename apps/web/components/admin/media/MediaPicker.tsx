'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Search, X, Folder, FolderPlus } from 'lucide-react';

interface MediaFile {
  id: string;
  url: string;
  filename: string;
  mimeType: string;
}

interface MediaFolder {
  id: string;
  name: string;
  _count: { files: number };
  children: MediaFolder[];
}

interface MediaPickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string) => void;
  multiple?: boolean;
}

export function MediaPicker({ isOpen, onClose, onSelect, multiple }: MediaPickerProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    // Search server-side (debounced) so results aren't limited to the
    // already-loaded page of files.
    const timer = setTimeout(() => {
      const params = new URLSearchParams();
      if (currentFolderId) params.set('folderId', currentFolderId);
      if (search.trim()) params.set('search', search.trim());
      const qs = params.toString();

      fetch(`/api/admin/media/list${qs ? `?${qs}` : ''}`)
        .then(res => res.json())
        .then(data => setFiles(data.files || []))
        .finally(() => setLoading(false));
    }, search.trim() ? 250 : 0);

    return () => clearTimeout(timer);
  }, [isOpen, currentFolderId, search]);

  useEffect(() => {
    if (!isOpen) return;
    fetch(`/api/admin/media/folders${currentFolderId ? `?parentId=${currentFolderId}` : ''}`)
      .then(res => res.json())
      .then(data => setFolders(data.folders || []));
  }, [isOpen, currentFolderId]);

  const filtered = files;

  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    await fetch('/api/admin/media/folders', {
      method: 'POST',
      body: JSON.stringify({ name: newFolderName.trim(), parentId: currentFolderId }),
      headers: { 'Content-Type': 'application/json' },
    });
    setNewFolderName('');
    // Refresh
    fetch(`/api/admin/media/folders${currentFolderId ? `?parentId=${currentFolderId}` : ''}`)
      .then(res => res.json())
      .then(data => setFolders(data.folders || []));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl max-h-[80vh] flex flex-col m-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold">Media Library</h3>
            {/* Folder breadcrumb */}
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <button onClick={() => setCurrentFolderId(null)} className="hover:text-primary hover:underline">All Files</button>
              {currentFolderId && (
                <span className="text-muted-foreground">/ ...</span>
              )}
            </div>
          </div>
          <button onClick={onClose}><X className="h-5 w-5" /></button>
        </div>

        {/* Folders + Search */}
        <div className="p-3 border-b border-border space-y-3">
          {/* Folders row */}
          <div className="flex items-center gap-2 flex-wrap">
            {folders.map(folder => (
              <button
                key={folder.id}
                onClick={() => setCurrentFolderId(folder.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted rounded-md text-sm hover:bg-muted/80 transition-colors"
              >
                <Folder className="h-4 w-4 text-amber-500" />
                {folder.name}
                <span className="text-xs text-muted-foreground">({folder._count.files})</span>
              </button>
            ))}
            {/* New folder input */}
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                placeholder="New folder..."
                className="w-28 bg-background border border-border rounded-md px-2 py-1.5 text-xs"
                onKeyDown={e => e.key === 'Enter' && createFolder()}
              />
              <button
                type="button"
                onClick={createFolder}
                className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted"
                title="Create folder"
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text" placeholder="Search files..." value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>

        {/* Files grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No files found</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filtered.map(file => (
                <div
                  key={file.id}
                  className={`relative aspect-square rounded-lg border-2 cursor-pointer overflow-hidden transition-all hover:border-primary ${selected.includes(file.url) ? 'border-primary bg-primary/10' : 'border-border'}`}
                  onClick={() => {
                    if (multiple) {
                      setSelected(prev => prev.includes(file.url) ? prev.filter(u => u !== file.url) : [...prev, file.url]);
                    } else {
                      onSelect(file.url);
                      onClose();
                    }
                  }}
                >
                  {file.mimeType.startsWith('image/') ? (
                    <Image src={file.url} alt={file.filename} fill className="object-cover" sizes="150px" />
                  ) : (
                    <div className="flex items-center justify-center h-full text-xs text-muted-foreground p-2 text-center">{file.filename}</div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 truncate">{file.filename}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {multiple && selected.length > 0 && (
          <div className="p-4 border-t border-border flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{selected.length} selected</span>
            <button onClick={() => { selected.forEach(url => onSelect(url)); onClose(); }} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">Insert Selected</button>
          </div>
        )}
      </div>
    </div>
  );
}