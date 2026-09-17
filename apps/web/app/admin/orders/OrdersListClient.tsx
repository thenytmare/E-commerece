'use client';

import React, { useCallback, useState } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { DataTable, ColumnDef } from '@/components/admin/ui/DataTable';
import { StatusBadge, StatusType } from '@/components/admin/ui/StatusBadge';
import { OrderDetail } from '@repo/database';
import type { Serialized } from '@/lib/serialize';

/** Money columns arrive as plain numbers — see lib/serialize.ts. */
type AdminOrder = Serialized<OrderDetail>;
import { formatDate, formatDateTime, formatPrice } from '@/lib/format';
import { Eye, XCircle } from 'lucide-react';
import { OrderStatusForm } from '@/components/admin/order-status-form';
import { ShipmentForm } from '@/components/admin/ShipmentForm';

const orderStatusBadgeMap: Record<string, StatusType> = {
  PENDING: 'pending',
  CONFIRMED: 'info',
  PROCESSING: 'info',
  SHIPPED: 'info',
  DELIVERED: 'success',
  CANCELLED: 'draft',
  REFUNDED: 'archived',
};

const ORDER_STATUS_OPTIONS = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
];

export function OrdersListClient({
  initialOrders,
  page,
  totalPages,
  total,
  initialSearch,
  activeStatus,
}: {
  initialOrders: AdminOrder[];
  page: number;
  totalPages: number;
  total: number;
  initialSearch: string;
  activeStatus: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);

  // Search, status filter and paging all run in SQL via URL params, so they
  // cover every order rather than only the rows already loaded.
  const pushParams = useCallback(
    (updates: Record<string, string | null>, resetPage = true) => {
      const params = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      if (resetPage) params.set('page', '1');
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams]
  );

  const columns: ColumnDef<AdminOrder>[] = [
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
          {formatDate(item.createdAt)}
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
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm text-muted-foreground" htmlFor="order-status-filter">
          Status
        </label>
        <select
          id="order-status-filter"
          value={activeStatus}
          onChange={(e) => pushParams({ status: e.target.value || null })}
          className="rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {ORDER_STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted-foreground">
          {total} order{total === 1 ? '' : 's'}
        </span>
      </div>

      <DataTable
        data={initialOrders}
        columns={columns}
        onSearch={(term) => pushParams({ search: term || null })}
        searchValue={initialSearch}
        searchPlaceholder="Search order number, customer, phone..."
        page={page}
        totalPages={totalPages}
        onPageChange={(next) => pushParams({ page: String(next) }, false)}
        selectable
        getRowLabel={(order) => order.orderNumber}
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
                    Placed on {formatDateTime(selectedOrder.createdAt)}
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
                  <OrderStatusForm
                    order={{
                      id: selectedOrder.id,
                      orderNumber: selectedOrder.orderNumber,
                      status: selectedOrder.status,
                      isPaid: selectedOrder.payments.some((p) => p.status === 'COMPLETED'),
                    }}
                  />
                </div>
              </div>

              {/* Shipment Form */}
              <div className="border border-border rounded-xl p-4 bg-muted/10 mb-6">
                <ShipmentForm
                  key={selectedOrder.id}
                  orderId={selectedOrder.id}
                  shipment={selectedOrder.shipment}
                />
              </div>

              {/* Status History */}
              {selectedOrder.statusHistory.length > 0 && (
                <div className="mb-6 space-y-3">
                  <h4 className="text-sm font-semibold border-b border-border pb-2">Status History</h4>
                  <ol className="space-y-3">
                    {selectedOrder.statusHistory.map((entry) => (
                      <li key={entry.id} className="flex gap-3 text-sm">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                        <div>
                          <span className="font-medium">{entry.status}</span>
                          <span className="text-xs text-muted-foreground block mt-0.5">
                            {formatDateTime(entry.createdAt)}
                          </span>
                          {entry.note && (
                            <span className="text-xs text-muted-foreground block mt-0.5">{entry.note}</span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Payments */}
              {selectedOrder.payments.length > 0 && (
                <div className="mb-6 space-y-3">
                  <h4 className="text-sm font-semibold border-b border-border pb-2">Payments</h4>
                  {selectedOrder.payments.map((payment) => (
                    <div key={payment.id} className="rounded-lg border border-border p-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">{payment.provider}</span>
                        <StatusBadge
                          status={
                            payment.status === 'COMPLETED'
                              ? 'success'
                              : payment.status === 'FAILED'
                                ? 'danger'
                                : payment.status === 'REFUNDED'
                                  ? 'archived'
                                  : 'pending'
                          }
                          label={payment.status}
                        />
                      </div>
                      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                        <dt className="text-muted-foreground">Amount</dt>
                        <dd>{formatPrice(Number(payment.amount))}</dd>

                        {payment.receiptNumber && (
                          <>
                            <dt className="text-muted-foreground">M-Pesa receipt</dt>
                            <dd className="font-mono">{payment.receiptNumber}</dd>
                          </>
                        )}
                        {payment.payerPhone && (
                          <>
                            <dt className="text-muted-foreground">Paid from</dt>
                            <dd>{payment.payerPhone}</dd>
                          </>
                        )}
                        {payment.externalId && (
                          <>
                            <dt className="text-muted-foreground">Reference</dt>
                            <dd className="font-mono break-all">{payment.externalId}</dd>
                          </>
                        )}
                        {payment.failureReason && (
                          <>
                            <dt className="text-muted-foreground">Failure</dt>
                            <dd className="text-destructive">{payment.failureReason}</dd>
                          </>
                        )}
                        <dt className="text-muted-foreground">
                          {payment.paidAt ? 'Paid at' : 'Created'}
                        </dt>
                        <dd>
                          {formatDateTime(payment.paidAt ?? payment.createdAt)}
                        </dd>
                      </dl>
                    </div>
                  ))}
                </div>
              )}

              {/* Customer Details */}
              <div className="mb-6 space-y-4">
                <h4 className="text-sm font-semibold border-b border-border pb-2">Customer & Shipping</h4>
                <div>
                  <span className="text-xs text-muted-foreground block">Account</span>
                  {selectedOrder.user ? (
                    <>
                      <span className="text-sm font-medium">{selectedOrder.user.name || '—'}</span>
                      <a
                        href={`mailto:${selectedOrder.user.email}`}
                        className="block text-xs text-muted-foreground hover:text-foreground"
                      >
                        {selectedOrder.user.email}
                      </a>
                    </>
                  ) : (
                    <span className="text-sm font-medium">Guest checkout</span>
                  )}
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">
                    Ships to
                  </span>
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
                        {formatPrice(item.price * item.quantity)}
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
