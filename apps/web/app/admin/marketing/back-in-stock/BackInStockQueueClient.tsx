'use client';

import React, { useState } from 'react';
import { DataTable, type ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge } from '@/components/admin/ui/StatusBadge';
import { MessageSquare, Mail, Check } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  markSubscriberNotifiedAction,
  type BackInStockSubscriber,
} from '@/lib/actions/admin-back-in-stock';
import { formatDate } from '@/lib/format';
import { buildWhatsAppLink } from '@repo/utils';
import { usePermissions } from '@/lib/hooks/use-permissions';

export function BackInStockQueueClient({
  subscribers,
  storeName,
}: {
  subscribers: BackInStockSubscriber[];
  storeName: string;
}) {
  const router = useRouter();
  const { can } = usePermissions();
  const canWrite = can('inventory.write');
  const [searchTerm, setSearchTerm] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = subscribers.filter(
    (s) =>
      s.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.email ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.phone ?? '').includes(searchTerm)
  );

  const messageFor = (s: BackInStockSubscriber) =>
    `Good news from ${storeName}! "${s.productName}" is back in stock. Order here: ${window.location.origin}/products/${s.productSlug}`;

  const handleNotified = async (id: string) => {
    setBusyId(id);
    await markSubscriberNotifiedAction(id);
    setBusyId(null);
    router.refresh();
  };

  const columns: ColumnDef<BackInStockSubscriber>[] = [
    {
      key: 'productName',
      header: 'Product',
      sortable: true,
      cell: (item) => (
        <div>
          <p className="font-medium">{item.productName}</p>
          <p className="text-xs text-muted-foreground">
            Requested {formatDate(item.createdAt)}
          </p>
        </div>
      ),
    },
    {
      key: 'email',
      header: 'Contact',
      cell: (item) => (
        <span className="text-sm">{item.email ?? item.phone ?? '—'}</span>
      ),
    },
    {
      key: 'inStock',
      header: 'Stock',
      cell: (item) => (
        <StatusBadge
          status={item.inStock ? 'success' : 'draft'}
          label={item.inStock ? 'Back in stock' : 'Still out'}
        />
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      onSearch={setSearchTerm}
      emptyMessage="No one is waiting on a restock right now."
      rowActions={(item) => (
        <div className="flex items-center justify-end gap-2">
          {item.phone && (
            <button
              type="button"
              onClick={() =>
                window.open(buildWhatsAppLink(item.phone!, messageFor(item)), '_blank')
              }
              className="p-1.5 text-muted-foreground hover:text-green-600 rounded-md hover:bg-muted"
              title="Message on WhatsApp"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
          )}
          {item.email && (
            <a
              href={`mailto:${item.email}?subject=${encodeURIComponent(
                `${item.productName} is back in stock`
              )}&body=${encodeURIComponent(messageFor(item))}`}
              className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted inline-flex"
              title="Email customer"
            >
              <Mail className="h-4 w-4" />
            </a>
          )}
          {canWrite ? (
            <button
              type="button"
              onClick={() => handleNotified(item.id)}
              disabled={busyId === item.id}
              className="p-1.5 text-muted-foreground hover:text-primary rounded-md hover:bg-muted disabled:opacity-50"
              title="Mark as notified"
            >
              <Check className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      )}
    />
  );
}
