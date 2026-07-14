'use client';

import React from 'react';
import { 
  ChevronDown, 
  ChevronUp, 
  Search, 
  Filter, 
  MoreHorizontal,
  Download,
  Printer
} from 'lucide-react';

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
  
  // Actions
  rowActions?: (item: T) => React.ReactNode;
  bulkActions?: React.ReactNode;
  
  // Search & Filter
  onSearch?: (term: string) => void;
  onFilter?: () => void;
}

export function DataTable<T extends { id: string | number }>({
  data,
  columns,
  isLoading,
  emptyMessage = "No results found",
  sortKey,
  sortDirection,
  onSort,
  page,
  totalPages,
  onPageChange,
  selectable,
  selectedIds = [],
  onSelect,
  rowActions,
  bulkActions,
  onSearch,
  onFilter
}: DataTableProps<T>) {
  
  const visibleColumns = columns.filter(c => !c.hidden);
  
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!onSelect) return;
    if (e.target.checked) {
      onSelect(data.map(item => String(item.id)));
    } else {
      onSelect([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (!onSelect) return;
    if (checked) {
      onSelect([...selectedIds, id]);
    } else {
      onSelect(selectedIds.filter(selectedId => selectedId !== id));
    }
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
                type="text" 
                placeholder="Search..." 
                className="w-full bg-background border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-primary transition-colors"
                onChange={(e) => onSearch(e.target.value)}
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
          {bulkActions && selectedIds.length > 0 && (
            <div className="flex items-center gap-2 mr-2">
              <span className="text-sm text-muted-foreground mr-2">{selectedIds.length} selected</span>
              {bulkActions}
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <button className="p-2 text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted" title="Export CSV">
              <Download className="h-4 w-4" />
            </button>
            <button className="p-2 text-muted-foreground hover:text-foreground border border-border rounded-md hover:bg-muted" title="Print">
              <Printer className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-muted/50 text-muted-foreground text-xs uppercase bg-gray-50 border-b border-border">
            <tr>
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-border text-primary focus:ring-primary"
                    checked={data.length > 0 && selectedIds.length === data.length}
                    onChange={handleSelectAll}
                  />
                </th>
              )}
              {visibleColumns.map((col) => (
                <th 
                  key={String(col.key)} 
                  className={`px-4 py-3 font-medium tracking-wider ${col.sortable ? 'cursor-pointer hover:bg-muted/80' : ''}`}
                  onClick={() => col.sortable && onSort && onSort(String(col.key))}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && sortKey === col.key && (
                      sortDirection === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                    )}
                  </div>
                </th>
              ))}
              {rowActions && <th className="px-4 py-3 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {isLoading ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="px-4 py-12 text-center">
                  <div className="flex justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0) + (rowActions ? 1 : 0)} className="px-4 py-12 text-center text-muted-foreground">
                  {emptyMessage}
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
                        checked={selectedIds.includes(String(item.id))}
                        onChange={(e) => handleSelectRow(String(item.id), e.target.checked)}
                      />
                    </td>
                  )}
                  {visibleColumns.map((col) => (
                    <td key={String(col.key)} className="px-4 py-3 whitespace-nowrap">
                      {col.cell ? col.cell(item) : (item as any)[col.key]}
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
