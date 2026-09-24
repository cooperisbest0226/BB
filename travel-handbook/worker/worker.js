/**
 * 旅行手冊 · 分享後端（Cloudflare Worker + KV）
 *
 * API（全部 JSON）：
 *   POST   /trips          建立分享      body: { data }         → { id, key, updatedAt }
 *   GET    /trips/:id      讀取（唯讀端）                       → { data, updatedAt }
 *   PUT    /trips/:id      更新（規劃者）Authorization: Bearer key, body: { data } → { updatedAt }
 *   DELETE /trips/:id      停止分享     Authorization: Bearer key → { ok: true }
 *
 * - id：16 碼隨機，放在分享連結裡，知道 id 就能讀（唯讀）
 * - key：32 碼隨機，只存在規劃者手機，KV 裡只存它的 SHA-256
 * - 單份行程上限 256 KB（附件本來就不上傳，純文字綽綽有餘）
 *
 *   POST   /route          計算開車車程（Google Routes API）
 *                          body: { from, to, region?, depart?, traffic? } → { seconds, staticSeconds, meters, traffic }
 *   - 需要 secret：npx wrangler secret put GOOGLE_MAPS_KEY
 *   - traffic=true 且 depart 在未來 → 含路況預估（Pro 計費）；其餘不含路況（Essentials 計費）
 *   - 只接受 ALLOWED_ORIGINS 來源的請求（設為 * 時不檢查）
 */

const MAX_BYTES = 256 * 1024;
const ID_RE = /^[A-Za-z0-9]{16}$/;

function randomId(len) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (const b of bytes) out += chars[b % chars.length];
  return out;
}

async function sha256(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(env, req) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  const origin = req.headers.get('Origin') || '';
  const allow = allowed.includes('*') ? '*' : (allowed.includes(origin) ? origin : allowed[0]);
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, cors) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors }
  });
}

async function readBody(req) {
  const text = await req.text();
  if (new TextEncoder().encode(text).length > MAX_BYTES) return { error: 'too_large' };
  try {
    const body = JSON.parse(text);
    if (!body || typeof body.data !== 'object' || body.data === null) return { error: 'bad_body' };
    return { data: body.data };
  } catch {
    return { error: 'bad_json' };
  }
}

function parseSec(d) { const n = parseFloat(String(d || '').replace(/s$/, '')); return isFinite(n) ? Math.round(n) : null; }

async function route(req, env, cors) {
  const allowed = (env.ALLOWED_ORIGINS || '*').split(',').map((s) => s.trim());
  if (!allowed.includes('*') && !allowed.includes(req.headers.get('Origin') || '')) return json({ error: 'forbidden_origin' }, 403, cors);
  if (!env.GOOGLE_MAPS_KEY) return json({ error: 'no_maps_key' }, 501, cors);
  let body;
  try { body = JSON.parse(await req.text()); } catch { return json({ error: 'bad_json' }, 400, cors); }
  const from = String(body.from || '').trim().slice(0, 200);
  const to = String(body.to || '').trim().slice(0, 200);
  if (!from || !to) return json({ error: 'bad_body' }, 400, cors);
  const region = /^[a-z]{2}$/i.test(body.region || '') ? body.region.toLowerCase() : undefined;
  const departMs = body.depart ? Date.parse(body.depart) : NaN;
  const traffic = !!body.traffic && isFinite(departMs) && departMs > Date.now() + 60000;
  const gReq = {
    origin: { address: from },
    destination: { address: to },
    travelMode: 'DRIVE',
    routingPreference: traffic ? 'TRAFFIC_AWARE' : 'TRAFFIC_UNAWARE',
    languageCode: 'zh-TW',
    units: 'METRIC'
  };
  if (traffic) gReq.departureTime = new Date(departMs).toISOString();
  if (region) gReq.regionCode = region;
  const r = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_KEY,
      'X-Goog-FieldMask': 'routes.duration,routes.staticDuration,routes.distanceMeters'
    },
    body: JSON.stringify(gReq)
  });
  const g = await r.json().catch(() => ({}));
  if (!r.ok) {
    // 地址查不到時 Google 回 400/404；金鑰或計費問題回 403
    if (r.status === 403) return json({ error: 'maps_denied' }, 502, cors);
    if (r.status === 429) return json({ error: 'maps_quota' }, 429, cors);
    return json({ error: 'no_route' }, 422, cors);
  }
  const rt = g.routes && g.routes[0];
  if (!rt || rt.distanceMeters == null) return json({ error: 'no_route' }, 422, cors);
  const seconds = parseSec(rt.duration), staticSeconds = parseSec(rt.staticDuration) ?? seconds;
  return json({ seconds, staticSeconds, meters: rt.distanceMeters, traffic }, 200, cors);
}

async function authorized(req, record) {
  const auth = req.headers.get('Authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!key) return false;
  return (await sha256(key)) === record.keyHash;
}

export default {
  async fetch(req, env) {
    const cors = corsHeaders(env, req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(req.url);
    const parts = url.pathname.replace(/\/+$/, '').split('/').filter(Boolean);
    if (parts[0] === 'route' && parts.length === 1 && req.method === 'POST') {
      try { return await route(req, env, cors); } catch { return json({ error: 'server_error' }, 500, cors); }
    }
    if (parts[0] !== 'trips') return json({ error: 'not_found' }, 404, cors);

    try {
      // POST /trips
      if (parts.length === 1 && req.method === 'POST') {
        const body = await readBody(req);
        if (body.error) return json({ error: body.error }, body.error === 'too_large' ? 413 : 400, cors);
        const id = randomId(16);
        const key = randomId(32);
        const updatedAt = Date.now();
        await env.TRIPS.put(id, JSON.stringify({ data: body.data, keyHash: await sha256(key), updatedAt }));
        return json({ id, key, updatedAt }, 201, cors);
      }

      if (parts.length !== 2 || !ID_RE.test(parts[1])) return json({ error: 'not_found' }, 404, cors);
      const id = parts[1];
      const raw = await env.TRIPS.get(id);
      if (!raw) return json({ error: 'not_found' }, 404, cors);
      const record = JSON.parse(raw);

      if (req.method === 'GET') {
        return json({ data: record.data, updatedAt: record.updatedAt }, 200, cors);
      }
      if (req.method === 'PUT') {
        if (!(await authorized(req, record))) return json({ error: 'forbidden' }, 403, cors);
        const body = await readBody(req);
        if (body.error) return json({ error: body.error }, body.error === 'too_large' ? 413 : 400, cors);
        const updatedAt = Date.now();
        await env.TRIPS.put(id, JSON.stringify({ data: body.data, keyHash: record.keyHash, updatedAt }));
        return json({ updatedAt }, 200, cors);
      }
      if (req.method === 'DELETE') {
        if (!(await authorized(req, record))) return json({ error: 'forbidden' }, 403, cors);
        await env.TRIPS.delete(id);
        return json({ ok: true }, 200, cors);
      }
      return json({ error: 'method_not_allowed' }, 405, cors);
    } catch (err) {
      return json({ error: 'server_error' }, 500, cors);
    }
  }
};
