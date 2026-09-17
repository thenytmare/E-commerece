'use client';

import React from 'react';
import {
  ChevronDown,
  ChevronUp,
  Search,
  Filter,
  Download,
  Columns3,
  Inbox,
  type LucideIcon
} from 'lucide-react';
import { EmptyState } from './EmptyState';
import { LoadingSkeleton } from './LoadingSkeleton';

export interface ColumnDef<T> {
  key: keyof T | string;
  header: string;
  cell?: (item: T) => React.ReactNode;
  sortable?: boolean;
  hidden?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  isLoading?: boolean;
  emptyMessage?: string;
  /** Optional richer empty state shown instead of the plain message. */
  emptyTitle?: string;
  emptyIcon?: LucideIcon;
  emptyAction?: React.ReactNode;

  // Sorting
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  
  // Pagination
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  
  // Selection
  selectable?: boolean;
  selectedIds?: string[];
  onSelect?: (ids: string[]) => void;
  /** Human-readable label for a row's checkbox, e.g. `(item) => item.name`. Falls back to the row id. */
  getRowLabel?: (item: T) => string;
  
  // Actions
  rowActions?: (item: T) => React.ReactNode;
  bulkActions?: React.ReactNode;
  
  // Search & Filter
  onSearch?: (term: string) => void;
  /** Current search term, so the box still shows it after a reload or a
   *  parent-driven "clear filters". */
  searchValue?: string;
  searchPlaceholder?: string;
  /** Milliseconds to wait before firing onSearch. 0 fires immediately. */
  searchDebounceMs?: number;
  onFilter?: () => void;
  onExport?: (rows: T[]) => void;
  exportFilename?: string;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  isLoading,
  emptyMessage = "No results found",
  emptyTitle,
  emptyIcon,
  emptyAction,
  sortKey,
  sortDirection,
  onSort,
  page,
  totalPages,
  onPageChange,
  selectable,
  selectedIds = [],
  onSelect,
  getRowLabel,
  rowActions,
  bulkActions,
  onSearch,
  searchValue,
  searchPlaceholder = 'Search...',
  searchDebounceMs = 300,
  onFilter,
  onExport,
  exportFilename = 'export.csv'
}: DataTableProps<T>) {
  const [internalSelectedIds, setInternalSelectedIds] = React.useState<string[]>([]);

  // The search box is controlled so a parent "clear filters" actually empties
  // it — it used to be uncontrolled, leaving stale text visible over reset
  // results. Debouncing lives here so every caller doesn't reinvent it.
  const [searchTerm, setSearchTerm] = React.useState(searchValue ?? '');
  const lastEmitted = React.useRef(searchValue ?? '');

  React.useEffect(() => {
    if (searchValue !== undefined && searchValue !== lastEmitted.current) {
      setSearchTerm(searchValue);
      lastEmitted.current = searchValue;
    }
  }, [searchValue]);

  React.useEffect(() => {
    if (!onSearch || searchTerm === lastEmitted.current) return;
    const timer = setTimeout(() => {
      lastEmitted.current = searchTerm;
      onSearch(searchTerm);
    }, searchDebounceMs);
    return () => clearTimeout(timer);
  }, [searchTerm, searchDebounceMs, onSearch]);

  const [isColumnMenuOpen, setIsColumnMenuOpen] = React.useState(false);
  const [hiddenColumns, setHiddenColumns] = React.useState<Set<string>>(
    () => new Set(columns.filter((column) => column.hidden).map((column) => String(column.key)))
  );
  const activeSelectedIds = selectedIds.length > 0 || onSelect ? selectedIds : internalSelectedIds;
  const visibleColumns = columns.filter((column) => !hiddenColumns.has(String(column.key)));

  const allSelected = data.length > 0 && data.every((item) => activeSelectedIds.includes(String(item.id)));
  const someSelected = activeSelectedIds.length > 0 && !allSelected;

  const setSelectedIds = (ids: string[]) => {
    if (onSelect) onSelect(ids);
    else setInternalSelectedIds(ids);
  };
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(data.map(item => String(item.id)));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds([...activeSelectedIds, id]);
    } else {
      setSelectedIds(activeSelectedIds.filter(selectedId => selectedId !== id));
    }
  };

  const toggleColumn = (key: string) => {
    setHiddenColumns((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const exportRows = () => {
    if (onExport) {
      onExport(data);
      return;
    }
    // Spreadsheet apps execute a cell beginning =, +, - or @ as a formula.
    // Exported columns include admin-editable free text, so prefix those with
    // an apostrophe to keep them inert.
    const escapeValue = (value: unknown) => {
      const raw = String(value ?? '');
      const safe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
      return `"${safe.replaceAll('"', '""')}"`;
    };
    const csv = [
      visibleColumns.map((column) => escapeValue(column.header)).join(','),
      ...data.map((item) => visibleColumns.map((column) =>
        escapeValue(item[column.key as keyof T])
      ).join(',')),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFilename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full bg-card border border-border rounded-lg shadow-sm overflow-hidden flex flex-col">
      {/* Table Toolbar */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-1 w-full sm:w-auto">
          {onSearch && (
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <input
                type="search"
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}
          {onFilter && (
            <button 
              onClick={onFilter}
              className="px-3 py-2 border border-border bg-background rounded-md text-sm font-medium hover:bg-muted transition-colors flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              <span className="hidden sm:inline">Filter</span>
            </button>
          )}
        </div>
        
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {bulkActions && activeSelectedIds.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground mr-2">{activeSelectedIds.length} selected</span>
              {bulkActions}
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <button type="button" onClick={() => setIsColumnMenuOpen((open) => !open)} aria-expanded={isColumnMenuOpen} aria-label="Choose visible columns" className="p-2 text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted">
                <Columns3 className="h-4 w-4" />
              </button>
              {isColumnMenuOpen && (
                <div className="absolute right-0 top-full z-20 mt-2 w-48 rounded-md border border-border bg-card p-2 shadow-elevated">
                  {columns.map((column) => {
                    const key = String(column.key);
                    return (
                      <label key={key} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted">
                        <input type="checkbox" checked={!hiddenColumns.has(key)} onChange={() => toggleColumn(key)} />
                        {column.header}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
            <button type="button" onClick={exportRows} className="p-2 text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted" title="Export CSV" aria-label="Export CSV">
              <Download className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase border-b border-border">
            <tr>
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    className="rounded border-border text-primary focus:ring-primary"
                    aria-label="Select all rows"
                    ref={(node) => {
                      // Otherwise a partial selection reads as fully unchecked.
                      if (node) node.indeterminate = someSelected && !allSelected;
                    }}
                    checked={allSelected}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th
                  key={String(col.key)}
                  aria-sort={
                    col.sortable
                      ? sortKey === col.key
                        ? sortDirection === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                  className={`px-4 py-3 font-medium tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-muted/80' : ''}`}
                >
                  {col.sortable ? (
                    <button type="button" onClick={() => onSort?.(String(col.key))} className="flex items-center gap-1" aria-label={`Sort by ${col.header}`}>
                      {col.header}
                      {sortKey === col.key && (sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)}
                    </button>
                  ) : col.header}
                </th>
              ))}
              {rowActions && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              // Skeleton rows mirror the real column layout so the table
              // doesn't collapse and jump when data arrives.
              Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={`skeleton-${rowIndex}`}>
                  {selectable && (
                    <td className="px-4 py-3">
                      <LoadingSkeleton className="h-4 w-4" />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3">
                      <LoadingSkeleton className="h-4 w-full" />
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3">
                      <LoadingSkeleton className="h-4 w-12 ml-auto" />
                    </td>
                  )}
                </tr>
              ))
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="p-4">
                  <EmptyState
                    icon={emptyIcon ?? Inbox}
                    title={emptyTitle ?? 'Nothing here yet'}
                    description={emptyMessage}
                    action={emptyAction}
                  />
                </td>
              </tr>
            ) : (
              data.map((item) => (
                <tr key={String(item.id)} className="hover:bg-muted/30 transition-colors">
                  {selectable && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        className="rounded border-border text-primary focus:ring-primary"
                        checked={activeSelectedIds.includes(String(item.id))}
                        onChange={(e) => handleSelectRow(String(item.id), e.target.checked)}
                        aria-label={`Select ${getRowLabel ? getRowLabel(item) : `row ${item.id}`}`}
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 whitespace-nowrap">
                      {col.cell ? col.cell(item) : String(item[col.key as keyof T])}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      {rowActions(item)}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {(page !== undefined && totalPages !== undefined && totalPages > 1) && (
        <div className="p-4 border-t border-border flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Page <span className="font-medium text-foreground">{page}</span> of <span className="font-medium text-foreground">{totalPages}</span>
          </span>
          <div className="flex items-center gap-1">
            <button 
              className="px-3 py-1 border border-border rounded-md text-sm disabled:opacity-50 hover:bg-muted transition-colors"
              disabled={page <= 1}
              onClick={() => onPageChange && onPageChange(page - 1)}
            >
              Previous
            </button>
            <button 
              className="px-3 py-1 border border-border rounded-md text-sm disabled:opacity-50 hover:bg-muted transition-colors"
              disabled={page >= totalPages}
              onClick={() => onPageChange && onPageChange(page + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
