# Sending email with Brevo

The shop sends three kinds of email: password reset links, order confirmations and back-in-stock alerts. Brevo delivers them over SMTP. Brevo's free plan allows 300 emails a day, which is plenty for a new shop. Paid plans start at $9 a month if you outgrow it.

Allow a day for this. The DNS records can take up to 48 hours to take effect.

## 1. Create the account

Sign up at brevo.com. You don't need a card for the free plan.

## 2. Verify your domain

Brevo only sends reliably from a domain it trusts. You prove you own it with DNS records.

1. In Brevo, open the account menu, then **Settings > Senders, Domains, IPs > Domains**. Select **Add a domain** and enter it without `www`, for example `primeaccessorieskenya.co.ke`.
2. Brevo shows you the records to add. Copy each one exactly into your domain's DNS (where you bought the domain, or Cloudflare if it manages your DNS):

| Record | Type | What it does |
|---|---|---|
| Brevo code | TXT | Proves you own the domain |
| DKIM 1 and DKIM 2 (or one DKIM TXT) | CNAME (or TXT) | Signs each email so inboxes trust it |
| DMARC | TXT | Tells inboxes what to do with mail that fails the checks. A safe start: `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` |

3. If Cloudflare runs your DNS, turn off CNAME flattening for the DKIM records. Otherwise Cloudflare turns them into TXT records and DKIM fails.
4. Back in Brevo, select **Authenticate domain**. If it fails, wait and try again. It can take up to 48 hours.

Keep only one DMARC record on the domain. If one already exists, edit it rather than adding a second.

## 3. Add the sender

In the **Senders** tab of the same settings section, add the address the shop sends from, for example `orders@primeaccessorieskenya.co.ke` with the name `Prime Accessories Kenya`. It must be on the domain you just verified.

## 4. Get the SMTP login and key

Open **SMTP & API > SMTP** (the page is at `app.brevo.com/settings/keys/smtp`).

- **Login:** shown on that page. It looks like `1234abc@smtp-brevo.com`. It is not your own email address.
- **Key:** select **Generate a new SMTP key**, name it `shop server` and copy it. Brevo shows it once.

Use an SMTP key, not an API key. They look alike but SMTP refuses API keys.

Treat the key like a password. Put it only in the server's environment, never in the code, git or a chat.

## 5. Set the server settings

On the server, add these to the app's environment (the same place as `AUTH_SECRET`):

```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=1234abc@smtp-brevo.com
SMTP_PASS=<the SMTP key>
MAIL_FROM=Prime Accessories Kenya <orders@primeaccessorieskenya.co.ke>
MAIL_REPLY_TO=<the inbox where customer replies should go>
```

Leave `SMTP_URL` empty. When it is set, the app uses it instead of the lines above.

About the port: the app always encrypts the connection. On port 587 (or 2525) it upgrades with STARTTLS. On port 465 it uses TLS from the start. If your host blocks 587, try 2525.

Restart the app after changing these.

## 6. Allow your server's IP, if Brevo asks

Brevo can block SMTP logins from IP addresses it doesn't know (**your name > Security > Authorised IPs**). If your first send fails with a message about the IP not being authorised, add your server's public IP address there. Brevo may also email you to approve the new IP.

## 7. Test it

1. Sign in to the admin as an administrator.
2. Open **Settings > Background Jobs**. The **Email** box shows the mail server and the sender.
3. Select **Send test email**. It goes to your own admin address.
4. Check your inbox, and the spam folder if it isn't there within a minute.

If it fails, the page says why in plain words, for example a wrong login, an API key used instead of an SMTP key, a blocked port or an unverified sender. Fix the setting, restart the app and try again.

Then do one real check: use **Forgot password** on the shop with your own account.

## 8. Things to switch off or watch

- **Link tracking:** if Brevo rewrites links in transactional email for click tracking, reset links pass through a Brevo address first. Turn link tracking off for transactional email if your plan offers the setting.
- **Daily limit:** at 300 a day on the free plan, emails beyond the limit fail. Failed order and back-in-stock emails show on the Background Jobs page with a Retry button.
- **Bounces and spam complaints:** check **Transactional > Logs** in Brevo now and then.

## Sources

- [Brevo SMTP relay settings](https://developers.brevo.com/docs/smtp-integration)
- [Brevo Node.js SMTP example](https://developers.brevo.com/docs/node-smtp-relay-example)
- [Authenticate your domain with Brevo](https://help.brevo.com/hc/en-us/articles/12163873383186)
- [Set up your domain in Brevo](https://help.brevo.com/hc/en-us/articles/35337929909778)
- [Send transactional emails using Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450)
- [Brevo authorised IPs](https://help.brevo.com/hc/en-us/articles/5740111683858)
- [Brevo free SMTP plan](https://www.brevo.com/free-smtp-server)
