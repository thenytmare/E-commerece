'use client';

import React, { useState } from 'react';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge, StatusType } from '@/components/admin/ui/StatusBadge';
import { OrderDetail } from '@repo/database';
import { formatPrice } from '@/lib/format';
import { Eye, Edit, HelpCircle, XCircle } from 'lucide-react';
import { OrderStatusForm } from '@/components/admin/order-status-form';

const orderStatusBadgeMap: Record<string, StatusType> = {
  PENDING: 'pending',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'draft',
  REFUNDED: 'archived',
};

export function OrdersListClient({ initialOrders }: { initialOrders: OrderDetail[] }) {
  const [orders] = useState<OrderDetail[]>(initialOrders);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<OrderDetail | null>(null);

  const filteredOrders = orders.filter(
    (o) =>
      o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.address?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (o.address?.phone || '').includes(searchTerm)
  );

  const columns: ColumnDef<OrderDetail>[] = [
    {
      key: 'orderNumber',
      header: 'Order Number',
      cell: (item) => <span className="font-semibold text-foreground">{item.orderNumber}</span>,
      sortable: true,
    },
    {
      key: 'createdAt',
      header: 'Date',
      cell: (item) => (
        <span className="text-muted-foreground">
          {new Date(item.createdAt).toLocaleDateString('en-KE')}
        </span>
      ),
    },
    {
      key: 'address',
      header: 'Customer',
      cell: (item) => (
        <div>
          <p className="font-medium">{item.address?.name || 'Guest User'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{item.address?.phone || 'No phone'}</p>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Total',
      cell: (item) => <span className="font-semibold">{formatPrice(Number(item.total))}</span>,
    },
    {
      key: 'status',
      header: 'Fulfillment',
      cell: (item) => (
        <StatusBadge
          status={orderStatusBadgeMap[item.status] || 'pending'}
          label={item.status}
        />
      ),
    },
    {
      key: 'payments',
      header: 'Payment Status',
      cell: (item) => {
        const completedPayment = item.payments.find((p) => p.status === 'COMPLETED');
        return completedPayment ? (
          <StatusBadge status="success" label={`PAID (${completedPayment.provider})`} />
        ) : (
          <StatusBadge status="draft" label="UNPAID" />
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        data={filteredOrders}
        columns={columns}
        onSearch={setSearchTerm}
        selectable
        rowActions={(item) => (
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => setSelectedOrder(item)}
              className="p-1.5 text-muted-foreground hover:text-primary transition-colors rounded-md hover:bg-muted flex items-center gap-1 text-xs font-medium border border-transparent hover:border-border"
            >
              <Eye className="h-4 w-4" />
              Manage Status
            </button>
          </div>
        )}
      />

      {/* Details Side Panel / Dialog */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-background/80 backdrop-blur-sm">
          <div className="h-full w-full max-w-lg border-l border-border bg-card p-6 shadow-xl flex flex-col justify-between overflow-y-auto animate-in slide-in-from-right duration-250">
            <div>
              <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold">{selectedOrder.orderNumber}</h3>
                  <p className="text-xs text-muted-foreground">
                    Placed on {new Date(selectedOrder.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Status and Action Forms */}
              <div className="border border-border rounded-xl p-4 bg-muted/10 mb-6">
                <h4 className="text-sm font-semibold mb-3">Fulfillment & Status Actions</h4>
                <div className="mb-2">
                  <span className="text-xs text-muted-foreground block mb-1">Current Status:</span>
                  <StatusBadge
                    status={orderStatusBadgeMap[selectedOrder.status] || 'pending'}
                    label={selectedOrder.status}
                  />
                </div>
                <div className="pt-2 border-t border-border mt-3">
                  <OrderStatusForm order={selectedOrder} />
                </div>
              </div>

              {/* Customer Details */}
              <div className="mb-6 space-y-4">
                <h4 className="text-sm font-semibold border-b border-border pb-2">Customer & Shipping</h4>
                <div>
                  <span className="text-xs text-muted-foreground block">Customer Name</span>
                  <span className="text-sm font-medium">{selectedOrder.address?.name || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Phone Contact</span>
                  <span className="text-sm font-medium">{selectedOrder.address?.phone || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Shipping Address</span>
                  <span className="text-sm text-foreground">
                    {selectedOrder.address
                      ? `${selectedOrder.address.street}, ${selectedOrder.address.city}, ${selectedOrder.address.county}`
                      : 'N/A'}
                  </span>
                </div>
              </div>

              {/* Order Items */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold border-b border-border pb-2">Order Items</h4>
                <ul className="divide-y divide-border">
                  {selectedOrder.items.map((item) => (
                    <li key={item.id} className="py-2.5 flex justify-between items-start gap-4">
                      <div>
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                        <span className="text-xs text-muted-foreground block mt-0.5">
                          SKU: {item.sku} • Qty: {item.quantity}
                        </span>
                      </div>
                      <span className="text-sm font-semibold">
                        {formatPrice(
                          (typeof item.price === 'object' && 'toNumber' in item.price
                            ? item.price.toNumber()
                            : Number(item.price)) * item.quantity
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t border-border pt-4 mt-8 flex justify-between items-center bg-card">
              <span className="text-sm text-muted-foreground">Order Total:</span>
              <span className="text-xl font-bold text-foreground">
                {formatPrice(Number(selectedOrder.total))}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
