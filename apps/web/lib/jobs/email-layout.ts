/**
 * Branded HTML wrapper for shop emails.
 *
 * Email clients are fussy: layout uses tables, styles are inline, and images
 * need a full public https address. The plain-text body is still sent too, so
 * clients that block HTML (and spam filters) see a normal message.
 */

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface EmailLine {
  label: string;
  value: string;
}

export interface EmailContent {
  /** Short heading under the logo. */
  heading: string;
  /** Paragraphs of body text. Plain text, escaped here. */
  paragraphs: string[];
  /** Optional rows shown as a small summary table (for example order items). */
  lines?: EmailLine[];
  /** Optional call-to-action button. */
  button?: { label: string; url: string };
  /** Small print under the button. */
  footnote?: string;
}

const GOLD = '#B8860B';
const INK = '#1a1a1a';
const MUTED = '#6b6b6b';

/** Only allow http(s) links, so a bad value can never become a javascript: link. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? url : '#';
}

export function renderEmailHtml(
  content: EmailContent,
  brand: { storeName: string; baseUrl: string }
): string {
  const logoUrl = `${brand.baseUrl}/images/email-logo.png`;
  const name = escapeHtml(brand.storeName);

  const paragraphs = content.paragraphs
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${INK};">${escapeHtml(p)}</p>`
    )
    .join('');

  const lines = content.lines?.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;border-top:1px solid #eee;">${content.lines
        .map(
          (l) =>
            `<tr><td style="padding:10px 0;border-bottom:1px solid #eee;font-size:15px;color:${INK};">${escapeHtml(l.label)}</td><td align="right" style="padding:10px 0;border-bottom:1px solid #eee;font-size:15px;color:${INK};white-space:nowrap;">${escapeHtml(l.value)}</td></tr>`
        )
        .join('')}</table>`
    : '';

  const button = content.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;"><tr><td style="background:${INK};border-radius:8px;"><a href="${escapeHtml(safeUrl(content.button.url))}" style="display:inline-block;padding:14px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(content.button.label)}</a></td></tr></table>`
    : '';

  const footnote = content.footnote
    ? `<p style="margin:0;font-size:13px;line-height:1.5;color:${MUTED};">${escapeHtml(content.footnote)}</p>`
    : '';

  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(content.heading)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f2;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;border-top:4px solid ${GOLD};">
<tr><td align="center" style="padding:28px 24px 8px;">
<img src="${escapeHtml(logoUrl)}" width="120" alt="${name}" style="display:block;border:0;outline:none;height:auto;max-width:120px;">
</td></tr>
<tr><td style="padding:8px 32px 32px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<h1 style="margin:16px 0 20px;font-size:22px;line-height:1.3;color:${INK};text-align:center;">${escapeHtml(content.heading)}</h1>
${paragraphs}${lines}${button}${footnote}
</td></tr>
</table>
<p style="max-width:560px;margin:16px auto 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.5;color:${MUTED};text-align:center;">${name}</p>
</td></tr>
</table>
</body>
</html>`;
}
