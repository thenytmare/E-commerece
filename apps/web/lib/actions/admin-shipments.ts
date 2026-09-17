'use server';

import { createRepositories } from '@repo/database';
import { requirePermission } from './auth';
import { revalidatePath } from 'next/cache';
import { getClientIp } from '@/lib/request-context';

const repos = createRepositories();

/** The only shipment states the form may set. */
const SHIPMENT_STATUSES = ['pending', 'processing', 'shipped', 'delivered'] as const;
type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

function isShipmentStatus(value: string): value is ShipmentStatus {
  return (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

export async function updateShipmentAction(
  orderId: string,
  _prevState: { success?: boolean; error?: string } | null,
  formData: FormData
) {
  const session = await requirePermission('orders.write');
  try {
    const trackingNumber = String(formData.get('trackingNumber') ?? '').trim() || undefined;
    const carrier = String(formData.get('carrier') ?? '').trim() || undefined;
    const status = String(formData.get('status') ?? 'pending');

    if (!isShipmentStatus(status)) {
      return { success: false, error: 'Choose a valid shipment status.' };
    }

    // A dispatched parcel with no tracking details can't be traced by support
    // or the customer, so require them before the order can move to shipped.
    if ((status === 'shipped' || status === 'delivered') && (!trackingNumber || !carrier)) {
      return {
        success: false,
        error: 'Add a carrier and tracking number before marking this shipped.',
      };
    }

    // Order status drives shipment status, not the other way round: without
    // this check, setting "shipped" on a cancelled or refunded order would
    // quietly reopen it.
    if (status === 'shipped' || status === 'delivered') {
      await repos.order.updateStatus(
        orderId,
        status === 'delivered' ? 'DELIVERED' : 'SHIPPED',
        `Tracking: ${trackingNumber} via ${carrier}`,
        session.user.id
      );
    }

    await repos.shipment.createOrUpdate({
      orderId,
      carrier,
      trackingNumber,
      status,
    });

    await repos.auditLog.create({
      actorId: session.user.id,
      ipAddress: (await getClientIp()) ?? undefined,
      action: 'shipment.update',
      entity: 'Order',
      entityId: orderId,
      metadata: { status, carrier, trackingNumber },
    });

    revalidatePath('/admin/orders');
    return { success: true };
  } catch (error) {
    console.error('Failed to update shipment:', error);
    const message =
      error instanceof Error && error.message ? error.message : 'Failed to update shipment.';
    return { success: false, error: message };
  }
}
