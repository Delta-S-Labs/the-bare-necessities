// Shonku — invite waitlist backend.
//
// A tiny, dependency-light Express service. It stores waitlist sign-ups in
// Postgres (Render Postgres, Neon, Supabase — anything with a DATABASE_URL),
// which lives OUTSIDE the web container, so the data survives restarts,
// redeploys and scale-to-zero. With no DATABASE_URL set it falls back to an
// in-memory store for local development only (clearly not persistent).

import express from 'express';
import pg from 'pg';

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || '';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map((s) => s.trim()).filter(Boolean);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/* ───────────────────────── storage ───────────────────────── */
let store; // { add(entry) -> {already}, list() -> [...], count() -> n }

async function makePgStore(url) {
  const useSsl = /sslmode=require/i.test(url) || process.env.DATABASE_SSL === 'true';
  const pool = new pg.Pool({
    connectionString: url,
    ssl: useSsl ? { rejectUnauthorized: false } : undefined,
    max: 5,
  });
  await pool.query(`
    CREATE TABLE IF NOT EXISTS waitlist (
      id          BIGSERIAL PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      name        TEXT,
      source      TEXT,
      user_agent  TEXT,
      ip          TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  return {
    async add(e) {
      const res = await pool.query(
        `INSERT INTO waitlist (email, name, source, user_agent, ip)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (email) DO NOTHING
         RETURNING id`,
        [e.email, e.name, e.source, e.user_agent, e.ip]
      );
      return { already: res.rowCount === 0 };
    },
    async list() {
      const res = await pool.query(
        `SELECT email, name, created_at FROM waitlist ORDER BY created_at DESC`
      );
      return res.rows;
    },
    async count() {
      const res = await pool.query(`SELECT COUNT(*)::int AS n FROM waitlist`);
      return res.rows[0].n;
    },
  };
}

function makeMemoryStore() {
  console.warn(
    '[waitlist] No DATABASE_URL — using an IN-MEMORY store. ' +
    'Data will NOT persist across restarts. Set DATABASE_URL for production.'
  );
  const byEmail = new Map();
  return {
    async add(e) {
      if (byEmail.has(e.email)) return { already: true };
      byEmail.set(e.email, { ...e, created_at: new Date().toISOString() });
      return { already: false };
    },
    async list() {
      return [...byEmail.values()]
        .map(({ email, name, created_at }) => ({ email, name, created_at }))
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    },
    async count() { return byEmail.size; },
  };
}

/* ───────────────────────── rate limiting ───────────────────────── */
const hits = new Map(); // ip -> { count, reset }
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
function rateLimited(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_PER_WINDOW;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, rec] of hits) if (now > rec.reset) hits.delete(ip);
}, WINDOW_MS).unref();

/* ───────────────────────── app ───────────────────────── */
const app = express();
app.set('trust proxy', true);
app.use(express.json({ limit: '8kb' }));

function cors(req, res) {
  const origin = req.headers.origin;
  if (!origin) return;
  const ok = ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin);
  if (ok) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Token');
    res.setHeader('Access-Control-Max-Age', '86400');
  }
}
app.use((req, res, next) => {
  cors(req, res);
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const clientIp = (req) =>
  (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
  req.socket.remoteAddress || '';

app.get('/', (_req, res) => res.json({ ok: true, service: 'shonku-waitlist' }));
app.get('/health', (_req, res) => res.json({ ok: true }));

// Join the waitlist.
app.post('/api/waitlist', async (req, res) => {
  const ip = clientIp(req);
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const body = req.body || {};
  // Honeypot: real people leave it empty; bots fill it. Pretend success.
  if (typeof body.company === 'string' && body.company.trim() !== '') {
    return res.json({ ok: true, already: false });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim().slice(0, 120);
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  try {
    const { already } = await store.add({
      email,
      name: name || null,
      source: String(body.source || 'website').slice(0, 60),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
      ip,
    });
    return res.json({ ok: true, already });
  } catch (err) {
    console.error('[waitlist] add failed:', err);
    return res.status(500).json({ error: 'Could not save. Please try again.' });
  }
});

// Admin: read the list / a count / a CSV. Guarded by ADMIN_TOKEN.
function requireAdmin(req, res) {
  if (!ADMIN_TOKEN) { res.status(503).json({ error: 'Admin not configured.' }); return false; }
  const token = req.headers['x-admin-token'] || req.query.token || '';
  if (token !== ADMIN_TOKEN) { res.status(401).json({ error: 'Unauthorized.' }); return false; }
  return true;
}

app.get('/api/waitlist', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await store.list();
    res.json({ ok: true, count: rows.length, entries: rows });
  } catch (err) {
    console.error('[waitlist] list failed:', err);
    res.status(500).json({ error: 'Could not read list.' });
  }
});

app.get('/api/waitlist/count', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try { res.json({ ok: true, count: await store.count() }); }
  catch (err) { res.status(500).json({ error: 'Could not count.' }); }
});

app.get('/api/waitlist/export.csv', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await store.list();
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = ['email,name,created_at',
      ...rows.map((r) => [r.email, r.name, r.created_at].map(esc).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="waitlist.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[waitlist] export failed:', err);
    res.status(500).json({ error: 'Could not export.' });
  }
});

/* ───────────────────────── boot ───────────────────────── */
(async () => {
  try {
    store = DATABASE_URL ? await makePgStore(DATABASE_URL) : makeMemoryStore();
  } catch (err) {
    console.error('[waitlist] storage init failed:', err);
    process.exit(1);
  }
  app.listen(PORT, () => {
    console.log(`[waitlist] listening on :${PORT}` +
      (DATABASE_URL ? ' (postgres)' : ' (in-memory, not persistent)'));
  });
})();
