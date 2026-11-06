// Shonku — invite waitlist and project enquiries backend.
//
// A tiny, dependency-light Express service. It stores waitlist sign-ups, and
// the projects people ask the studio to build, in
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
let store; // { add(entry) -> {already}, list() -> [...], count() -> n,
           //   addProject(entry), listProjects() -> [...] }

// The columns a project enquiry is exported with, in order.
const PROJECT_FIELDS = ['email', 'name', 'project', 'timeline', 'budget', 'link', 'created_at'];
const TIMELINES = ['As soon as possible', 'In the next few months', 'Just exploring'];
const BUDGETS = ['Under ₹1 lakh', '₹1–5 lakh', '₹5–20 lakh', 'Over ₹20 lakh', 'Not sure yet'];

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
    CREATE TABLE IF NOT EXISTS projects (
      id          BIGSERIAL PRIMARY KEY,
      email       TEXT NOT NULL,
      name        TEXT,
      project     TEXT NOT NULL,
      timeline    TEXT,
      budget      TEXT,
      link        TEXT,
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
    async addProject(e) {
      await pool.query(
        `INSERT INTO projects (email, name, project, timeline, budget, link, source, user_agent, ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [e.email, e.name, e.project, e.timeline, e.budget, e.link, e.source, e.user_agent, e.ip]
      );
    },
    async listProjects() {
      const res = await pool.query(
        `SELECT ${PROJECT_FIELDS.join(', ')} FROM projects ORDER BY created_at DESC`
      );
      return res.rows;
    },
  };
}

function makeMemoryStore() {
  console.warn(
    '[waitlist] No DATABASE_URL — using an IN-MEMORY store. ' +
    'Data will NOT persist across restarts. Set DATABASE_URL for production.'
  );
  const byEmail = new Map();
  const projects = [];
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
    async addProject(e) { projects.push({ ...e, created_at: new Date().toISOString() }); },
    async listProjects() {
      return projects.map((p) => Object.fromEntries(PROJECT_FIELDS.map((k) => [k, p[k] ?? null]))).reverse();
    },
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
app.use(express.json({ limit: '16kb' }));

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
  // Honeypot: real people leave it empty; bots fill it. Pretend success, but
  // log it, so a real person caught by it shows up in the logs. (It used to be
  // named "company", which phone autofill filled in for real visitors.)
  if (typeof body.nb_trap === 'string' && body.nb_trap.trim() !== '') {
    console.warn('[waitlist] honeypot filled; not saved');
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

// Ask the studio to build something.
app.post('/api/projects', async (req, res) => {
  const ip = clientIp(req);
  if (rateLimited(ip)) return res.status(429).json({ error: 'Too many requests.' });

  const body = req.body || {};
  // the same honeypot as the waitlist
  if (typeof body.nb_trap === 'string' && body.nb_trap.trim() !== '') {
    console.warn('[projects] honeypot filled; not saved');
    return res.json({ ok: true });
  }

  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim().slice(0, 120);
  const project = String(body.project || '').trim();
  const link = String(body.link || '').trim().slice(0, 300);
  // only the choices the form offers are kept; anything else is dropped
  const timeline = TIMELINES.includes(body.timeline) ? body.timeline : null;
  const budget = BUDGETS.includes(body.budget) ? body.budget : null;
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (project.length < 10) {
    return res.status(400).json({ error: 'Tell us a little about the project (a sentence or two).' });
  }
  if (project.length > 4000) {
    return res.status(400).json({ error: 'That is longer than 4,000 characters. A shorter version, please.' });
  }

  try {
    await store.addProject({
      email, project, timeline, budget,
      name: name || null,
      link: link || null,
      source: String(body.source || 'website').slice(0, 60),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 300),
      ip,
    });
    console.log('[projects] enquiry saved');
    return res.json({ ok: true });
  } catch (err) {
    console.error('[projects] add failed:', err);
    return res.status(500).json({ error: 'Could not save. Please try again.' });
  }
});

// Admin: read the list / a count / a CSV. Guarded by ADMIN_TOKEN.
const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

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

app.get('/api/projects/export.csv', async (req, res) => {
  if (!requireAdmin(req, res)) return;
  try {
    const rows = await store.listProjects();
    const csv = [PROJECT_FIELDS.join(','),
      ...rows.map((r) => PROJECT_FIELDS.map((k) =>
        esc(r[k] instanceof Date ? r[k].toISOString() : r[k])).join(','))].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="projects.csv"');
    res.send(csv);
  } catch (err) {
    console.error('[projects] export failed:', err);
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
