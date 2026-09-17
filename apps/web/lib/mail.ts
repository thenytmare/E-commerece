/**
 * Outbound email.
 *
 * Sends over SMTP via `nodemailer` when `SMTP_URL` is configured — that is
 * the fully-supported path and what production must set. `sendMail` is what
 * every caller in the app already uses; its signature hasn't changed.
 */
import nodemailer, { type Transporter } from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body. Keep messages text-only until a real transport exists. */
  text: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * True once *some* transport has a chance of working. This intentionally
 * does not guarantee `deliver` will succeed (e.g. `MAIL_PROVIDER_API_KEY` is
 * accepted here but not yet wired to a provider — see the TODO below) so
 * that callers still get a loud failure instead of a silent no-op when that
 * path is hit.
 */
function isConfigured(): boolean {
  return Boolean(process.env.SMTP_URL || process.env.MAIL_PROVIDER_API_KEY);
}

let transporter: Transporter | null = null;

/** Lazily built so a missing/invalid `SMTP_URL` only breaks mail, not boot. */
function getTransporter(): Transporter {
  if (!transporter) {
    const smtpUrl = process.env.SMTP_URL;
    if (!smtpUrl) {
      throw new Error('SMTP_URL is not set.');
    }
    // nodemailer parses a full connection string directly, e.g.
    // smtp://user:pass@smtp.example.com:587
    transporter = nodemailer.createTransport(smtpUrl);
  }
  return transporter;
}

/** Display name + address used as the envelope "From". */
function fromAddress(): string {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Prime Accessories Kenya';
  return process.env.MAIL_FROM ?? `"${appName}" <no-reply@${defaultFromDomain()}>`;
}

function defaultFromDomain(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    try {
      return new URL(appUrl).hostname;
    } catch {
      // fall through to the generic default below
    }
  }
  return 'localhost';
}

async function deliver(message: MailMessage): Promise<void> {
  if (process.env.SMTP_URL) {
    await getTransporter().sendMail({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return;
  }

  if (process.env.MAIL_PROVIDER_API_KEY) {
    // TODO: MAIL_PROVIDER_API_KEY has no provider bound to it anywhere in
    // this codebase yet (Resend? SendGrid? Africa's Talking?) — the intended
    // HTTP-API provider was never specified. Implement that call here once
    // it's decided. Left unimplemented on purpose: it must fail loudly (the
    // throw below) rather than silently pretend to send, since callers rely
    // on `isConfigured()`/this function agreeing about what actually works.
    throw new Error(
      `MAIL_PROVIDER_API_KEY is set but no provider integration is implemented; cannot send "${message.subject}". ` +
        'Set SMTP_URL instead, or implement the provider call in apps/web/lib/mail.ts.'
    );
  }

  // Unreachable via sendMail() (guarded by isConfigured()), kept as a safety net.
  throw new Error(`No mail transport implemented; cannot send "${message.subject}".`);
}

export async function sendMail(message: MailMessage): Promise<{ delivered: boolean }> {
  if (!isConfigured()) {
    if (isProduction()) {
      // Loud and alertable, but never the message body/token — a leaked log
      // line must not double as a leaked reset link.
      console.error(
        '[mail] ################################################################\n' +
          '[mail] # MAIL IS NOT CONFIGURED — this email, including any reset link,\n' +
          '[mail] # was NOT sent. Set SMTP_URL in the production environment.\n' +
          `[mail] # To: ${message.to}  Subject: "${message.subject}"\n` +
          '[mail] ################################################################'
      );
      throw new Error(
        `Mail transport is not configured in production; cannot send "${message.subject}" to ${message.to}.`
      );
    }

    // Development-only convenience so a reset link is still usable locally
    // without real SMTP. Deliberately loud/ugly so it can never be mistaken
    // for a real send.
    console.warn(
      '\n[mail] ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n' +
        '[mail] ▓  DEV-ONLY FALLBACK — NO MAIL TRANSPORT CONFIGURED (set SMTP_URL)  ▓\n' +
        '[mail] ▓  This message was NOT sent to a real mailbox.                     ▓\n' +
        '[mail] ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n' +
        `[mail] To: ${message.to}\n[mail] Subject: ${message.subject}\n[mail] Body:\n${message.text}\n`
    );
    return { delivered: false };
  }

  await deliver(message);
  return { delivered: true };
}
