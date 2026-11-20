import {
  appConfigError, clearSessionCookie, constantTimeTextEqual, isAuthenticated,
  issueSessionCookie, json, readJson, sameOrigin,
} from '../lib/server.js';

export default {
  async fetch(request) {
    const method = request.method.toUpperCase();
    if (!['GET', 'POST', 'DELETE'].includes(method)) return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, POST, DELETE' });

    const configError = appConfigError();
    if (configError) return json({ error: configError }, 503);

    if (method === 'GET') {
      return isAuthenticated(request)
        ? json({ authenticated: true })
        : json({ authenticated: false, error: 'PIN required' }, 401);
    }

    if (!sameOrigin(request)) return json({ error: 'অবৈধ অনুরোধ।' }, 403);

    if (method === 'DELETE') {
      return json({ ok: true }, 200, { 'Set-Cookie': clearSessionCookie(request) });
    }

    try {
      const body = await readJson(request, 8_000);
      const pin = String(body.pin || '');
      if (!/^\d{4}$/.test(pin) || !constantTimeTextEqual(pin, process.env.APP_PIN)) {
        return json({ error: 'ভুল PIN। আবার চেষ্টা করুন।' }, 401);
      }
      return json({ ok: true, authenticated: true }, 200, { 'Set-Cookie': issueSessionCookie(request) });
    } catch (error) {
      return json({ error: error.message || 'Login failed' }, 400);
    }
  },
};
