'use client';

import React, { useState } from 'react';
import { updateShipmentAction } from '@/lib/actions/admin-shipments';
import { usePermissions } from '@/lib/hooks/use-permissions';

export interface ShipmentFormValues {
  carrier: string | null;
  trackingNumber: string | null;
  status: string;
}

export function ShipmentForm({
  orderId,
  shipment,
}: {
  orderId: string;
  shipment?: ShipmentFormValues | null;
}) {
  const { can } = usePermissions();
  const canWrite = can('orders.write');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);
    const formData = new FormData(e.currentTarget);
    const res = await updateShipmentAction(orderId, null, formData);
    setResult(res);
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 pt-3 border-t border-border">
      <h5 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shipping / Tracking</h5>
      {result && (
        <div className={`text-xs rounded-md px-2 py-1 ${result.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {result.success ? 'Shipment updated.' : result.error}
        </div>
      )}
      <fieldset disabled={!canWrite} className="space-y-3 border-0 p-0 m-0 min-w-0">
        <select
          name="status"
          defaultValue={shipment?.status ?? 'pending'}
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs"
        >
          <option value="pending">Pending</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
        </select>
        <input
          type="text"
          name="carrier"
          defaultValue={shipment?.carrier ?? ''}
          placeholder="Carrier (e.g., G4S, Fargo)"
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs"
        />
        <input
          type="text"
          name="trackingNumber"
          defaultValue={shipment?.trackingNumber ?? ''}
          placeholder="Tracking number"
          className="w-full bg-background border border-border rounded-md px-3 py-2 text-xs"
        />
      </fieldset>
      <button type="submit" disabled={isSubmitting || !canWrite} className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
        {isSubmitting ? 'Saving...' : 'Update Shipment'}
      </button>
    </form>
  );
}