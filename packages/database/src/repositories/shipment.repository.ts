import type { Shipment } from '@prisma/client';
import { BaseRepository } from './base.repository';

export class ShipmentRepository extends BaseRepository {
  async findByOrderId(orderId: string): Promise<Shipment | null> {
    return this.db.shipment.findUnique({ where: { orderId } });
  }

  async createOrUpdate(data: {
    orderId: string;
    carrier?: string;
    trackingNumber?: string;
    status?: string;
    estimatedDelivery?: Date;
  }): Promise<Shipment> {
    return this.db.shipment.upsert({
      where: { orderId: data.orderId },
      create: {
        orderId: data.orderId,
        carrier: data.carrier ?? null,
        trackingNumber: data.trackingNumber ?? null,
        status: data.status ?? 'pending',
        estimatedDelivery: data.estimatedDelivery ?? null,
      },
      update: {
        ...(data.carrier !== undefined && { carrier: data.carrier }),
        ...(data.trackingNumber !== undefined && { trackingNumber: data.trackingNumber }),
        ...(data.status !== undefined && { status: data.status }),
        ...(data.estimatedDelivery !== undefined && { estimatedDelivery: data.estimatedDelivery }),
      },
    });
  }
}