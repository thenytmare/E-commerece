'use client';

import {
  cancelAdminOrderAction,
  refundAdminOrderAction,
  type AdminOrderActionState,
  updateAdminOrderStatusAction,
} from '@/lib/actions/admin-orders';
import { allowedNextStatuses, type OrderStatusName } from '@repo/config/orders';
import { Button } from '@repo/ui';
import { useActionState, useState } from 'react';
import { ConfirmationDialog } from '@/components/admin/ui/ConfirmationDialog';
import { usePermissions } from '@/lib/hooks/use-permissions';

const initialState: AdminOrderActionState = {};

interface OrderStatusFormProps {
  /**
   * Only the fields this control needs — deliberately not the whole
   * OrderDetail, whose Decimal columns can't cross into a Client Component.
   */
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatusName;
    /** Whether any payment on this order has completed. */
    isPaid?: boolean;
  };
}

/** Statuses driven by their own dedicated buttons rather than "advance to". */
const SPECIAL_STATUSES: OrderStatusName[] = ['CANCELLED', 'REFUNDED'];

export function OrderStatusForm({ order }: OrderStatusFormProps) {
  const { can } = usePermissions();
  const canWrite = can('orders.write');
  const canRefundOrder = can('orders.delete');
  const [updateState, updateAction, updatePending] = useActionState(
    updateAdminOrderStatusAction,
    initialState
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelAdminOrderAction,
    initialState
  );
  const [refundState, refundAction, refundPending] = useActionState(
    refundAdminOrderAction,
    initialState
  );

  const [confirming, setConfirming] = useState<'cancel' | 'refund' | null>(null);

  // Driven by the same table the server enforces, so a button is never offered
  // for a transition that will be rejected.
  const nextStatuses = allowedNextStatuses(order.status);
  const advanceStatuses = nextStatuses.filter((status) => !SPECIAL_STATUSES.includes(status));
  const canCancel = nextStatuses.includes('CANCELLED') && canWrite;
  const canRefund = nextStatuses.includes('REFUNDED') && canRefundOrder;

  const error = updateState.error ?? cancelState.error ?? refundState.error;
  const success = updateState.success ?? cancelState.success ?? refundState.success;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {!canWrite ? (
        <p className="text-sm text-muted-foreground">You have read-only access to orders.</p>
      ) : null}
      {canWrite && advanceStatuses.map((status) => (
        <form action={updateAction} key={status}>
          <input type="hidden" name="orderId" value={order.id} />
          <input type="hidden" name="orderNumber" value={order.orderNumber} />
          <input type="hidden" name="status" value={status} />
          <Button type="submit" size="sm" variant="outline" isLoading={updatePending}>
            Mark {status.toLowerCase()}
          </Button>
        </form>
      ))}

      {canCancel ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          isLoading={cancelPending}
          onClick={() => setConfirming('cancel')}
        >
          Cancel
        </Button>
      ) : null}

      {canRefund ? (
        <Button
          type="button"
          size="sm"
          variant="destructive"
          isLoading={refundPending}
          onClick={() => setConfirming('refund')}
        >
          Refund
        </Button>
      ) : null}

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-green-600" role="status">
          {success}
        </p>
      ) : null}

      <ConfirmationDialog
        isOpen={confirming === 'cancel'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const data = new FormData();
          data.set('orderId', order.id);
          data.set('orderNumber', order.orderNumber);
          cancelAction(data);
          setConfirming(null);
        }}
        title={`Cancel order ${order.orderNumber}?`}
        description={
          order.isPaid
            ? 'This order has been paid. Cancelling releases the reserved stock and marks the payment refunded — you still need to return the money in the payment provider’s dashboard.'
            : 'This releases the reserved stock back into inventory. This can’t be undone.'
        }
        confirmText="Cancel order"
        // Otherwise both buttons read "Cancel", which is genuinely ambiguous
        // on a dialog whose whole subject is cancelling.
        cancelText="Keep order"
        variant="danger"
      />

      <ConfirmationDialog
        isOpen={confirming === 'refund'}
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          const data = new FormData();
          data.set('orderId', order.id);
          data.set('orderNumber', order.orderNumber);
          refundAction(data);
          setConfirming(null);
        }}
        title={`Refund order ${order.orderNumber}?`}
        description="Marks the order and its payment as refunded. Returning the money still happens in the payment provider’s dashboard, and returned stock must be added back from the inventory screen."
        confirmText="Mark refunded"
        variant="danger"
      />
    </div>
  );
}
