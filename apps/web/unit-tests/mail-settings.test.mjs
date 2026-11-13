import { describe, expect, it } from 'vitest';

const { smtpOptions, explainMailError, describeMailSettings, sendTestEmail } = await import('@/lib/mail');

const brevo = {
  SMTP_HOST: 'smtp-relay.brevo.com',
  SMTP_PORT: '587',
  SMTP_USER: '1234abc@smtp-brevo.com',
  SMTP_PASS: 'example-key',
};

describe('SMTP settings', () => {
  it('builds an encrypted Brevo connection from separate settings, "@" in the login and all', () => {
    const o = smtpOptions(brevo);
    expect(o).toMatchObject({
      host: 'smtp-relay.brevo.com',
      port: 587,
      secure: false,
      requireTLS: true,
      auth: { user: '1234abc@smtp-brevo.com', pass: 'example-key' },
    });
    expect(o.connectionTimeout).toBe(10_000);
  });

  it('uses TLS from the start on port 465', () => {
    expect(smtpOptions({ ...brevo, SMTP_PORT: '465' })).toMatchObject({ port: 465, secure: true, requireTLS: false });
  });

  it('SMTP_SECURE overrides the port rule', () => {
    expect(smtpOptions({ ...brevo, SMTP_PORT: '2465', SMTP_SECURE: 'true' })).toMatchObject({ secure: true, requireTLS: false });
    expect(smtpOptions({ ...brevo, SMTP_PORT: '465', SMTP_SECURE: 'false' })).toMatchObject({ secure: false, requireTLS: true });
  });

  it('defaults to 587 when the port is empty or nonsense', () => {
    expect(smtpOptions({ ...brevo, SMTP_PORT: '' }).port).toBe(587);
    expect(smtpOptions({ ...brevo, SMTP_PORT: 'abc' }).port).toBe(587);
  });

  it('is not set up until host, login and key are all present', () => {
    expect(smtpOptions({ SMTP_HOST: 'smtp-relay.brevo.com', SMTP_USER: 'x' })).toBeNull();
    expect(smtpOptions({})).toBeNull();
  });

  it('still accepts the single SMTP_URL, which wins over the separate settings', () => {
    const o = smtpOptions({ ...brevo, SMTP_URL: 'smtps://u%40x.com:k@mail.example.com:465' });
    expect(o.url).toBe('smtps://u%40x.com:k@mail.example.com:465');
    expect(o.host).toBeUndefined();
  });
});

describe('what admins see', () => {
  it('shows the server and sender, never the login or key', () => {
    const saved = { ...process.env };
    Object.assign(process.env, brevo, { MAIL_FROM: 'Shop <orders@example.co.ke>' });
    delete process.env.SMTP_URL;
    const shown = JSON.stringify(describeMailSettings());
    process.env = saved;
    expect(shown).toContain('smtp-relay.brevo.com:587');
    expect(shown).toContain('orders@example.co.ke');
    expect(shown).not.toContain('example-key');
    expect(shown).not.toContain('1234abc');
  });

  it('explains common failures in plain words', () => {
    expect(explainMailError({ code: 'EAUTH', responseCode: 535, response: '535 5.7.8 Authentication failed' })).toMatch(
      /SMTP key, not your account password or an API key.*535/
    );
    expect(explainMailError({ code: 'ETIMEDOUT', message: 'Connection timeout' })).toMatch(/2525/);
    expect(explainMailError({ code: 'ESOCKET', message: 'self-signed certificate' })).toMatch(/certificate could not be trusted/);
    expect(explainMailError({ code: 'EENVELOPE', responseCode: 550, response: '550 sender not valid' })).toMatch(
      /MAIL_FROM/
    );
  });

  it('refuses to test when nothing is set up', async () => {
    const saved = { ...process.env };
    for (const k of ['SMTP_URL', 'SMTP_HOST', 'SMTP_USER', 'SMTP_PASS']) delete process.env[k];
    const result = await sendTestEmail('admin@example.co.ke');
    process.env = saved;
    expect(result).toEqual({ ok: false, error: expect.stringMatching(/not set up/) });
  });
});
