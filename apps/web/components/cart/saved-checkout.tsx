'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@repo/ui';
import { restoreCheckoutAction } from '@/lib/actions/checkout-recovery';
import { formatPrice } from '@/lib/format';

export function SavedCheckout({ order }: { order: { orderNumber: string; status: string; total: number; items: { id: string; name: string; quantity: number }[] } }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  return <article className="mb-6 rounded-xl border border-primary/30 bg-card p-6 space-y-4">
    <div><h2 className="font-semibold">Your items are saved</h2><p className="text-sm text-muted-foreground">Order {order.orderNumber} · {formatPrice(order.total)} · {order.status === 'PENDING' ? 'Awaiting payment' : 'Unpaid order cancelled'}</p></div>
    <ul className="space-y-1 text-sm">{order.items.map(item => <li key={item.id}>{item.name} × {item.quantity}</li>)}</ul>
    <p className="text-sm text-muted-foreground">A failed or cancelled payment does not delete these items. Resume payment for this order, or return its items to your cart to make changes.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-3">
      {order.status === 'PENDING' && <Button asChild><Link href={`/orders/${order.orderNumber}/pay`}>Resume payment</Link></Button>}
      <Button variant="outline" isLoading={pending} onClick={() => { setError(''); start(async () => {
        const result = await restoreCheckoutAction(order.orderNumber);
        if (result.error) setError(result.error); else router.refresh();
      }); }}>Return items to cart</Button>
    </div>
  </article>;
}
