// Shared k6 helpers. Every virtual user gets its own fake client IP, sent as
// X-Forwarded-For, so the app's per-IP rate limits behave as they would for
// many real shoppers. Use this ONLY against a test environment.
import http from 'k6/http';
import exec from 'k6/execution';

export const BASE = __ENV.BASE_URL || 'http://localhost:3000';
export const ACTIONS = JSON.parse(open('../.action-ids.json'));
export const SLUGS = JSON.parse(open('../.slugs.json'));

export function clientIp() {
  const n = exec.vu.idInTest;
  return `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
}

export function params(tag, extra = {}) {
  return { headers: { 'X-Forwarded-For': clientIp(), ...extra }, tags: { name: tag }, redirects: 0 };
}

export function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

/** Calls a useActionState-style server action with form fields. */
export function callAction(path, actionId, fields, tag, prevState = null, flow = undefined) {
  // Same multipart shape the browser sends (captured from a real checkout):
  // form fields prefixed "_1_", and "0" = [previous state, reference to them].
  // k6 only sends multipart when a value is a file, so build it by hand.
  const boundary = '----k6LoadTest' + Math.random().toString(16).slice(2);
  const parts = Object.entries(fields).map(([key, value]) => [`${PREFIX}${key}`, String(value)]);
  parts.push(['0', JSON.stringify([prevState, '$K1'])]);
  const body =
    parts
      .map(([name, value]) => `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`)
      .join('') + `--${boundary}--\r\n`;
  const p = params(tag, {
    'Next-Action': actionId,
    Accept: 'text/x-component',
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  });
  if (flow) p.tags.flow = flow;
  const res = http.post(BASE + path, body, p);
  keepCookies(res);
  return res;
}

/**
 * The cart cookie is `Secure` in production builds, and k6 (unlike a browser
 * on localhost) won't send a Secure cookie over plain http. Copy cookies the
 * app sets into the jar without that flag so tests against http still work.
 */
export function keepCookies(res) {
  if (BASE.startsWith('https://')) return;
  const jar = http.cookieJar();
  for (const [name, list] of Object.entries(res.cookies)) {
    if (list.length) jar.set(BASE, name, list[0].value);
  }
}

const PREFIX = __ENV.ACTION_FIELD_PREFIX || '_1_';
