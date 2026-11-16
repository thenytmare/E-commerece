import type { MailMessage } from '@/lib/mail';
import { formatPrice } from '@/lib/format';
import { renderEmailHtml, type EmailContent } from '@/lib/jobs/email-layout';

/**
 * Shop email bodies. Each message has a plain-text version and a branded HTML
 * version with the logo. Kept apart from the handlers so they are easy to
 * read, change and test. UK English, short lines.
 */

function storeName(): string {
  return process.env.NEXT_PUBLIC_APP_NAME ?? 'Prime Accessories Kenya';
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
}

function html(content: EmailContent): string {
  return renderEmailHtml(content, { storeName: storeName(), baseUrl: baseUrl() });
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
    html: html({
      heading: 'Reset your password',
      paragraphs: ['We received a request to reset your password. Use the button below to choose a new one.'],
      button: { label: 'Choose a new password', url: resetUrl },
      footnote:
        'The link expires in one hour. If you did not ask for this, you can ignore this email. Your password will not change.',
    }),
  };
}

export function staffInviteEmail(to: string, setPasswordUrl: string, roleLabel: string): MailMessage {
  return {
    to,
    subject: `You have been added to the ${storeName()} admin`,
    text: [
      `You have been given ${roleLabel} access to the ${storeName()} admin.`,
      '',
      `Open this link to choose your password: ${setPasswordUrl}`,
      '',
      `Then sign in at ${baseUrl()}/login with this email address.`,
      '',
      'The link expires in 3 days. If you were not expecting this, you can ignore this email.',
    ].join('\n'),
    html: html({
      heading: 'You have been added to the team',
      paragraphs: [
        `You have been given ${roleLabel} access to the ${storeName()} admin.`,
        `Choose your password with the button below, then sign in at ${baseUrl()}/login with this email address.`,
      ],
      button: { label: 'Choose your password', url: setPasswordUrl },
      footnote: 'The link expires in 3 days. If you were not expecting this, you can ignore this email.',
    }),
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
  const delivery = order.deliveryZone === 'PICKUP' ? 'Pick up from the shop' : 'Delivery';
  const access = order.isGuest ? 'Open it in the same browser you ordered with.' : 'Sign in to see it.';
  return {
    to,
    subject: `We have your order ${order.orderNumber}`,
    text: [
      `Thank you for shopping with ${storeName()}.`,
      '',
      `Order number: ${order.orderNumber}`,
      ...lines,
      `Total: ${formatPrice(order.total)}`,
      `Delivery: ${delivery}`,
      '',
      'If you have not paid yet, you can finish payment from your order page:',
      link,
      access,
      '',
      'We will let you know when your order is on its way.',
    ].join('\n'),
    html: html({
      heading: 'Thank you for your order',
      paragraphs: [
        `Thank you for shopping with ${storeName()}. Your order number is ${order.orderNumber}.`,
      ],
      lines: [
        ...order.items.map((item) => ({
          label: `${item.name} x ${item.quantity}`,
          value: formatPrice(Number(item.price) * item.quantity),
        })),
        { label: 'Delivery', value: delivery },
        { label: 'Total', value: formatPrice(order.total) },
      ],
      button: { label: 'View your order', url: link },
      footnote: `If you have not paid yet, you can finish payment from your order page. ${access} We will let you know when your order is on its way.`,
    }),
  };
}

export function backInStockEmail(to: string, product: { name: string; slug: string }): MailMessage {
  const link = `${baseUrl()}/products/${encodeURIComponent(product.slug)}`;
  return {
    to,
    subject: `${product.name} is back in stock`,
    text: [
      `Good news. ${product.name} is back in stock at ${storeName()}.`,
      '',
      `See it here: ${link}`,
      '',
      'Stock can sell out quickly. You asked us to tell you once, so this is the only email about it.',
    ].join('\n'),
    html: html({
      heading: 'Back in stock',
      paragraphs: [`Good news. ${product.name} is back in stock at ${storeName()}.`],
      button: { label: 'See it now', url: link },
      footnote: 'Stock can sell out quickly. You asked us to tell you once, so this is the only email about it.',
    }),
  };
}
