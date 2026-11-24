import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { createRepositories } from '@repo/database';
import { getMetaPixelId } from '@/lib/meta-pixel';

/**
 * Reports the Meta "Purchase" standard event from the server, once an order
 * is actually confirmed — paid online, or placed as cash on delivery.
 *
 * Doing this server-side (Meta's "Conversions API") rather than only from
 * the browser matters for two reasons: a shopper who pays by M-Pesa STK or
 * Paybill and closes the tab before the callback arrives would otherwise
 * never register a Purchase at all, and a shopper with an ad blocker or
 * Safari's tracking prevention would silently drop the browser-side pixel
 * call. This is the one source of truth for "an order was confirmed",
 * called from each payment settlement path and from cash-on-delivery.
 *
 * Deliberately never throws: a Meta API hiccup must never stop a payment
 * from completing or an order from being confirmed.
 */
export async function reportPurchase(orderId: string): Promise<void> {
  const pixelId = getMetaPixelId();
  const accessToken = process.env.META_CONVERSIONS_API_TOKEN;
  if (!pixelId || !accessToken) return;

  try {
    const repos = createRepositories();
    const order = await repos.order.findById(orderId);
    if (!order) return;

    const email = order.user?.email ?? order.guestEmail ?? undefined;

    // One or more request headers are only present when this runs inside an
    // actual HTTP request (a webhook POST, a server action) — both call
    // sites qualify, but headers() throws outside that context, so this is
    // wrapped rather than assumed.
    let clientIp: string | undefined;
    let userAgent: string | undefined;
    try {
      const h = await headers();
      clientIp = h.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined;
      userAgent = h.get('user-agent') ?? undefined;
    } catch {
      // Not in a request context — send the event without these; Meta's
      // match quality is lower but the conversion still counts.
    }

    const payload = {
      data: [
        {
          event_name: 'Purchase',
          event_time: Math.floor(Date.now() / 1000),
          // One order settles its payment only once in the normal case, but
          // a retried webhook could call this twice within a race window.
          // Meta de-duplicates events sharing an event_id, so this is the
          // safety net, not the only guard — see the callers for the other.
          event_id: `order-${order.id}`,
          event_source_url: process.env.NEXT_PUBLIC_APP_URL,
          action_source: 'website',
          user_data: {
            ...(email ? { em: [sha256(email)] } : {}),
            ...(clientIp ? { client_ip_address: clientIp } : {}),
            ...(userAgent ? { client_user_agent: userAgent } : {}),
          },
          custom_data: {
            currency: order.currency,
            value: Number(order.total),
            content_type: 'product',
            content_ids: order.items.map((item) => item.productId),
            num_items: order.items.reduce((sum, item) => sum + item.quantity, 0),
            order_id: order.orderNumber,
          },
        },
      ],
    };

    const response = await fetch(
      `https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      console.error('Meta Conversions API rejected the Purchase event', {
        orderId,
        status: response.status,
        body: await response.text().catch(() => ''),
      });
    }
  } catch (error) {
    console.error('Meta Conversions API call failed', {
      orderId,
      error: error instanceof Error ? error.message : 'unknown',
    });
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
