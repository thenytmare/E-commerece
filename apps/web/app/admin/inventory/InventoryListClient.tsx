'use client';

import React, { useState } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { LowStockInventory } from '@repo/database';

export function InventoryListClient({ initialLowStock }: { initialLowStock: LowStockInventory[] }) {
  const [data] = useState<LowStockInventory[]>(initialLowStock);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredData = data.filter((item) =>
    item.variant.product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.variant.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const columns: ColumnDef<LowStockInventory>[] = [
    {
      key: 'product',
      header: 'Product Details',
      cell: (item) => (
        <div>
          <p className="font-semibold text-foreground">{item.variant.product.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">SKU: {item.variant.sku}</p>
        </div>
      ),
      sortable: true,
    },
    {
      key: 'quantity',
      header: 'On Hand',
      cell: (item) => <span className="font-medium">{item.quantity}</span>,
      sortable: true,
    },
    {
      key: 'reserved',
      header: 'Reserved',
      cell: (item) => <span className="text-muted-foreground">{item.reserved}</span>,
      sortable: true,
    },
    {
      key: 'available',
      header: 'Available',
      cell: (item) => {
        const available = item.quantity - item.reserved;
        return (
          <span className={`font-semibold ${available <= 0 ? 'text-destructive' : 'text-foreground'}`}>
            {available}
          </span>
        );
      },
    },
    {
      key: 'lowStockThreshold',
      header: 'Threshold',
      cell: (item) => <span className="text-muted-foreground">{item.lowStockThreshold}</span>,
      sortable: true,
    },
    {
      key: 'alert',
      header: 'Alert Level',
      cell: (item) => {
        const available = item.quantity - item.reserved;
        if (available <= 0) {
          return <StatusBadge status="danger" label="OUT OF STOCK" />;
        }
        return <StatusBadge status="warning" label="LOW STOCK" />;
      },
    },
  ];

  return (
    <DataTable
      data={filteredData}
      columns={columns}
      onSearch={setSearchTerm}
      emptyMessage="Great! All products are adequately stocked."
    />
  );
}
