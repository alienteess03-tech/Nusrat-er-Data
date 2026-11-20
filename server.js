import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE_NAME = 'nusrat_household_session';
const SESSION_SECONDS = 60 * 60 * 24 * 14;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function appConfigError() {
  if (!process.env.APP_PIN || !process.env.SESSION_SECRET) {
    return 'Vercel Environment Variables-এ APP_PIN এবং SESSION_SECRET সেট করা হয়নি।';
  }
  return null;
}

export async function readJson(request, maxBytes = 1_500_000) {
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maxBytes) throw new Error('Request body অনেক বড়।');
  try { return text ? JSON.parse(text) : {}; }
  catch { throw new Error('সঠিক JSON পাঠানো হয়নি।'); }
}

function signature(expiry) {
  return createHmac('sha256', process.env.SESSION_SECRET)
    .update(`nusrat-household:${expiry}`)
    .digest('hex');
}

function cookieValue(request) {
  const raw = request.headers.get('cookie') || '';
  const item = raw.split(';').map(x => x.trim()).find(x => x.startsWith(`${COOKIE_NAME}=`));
  return item ? decodeURIComponent(item.slice(COOKIE_NAME.length + 1)) : '';
}

export function isAuthenticated(request) {
  if (!process.env.SESSION_SECRET) return false;
  const token = cookieValue(request);
  const [expiryText, suppliedSignature] = token.split('.');
  const expiry = Number(expiryText);
  if (!Number.isSafeInteger(expiry) || expiry <= Math.floor(Date.now() / 1000) || !/^[a-f0-9]{64}$/i.test(suppliedSignature || '')) return false;
  const expected = Buffer.from(signature(expiry), 'hex');
  const actual = Buffer.from(suppliedSignature, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function issueSessionCookie(request) {
  const expiry = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const token = `${expiry}.${signature(expiry)}`;
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_SECONDS}${secure}`;
}

export function clearSessionCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

export function sameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try { return new URL(origin).host === new URL(request.url).host; }
  catch { return false; }
}

export function constantTimeTextEqual(a, b) {
  const left = createHash('sha256').update(String(a)).digest();
  const right = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(left, right);
}
