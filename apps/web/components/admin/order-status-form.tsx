'use client';

import {
  cancelAdminOrderAction,
  type AdminOrderActionState,
  updateAdminOrderStatusAction,
} from '@/lib/actions/admin-orders';
import type { OrderDetail, OrderStatus } from '@repo/database';
import { Button } from '@repo/ui';
import { useActionState } from 'react';

const initialState: AdminOrderActionState = {};

interface OrderStatusFormProps {
  order: OrderDetail;
}

const statusFlow: Record<OrderStatus, OrderStatus | null> = {
  PENDING: 'PROCESSING',
  CONFIRMED: 'PROCESSING',
  PROCESSING: 'SHIPPED',
  SHIPPED: 'DELIVERED',
  DELIVERED: null,
  CANCELLED: null,
  REFUNDED: null,
};

export function OrderStatusForm({ order }: OrderStatusFormProps) {
  const [updateState, updateAction, updatePending] = useActionState(
    updateAdminOrderStatusAction,
    initialState
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelAdminOrderAction,
    initialState
  );

  const nextStatus = statusFlow[order.status];
  const canCancel = order.status === 'PENDING' || order.status === 'CONFIRMED';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {nextStatus ? (
        <form action={updateAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="orderNumber" value={order.orderNumber} />
          <input type="hidden" name="status" value={nextStatus} />
          <Button type="submit" size="sm" variant="outline" isLoading={updatePending}>
            Mark {nextStatus.toLowerCase()}
          </Button>
        </form>
      ) : null}

      {canCancel ? (
        <form action={cancelAction}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="orderNumber" value={order.orderNumber} />
          <Button type="submit" size="sm" variant="destructive" isLoading={cancelPending}>
            Cancel
          </Button>
        </form>
      ) : null}

      {updateState.error || cancelState.error ? (
        <p className="text-sm text-destructive">{updateState.error ?? cancelState.error}</p>
      ) : null}
      {updateState.success || cancelState.success ? (
        <p className="text-sm text-green-600">{updateState.success ?? cancelState.success}</p>
      ) : null}
    </div>
  );
}
