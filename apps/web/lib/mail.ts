/**
 * Outbound email.
 *
 * Sends over SMTP via `nodemailer`. Two ways to configure it:
 *
 *   1. SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (recommended). Nothing to
 *      encode, so a login that contains "@" (Brevo's does) just works. The
 *      connection is always encrypted: port 465 uses TLS from the start, any
 *      other port must upgrade with STARTTLS or the send fails.
 *   2. SMTP_URL, a single connection string. Still supported. Any "@" in the
 *      login must be written as %40.
 *
 * SMTP_URL wins when both are set. `sendMail` is what every caller in the app
 * already uses; its signature hasn't changed.
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
  return Boolean(smtpOptions() || process.env.MAIL_PROVIDER_API_KEY);
}

/** A mail server that does not answer is given up on quickly. */
const TIMEOUTS = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000 };

type SmtpOptions = Record<string, unknown> & { host?: string; port?: number; url?: string };

/**
 * The nodemailer transport options from the environment, or null when SMTP
 * is not set up. Exported for tests and the admin "Send test email" check.
 */
export function smtpOptions(env: NodeJS.ProcessEnv = process.env): SmtpOptions | null {
  if (env.SMTP_URL) {
    // nodemailer 10 applies the other keys next to `url`.
    return { url: env.SMTP_URL, ...TIMEOUTS };
  }
  const host = env.SMTP_HOST?.trim();
  const user = env.SMTP_USER?.trim();
  const pass = env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  const parsedPort = Number(env.SMTP_PORT?.trim() || 587);
  const port = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536 ? parsedPort : 587;
  // Port 465 means TLS from the start. SMTP_SECURE=true forces it for a
  // provider that uses another port for that; SMTP_SECURE=false turns it off.
  const secureSetting = env.SMTP_SECURE?.trim().toLowerCase();
  const implicitTls = secureSetting === 'true' ? true : secureSetting === 'false' ? false : port === 465;
  return {
    host,
    port,
    secure: implicitTls,
    // Never send a password or a reset link over a plain connection.
    requireTLS: !implicitTls,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
    ...TIMEOUTS,
  };
}

/** Where mail goes, safe to show an admin: no login, no key. */
export function describeMailSettings(): { configured: boolean; server: string | null; from: string } {
  const options = smtpOptions();
  let server: string | null = null;
  if (options?.url) {
    try {
      const url = new URL(options.url);
      server = `${url.hostname}:${url.port || (url.protocol === 'smtps:' ? '465' : '587')}`;
    } catch {
      server = 'SMTP_URL (could not be read)';
    }
  } else if (options) {
    server = `${options.host}:${options.port}`;
  }
  return { configured: Boolean(options), server, from: fromAddress() };
}

/** For callers that should skip an optional email when no transport is set up. */
export function isMailConfigured(): boolean {
  return isConfigured();
}

let transporter: Transporter | null = null;

/** Lazily built so missing or wrong SMTP settings only break mail, not boot. */
function getTransporter(): Transporter {
  if (!transporter) {
    const options = smtpOptions();
    if (!options) {
      throw new Error('SMTP is not set up. Set SMTP_HOST, SMTP_USER and SMTP_PASS (or SMTP_URL).');
    }
    transporter = nodemailer.createTransport(options);
  }
  return transporter;
}

/** For tests: forget the cached connection settings. */
export function resetMailTransportForTests(): void {
  transporter = null;
}

/** Display name + address used as the envelope "From". */
function fromAddress(): string {
  const appName = process.env.NEXT_PUBLIC_APP_NAME ?? 'Prime Accessories Kenya';
  return process.env.MAIL_FROM?.trim() || `"${appName}" <no-reply@${defaultFromDomain()}>`;
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
  if (smtpOptions()) {
    const replyTo = process.env.MAIL_REPLY_TO?.trim();
    await getTransporter().sendMail({
      from: fromAddress(),
      to: message.to,
      subject: message.subject,
      text: message.text,
      ...(replyTo ? { replyTo } : {}),
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
        'Set the SMTP settings instead, or implement the provider call in apps/web/lib/mail.ts.'
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
          '[mail] # was NOT sent. Set the SMTP settings in production.\n' +
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
        '[mail] ▓  DEV-ONLY FALLBACK — NO MAIL TRANSPORT CONFIGURED (set SMTP_*)   ▓\n' +
        '[mail] ▓  This message was NOT sent to a real mailbox.                     ▓\n' +
        '[mail] ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓\n' +
        `[mail] To: ${message.to}\n[mail] Subject: ${message.subject}\n[mail] Body:\n${message.text}\n`
    );
    return { delivered: false };
  }

  await deliver(message);
  return { delivered: true };
}

/**
 * Turns a nodemailer failure into advice an admin can act on. The server's
 * own reply is kept (it never contains the password), so support can search
 * for it.
 */
export function explainMailError(error: unknown): string {
  const e = (error ?? {}) as { code?: string; responseCode?: number; response?: string; message?: string };
  const reply = (e.response ?? e.message ?? String(error)).slice(0, 200);
  const code = e.code ?? '';
  const status = e.responseCode ?? 0;

  if (/certificate|self[- ]signed|CERT_|unable to verify/i.test(reply)) {
    return (
      "The mail server's certificate could not be trusted, so nothing was sent. Check SMTP_HOST is the " +
      `provider's own address (for Brevo: smtp-relay.brevo.com). Details: ${reply}`
    );
  }
  if (code === 'EAUTH' || status === 535) {
    return (
      'The mail server refused the login. SMTP_USER must be the SMTP login from your provider ' +
      '(for Brevo it looks like 1234abc@smtp-brevo.com) and SMTP_PASS must be an SMTP key, ' +
      `not your account password or an API key. Server said: ${reply}`
    );
  }
  if (code === 'ETIMEDOUT' || code === 'ECONNECTION' || code === 'ECONNREFUSED' || code === 'ESOCKET' || code === 'EDNS') {
    return (
      'Could not reach the mail server. Check SMTP_HOST and SMTP_PORT. Some hosts block port 587; ' +
      `Brevo also accepts 2525, or 465 for TLS from the start. Details: ${reply}`
    );
  }
  if (code === 'ETLS' || /STARTTLS|TLS/i.test(reply)) {
    return `The secure connection failed, so nothing was sent. Details: ${reply}`;
  }
  if (code === 'EENVELOPE' || status === 550 || status === 553 || status === 554) {
    return (
      'The mail server refused the sender or recipient. Set MAIL_FROM to an address on a domain you ' +
      `have verified with your provider. Server said: ${reply}`
    );
  }
  return `Sending failed. Details: ${reply}`;
}

/**
 * Checks the connection and login, then sends one short email. Used by the
 * admin "Send test email" button. Never falls back to the console.
 */
export async function sendTestEmail(to: string): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!smtpOptions()) {
    return { ok: false, error: 'Email is not set up. Add SMTP_HOST, SMTP_USER and SMTP_PASS on the server.' };
  }
  try {
    const transport = getTransporter();
    await transport.verify();
    const { server, from } = describeMailSettings();
    await deliver({
      to,
      subject: 'Test email from your shop',
      text: [
        'This is a test email. If you can read it, your shop can send email.',
        '',
        `Sent through: ${server}`,
        `From: ${from}`,
        `Time: ${new Date().toISOString()}`,
      ].join('\n'),
    });
    return { ok: true };
  } catch (error) {
    // A wrong setting can be fixed and the button pressed again, so do not
    // keep a connection built from the old settings.
    transporter = null;
    return { ok: false, error: explainMailError(error) };
  }
}
