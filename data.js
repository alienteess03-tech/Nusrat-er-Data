import { isAuthenticated, json, readJson } from '../lib/server.js';
import { mergeCloudStates, normalizeCloudState, stableJson } from '../lib/merge.js';

function getDatabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Vercel-এ SUPABASE_URL এবং SUPABASE_SECRET_KEY সেট করা হয়নি।');
  return { url: url.replace(/\/+$/, ''), key };
}

async function dbFetch(path, options = {}) {
  const { url, key } = getDatabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = text; }
  if (!response.ok) {
    const detail = payload && typeof payload === 'object' ? payload.message || payload.details || payload.hint : payload;
    throw new Error(`Supabase database error (${response.status})${detail ? ': ' + detail : ''}`);
  }
  return payload;
}

async function readCurrentRow() {
  const rows = await dbFetch('household_state?select=id,state,revision,initialized,updated_at&id=eq.main&limit=1');
  if (!Array.isArray(rows) || !rows.length) throw new Error('Database table তৈরি হয়নি। README-এর database.sql একবার চালান।');
  return rows[0];
}

async function saveWithCompareAndSwap(row, nextState) {
  const nextRevision = Number(row.revision || 0) + 1;
  const result = await dbFetch(`household_state?id=eq.main&revision=eq.${encodeURIComponent(String(row.revision))}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      state: nextState,
      revision: nextRevision,
      initialized: true,
      updated_at: new Date().toISOString(),
    }),
  });
  return Array.isArray(result) && result.length > 0 ? result[0] : null;
}

export default {
  async fetch(request) {
    if (!['GET', 'PUT'].includes(request.method.toUpperCase())) return json({ error: 'Method not allowed' }, 405, { Allow: 'GET, PUT' });
    if (!isAuthenticated(request)) return json({ error: 'PIN দিয়ে আবার প্রবেশ করুন।' }, 401);

    try {
      if (request.method.toUpperCase() === 'GET') {
        const row = await readCurrentRow();
        return json({
          data: row.state || {},
          revision: Number(row.revision || 0),
          initialized: Boolean(row.initialized),
          updatedAt: row.updated_at,
        });
      }

      const body = await readJson(request, 1_500_000);
      const localState = normalizeCloudState(body.data);
      const baseState = normalizeCloudState(body.base || {});
      let lastError = null;

      // Optimistic revision check prevents two devices from silently overwriting each other.
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const current = await readCurrentRow();
        const remoteState = normalizeCloudState(current.state || {});
        const merged = current.initialized
          ? mergeCloudStates(baseState, localState, remoteState)
          : mergeCloudStates({}, localState, remoteState);

        if (current.initialized && stableJson(merged) === stableJson(remoteState)) {
          return json({ data: remoteState, revision: Number(current.revision || 0), initialized: true, updatedAt: current.updated_at });
        }

        const saved = await saveWithCompareAndSwap(current, merged);
        if (saved) {
          return json({ data: saved.state || merged, revision: Number(saved.revision || 0), initialized: true, updatedAt: saved.updated_at });
        }
        lastError = new Error('একই সময়ে অন্য ডিভাইস ডেটা আপডেট করেছে; আবার চেষ্টা করা হচ্ছে।');
      }
      throw lastError || new Error('ডেটা সেভ করা যায়নি।');
    } catch (error) {
      console.error('Shared data API error:', error.message);
      return json({ error: error.message || 'ডেটা লোড/সেভ করা যায়নি।' }, 500);
    }
  },
};
