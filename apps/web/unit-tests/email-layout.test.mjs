import { describe, expect, it } from 'vitest';

const { renderEmailHtml, escapeHtml } = await import('@/lib/jobs/email-layout');
const { orderConfirmationEmail, passwordResetEmail } = await import('@/lib/jobs/emails');

const brand = { storeName: 'Prime Accessories Kenya', baseUrl: 'https://primeaccessorieskenya.store' };

describe('renderEmailHtml', () => {
  it('shows the logo from the public site address', () => {
    const out = renderEmailHtml({ heading: 'Hi', paragraphs: ['Hello'] }, brand);
    expect(out).toContain('src="https://primeaccessorieskenya.store/images/email-logo.png"');
    expect(out).toContain('alt="Prime Accessories Kenya"');
  });

  it('escapes HTML in names and text so nothing can be injected', () => {
    const out = renderEmailHtml(
      { heading: '<b>x</b>', paragraphs: ['<script>alert(1)</script>'], lines: [{ label: '"><img src=x>', value: '1' }] },
      brand
    );
    expect(out).not.toContain('<script>');
    expect(out).not.toContain('<img src=x>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('does not turn a non-http link into a clickable link', () => {
    const out = renderEmailHtml(
      { heading: 'x', paragraphs: [], button: { label: 'Go', url: 'javascript:alert(1)' } },
      brand
    );
    expect(out).not.toContain('javascript:');
    expect(out).toContain('href="#"');
  });

  it('escapeHtml handles quotes and ampersands', () => {
    expect(escapeHtml(`A & "B" 'C'`)).toBe('A &amp; &quot;B&quot; &#39;C&#39;');
  });
});

describe('shop emails', () => {
  it('password reset keeps its plain text and adds branded HTML with the link', () => {
    const msg = passwordResetEmail('a@b.co', 'https://x.test/reset?token=abc&email=a%40b.co');
    expect(msg.text).toContain('https://x.test/reset?token=abc&email=a%40b.co');
    expect(msg.html).toContain('email-logo.png');
    expect(msg.html).toContain('token=abc&amp;email=a%40b.co');
  });

  it('order confirmation lists items and escapes a hostile product name', () => {
    const msg = orderConfirmationEmail('a@b.co', {
      orderNumber: 'PA-1',
      isGuest: false,
      total: 1500,
      deliveryZone: 'PICKUP',
      items: [{ name: '<i>Case</i>', quantity: 2, price: 750 }],
    });
    expect(msg.html).toContain('&lt;i&gt;Case&lt;/i&gt; x 2');
    expect(msg.html).not.toContain('<i>Case</i>');
    expect(msg.text).toContain('Order number: PA-1');
  });
});
