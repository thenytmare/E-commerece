import type { MailMessage } from '@/lib/mail';
import { formatPrice } from '@/lib/format';

/**
 * Plain-text email bodies. Kept apart from the handlers so they are easy to
 * read, change and test. UK English, short lines.
 */

function storeName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME ?? 'Prime Accessories Kenya';
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

export function passwordResetEmail(to: string, resetUrl: string): MailMessage {
  return {
    to,
    subject: `Reset your ${storeName()} password`,
    text: [
      'We received a request to reset your password.',
      '',
      `Open this link to choose a new one: ${resetUrl}`,
      '',
      'The link expires in one hour. If you did not ask for this, you can ignore this email. Your password will not change.',
    ].join('\n'),
  };
}

export interface ConfirmationOrder {
  orderNumber: string;
  isGuest: boolean;
  total: { toNumber(): number } | number | string;
  items: { name: string; quantity: number; price: { toNumber(): number } | number | string }[];
  deliveryZone: string;
}

export function orderConfirmationEmail(to: string, order: ConfirmationOrder): MailMessage {
  const lines = order.items.map((item) => `- ${item.name} x ${item.quantity}: ${formatPrice(Number(item.price) * item.quantity)}`);
  const link = `${baseUrl()}/orders/${encodeURIComponent(order.orderNumber)}`;
  return {
    to,
    subject: `We have your order ${order.orderNumber}`,
    text: [
      `Thank you for shopping with ${storeName()}.`,
      '',
      `Order number: ${order.orderNumber}`,
      ...lines,
      `Total: ${formatPrice(order.total)}`,
      `Delivery: ${order.deliveryZone === 'PICKUP' ? 'Pick up from the shop' : 'Delivery'}`,
      '',
      'If you have not paid yet, you can finish payment from your order page:',
      link,
      order.isGuest ? 'Open it in the same browser you ordered with.' : 'Sign in to see it.',
      '',
      'We will let you know when your order is on its way.',
    ].join('\n'),
  };
}

export function backInStockEmail(to: string, product: { name: string; slug: string }): MailMessage {
  return {
    to,
    subject: `${product.name} is back in stock`,
    text: [
      `Good news. ${product.name} is back in stock at ${storeName()}.`,
      '',
      `See it here: ${baseUrl()}/products/${encodeURIComponent(product.slug)}`,
      '',
      'Stock can sell out quickly. You asked us to tell you once, so this is the only email about it.',
    ].join('\n'),
  };
}
