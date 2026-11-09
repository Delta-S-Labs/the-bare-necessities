// Client demos: a shop's collection that its owner manages from an admin page.
//
//   GET    /api/demo/:shop/pieces            the pieces on show (all of them, hidden
//                                            ones too, with the passcode)
//   POST   /api/demo/:shop/login             check a passcode
//   POST   /api/demo/:shop/pieces            add a piece            (passcode)
//   PUT    /api/demo/:shop/pieces/:id        change a piece         (passcode)
//   DELETE /api/demo/:shop/pieces/:id        remove a piece         (passcode)
//   PUT    /api/demo/:shop/order             set the display order  (passcode)
//   POST   /api/demo/:shop/photos            upload one photo, raw body (passcode)
//   GET    /api/demo/:shop/photos/:id        a photo
//
// The passcode travels in the X-Demo-Passcode header. Photos are resized in the
// owner's browser before upload, so each is a few hundred KB at most; they live
// in Postgres next to the pieces, so one backup covers both.

import crypto from 'node:crypto';
import express from 'express';
import { SHOPS, CATEGORIES, SIZES, passcodeFor } from './demo-shops.js';

const PHOTO_TYPES = { 'image/webp': 'RIFF', 'image/jpeg': '\xff\xd8\xff', 'image/png': '\x89PNG' };
const MAX_PHOTO_BYTES = 3 * 1024 * 1024;
const MAX_PIECES = 300;
const MAX_PHOTOS_PER_PIECE = 6;

/* ───────────── storage: Postgres, or memory for local development ───────────── */

export async function makeDemoPgStore(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS demo_shops (
      shop        TEXT PRIMARY KEY,
      seeded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS demo_pieces (
      shop        TEXT NOT NULL,
      id          TEXT NOT NULL,
      data        JSONB NOT NULL,
      position    INT NOT NULL DEFAULT 0,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (shop, id)
    );
    CREATE TABLE IF NOT EXISTS demo_photos (
      id          TEXT PRIMARY KEY,
      shop        TEXT NOT NULL,
      mime        TEXT NOT NULL,
      bytes       BYTEA NOT NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  const row = (r) => ({ ...r.data, id: r.id, position: r.position, updatedAt: r.updated_at });
  return {
    async seeded(shop) {
      const r = await pool.query('SELECT 1 FROM demo_shops WHERE shop = $1', [shop]);
      return r.rowCount > 0;
    },
    async seed(shop, pieces) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const r = await client.query(
          'INSERT INTO demo_shops (shop) VALUES ($1) ON CONFLICT DO NOTHING RETURNING shop', [shop]);
        if (r.rowCount) {
          for (const [i, piece] of pieces.entries()) {
            const { id, ...data } = piece;
            await client.query(
              'INSERT INTO demo_pieces (shop, id, data, position) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
              [shop, id, data, i]);
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async list(shop) {
      const r = await pool.query(
        'SELECT id, data, position, updated_at FROM demo_pieces WHERE shop = $1 ORDER BY position, created_at', [shop]);
      return r.rows.map(row);
    },
    async count(shop) {
      const r = await pool.query('SELECT COUNT(*)::int AS n FROM demo_pieces WHERE shop = $1', [shop]);
      return r.rows[0].n;
    },
    async insert(shop, id, data) {
      const r = await pool.query(
        `INSERT INTO demo_pieces (shop, id, data, position)
         VALUES ($1, $2, $3, (SELECT COALESCE(MIN(position), 0) - 1 FROM demo_pieces WHERE shop = $1))
         RETURNING id, data, position, updated_at`, [shop, id, data]);
      return row(r.rows[0]);
    },
    async update(shop, id, data) {
      const r = await pool.query(
        `UPDATE demo_pieces SET data = $3, updated_at = now() WHERE shop = $1 AND id = $2
         RETURNING id, data, position, updated_at`, [shop, id, data]);
      return r.rowCount ? row(r.rows[0]) : null;
    },
    async remove(shop, id) {
      const r = await pool.query('DELETE FROM demo_pieces WHERE shop = $1 AND id = $2', [shop, id]);
      return r.rowCount > 0;
    },
    async order(shop, ids) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const [i, id] of ids.entries()) {
          await client.query('UPDATE demo_pieces SET position = $3 WHERE shop = $1 AND id = $2', [shop, id, i]);
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    },
    async addPhoto(shop, id, mime, bytes) {
      await pool.query('INSERT INTO demo_photos (id, shop, mime, bytes) VALUES ($1, $2, $3, $4)', [id, shop, mime, bytes]);
    },
    async getPhoto(shop, id) {
      const r = await pool.query('SELECT mime, bytes FROM demo_photos WHERE shop = $1 AND id = $2', [shop, id]);
      return r.rows[0] || null;
    },
    // Remove uploaded photos no piece uses any more (left behind by edits and deletes).
    // Photos uploaded in the last hour are kept: a piece being written may not be saved yet.
    async prunePhotos(shop, keep) {
      await pool.query(
        `DELETE FROM demo_photos WHERE shop = $1 AND NOT (id = ANY($2::text[]))
         AND created_at < now() - interval '1 hour'`, [shop, [...keep]]);
    },
  };
}

export function makeDemoMemoryStore() {
  const seededShops = new Set();
  const pieces = new Map(); // shop -> Map(id -> piece)
  const photos = new Map(); // id -> { shop, mime, bytes, at }
  const of = (shop) => { if (!pieces.has(shop)) pieces.set(shop, new Map()); return pieces.get(shop); };
  const sorted = (shop) => [...of(shop).values()].sort((a, b) => a.position - b.position);
  return {
    async seeded(shop) { return seededShops.has(shop); },
    async seed(shop, list) {
      if (seededShops.has(shop)) return;
      seededShops.add(shop);
      list.forEach((p, i) => of(shop).set(p.id, { ...p, position: i, updatedAt: new Date().toISOString() }));
    },
    async list(shop) { return sorted(shop).map((p) => ({ ...p })); },
    async count(shop) { return of(shop).size; },
    async insert(shop, id, data) {
      const first = sorted(shop)[0];
      const p = { ...data, id, position: first ? first.position - 1 : 0, updatedAt: new Date().toISOString() };
      of(shop).set(id, p);
      return { ...p };
    },
    async update(shop, id, data) {
      const old = of(shop).get(id);
      if (!old) return null;
      const p = { ...data, id, position: old.position, updatedAt: new Date().toISOString() };
      of(shop).set(id, p);
      return { ...p };
    },
    async remove(shop, id) { return of(shop).delete(id); },
    async order(shop, ids) { ids.forEach((id, i) => { const p = of(shop).get(id); if (p) p.position = i; }); },
    async addPhoto(shop, id, mime, bytes) { photos.set(id, { shop, mime, bytes, at: Date.now() }); },
    async getPhoto(shop, id) { const p = photos.get(id); return p && p.shop === shop ? p : null; },
    async prunePhotos(shop, keep) {
      for (const [id, p] of photos) if (p.shop === shop && !keep.has(id) && Date.now() - p.at > 3600_000) photos.delete(id);
    },
  };
}

/* ───────────────────────── checking what the owner sends ───────────────────────── */

const text = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

function cleanPiece(shop, body) {
  const b = body && typeof body === 'object' ? body : {};
  const name = text(b.name, 120);
  if (!name) return { error: 'Give the piece a name.' };
  const category = CATEGORIES.includes(b.category) ? b.category : null;
  if (!category) return { error: 'Choose a category.' };
  let price = null;
  if (b.price !== null && b.price !== undefined && b.price !== '') {
    price = Math.round(Number(b.price));
    if (!Number.isFinite(price) || price < 0 || price > 10_000_000) return { error: 'The price should be a number of rupees.' };
  }
  const sizes = Array.isArray(b.sizes) ? SIZES.filter((s) => b.sizes.includes(s)) : [];
  const ownPhoto = new RegExp(`^/api/demo/${shop}/photos/[a-f0-9]{24}$`);
  const photos = (Array.isArray(b.photos) ? b.photos : [])
    .filter((u) => typeof u === 'string' && (ownPhoto.test(u) || /^img\/[a-z0-9-]+\.webp$/.test(u)))
    .slice(0, MAX_PHOTOS_PER_PIECE);
  return {
    data: {
      name,
      category,
      price,
      fabric: text(b.fabric, 200),
      description: text(b.description, 1200),
      sizes,
      madeToMeasure: Boolean(b.madeToMeasure),
      isNew: Boolean(b.isNew),
      hidden: Boolean(b.hidden),
      photos,
    },
  };
}

function slugId(name) {
  const base = name.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'piece';
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

function samePasscode(given, expected) {
  const a = crypto.createHash('sha256').update(String(given)).digest();
  const b = crypto.createHash('sha256').update(String(expected)).digest();
  return crypto.timingSafeEqual(a, b);
}

function photoIdsIn(pieces, shop) {
  const prefix = `/api/demo/${shop}/photos/`;
  const ids = new Set();
  for (const p of pieces) for (const u of p.photos || []) if (u.startsWith(prefix)) ids.add(u.slice(prefix.length));
  return ids;
}

/* ───────────────────────── routes ───────────────────────── */

export function mountDemo(app, { getStore, rateLimited }) {
  const router = express.Router({ mergeParams: true });

  // Only shops we know about exist; everything else is a 404.
  router.use((req, res, next) => {
    if (!SHOPS[req.params.shop]) return res.status(404).json({ error: 'No such shop.' });
    next();
  });

  async function ready(shop) {
    const store = getStore();
    if (!(await store.seeded(shop))) await store.seed(shop, SHOPS[shop].pieces);
    return store;
  }

  function signedIn(req) {
    const expected = passcodeFor(req.params.shop);
    const given = req.headers['x-demo-passcode'] || '';
    return Boolean(expected && given && samePasscode(given, expected));
  }

  function requireOwner(req, res) {
    if (!passcodeFor(req.params.shop)) {
      res.status(503).json({ error: 'The admin passcode for this shop has not been set up yet.' });
      return false;
    }
    if (!signedIn(req)) {
      res.status(401).json({ error: 'That passcode is not right.' });
      return false;
    }
    return true;
  }

  const fail = (res, what, err) => {
    console.error(`[demo] ${what} failed:`, err);
    res.status(500).json({ error: 'Something went wrong on our side. Try again in a minute.' });
  };

  router.get('/pieces', async (req, res) => {
    const { shop } = req.params;
    try {
      const store = await ready(shop);
      const owner = signedIn(req);
      const pieces = (await store.list(shop)).filter((p) => owner || !p.hidden);
      res.setHeader('Cache-Control', 'no-store');
      res.json({ ok: true, shop: SHOPS[shop].name, categories: CATEGORIES, sizes: SIZES, pieces });
    } catch (err) { fail(res, 'list', err); }
  });

  router.post('/login', (req, res) => {
    if (rateLimited(`demo-login:${req.ip}`)) return res.status(429).json({ error: 'Too many tries. Wait a minute.' });
    if (!requireOwner(req, res)) return;
    res.json({ ok: true });
  });

  router.post('/pieces', async (req, res) => {
    if (!requireOwner(req, res)) return;
    const { shop } = req.params;
    const { data, error } = cleanPiece(shop, req.body);
    if (error) return res.status(400).json({ error });
    try {
      const store = await ready(shop);
      if ((await store.count(shop)) >= MAX_PIECES) return res.status(400).json({ error: `A shop can hold ${MAX_PIECES} pieces.` });
      const piece = await store.insert(shop, slugId(data.name), data);
      console.log(`[demo] ${shop}: added ${piece.id}`);
      res.status(201).json({ ok: true, piece });
    } catch (err) { fail(res, 'add', err); }
  });

  router.put('/pieces/:id', async (req, res) => {
    if (!requireOwner(req, res)) return;
    const { shop, id } = req.params;
    const { data, error } = cleanPiece(shop, req.body);
    if (error) return res.status(400).json({ error });
    try {
      const store = await ready(shop);
      const piece = await store.update(shop, id, data);
      if (!piece) return res.status(404).json({ error: 'That piece is gone. Reload the page.' });
      await store.prunePhotos(shop, photoIdsIn(await store.list(shop), shop));
      res.json({ ok: true, piece });
    } catch (err) { fail(res, 'update', err); }
  });

  router.delete('/pieces/:id', async (req, res) => {
    if (!requireOwner(req, res)) return;
    const { shop, id } = req.params;
    try {
      const store = await ready(shop);
      const gone = await store.remove(shop, id);
      if (!gone) return res.status(404).json({ error: 'That piece is already gone.' });
      await store.prunePhotos(shop, photoIdsIn(await store.list(shop), shop));
      console.log(`[demo] ${shop}: removed ${id}`);
      res.json({ ok: true });
    } catch (err) { fail(res, 'delete', err); }
  });

  router.put('/order', async (req, res) => {
    if (!requireOwner(req, res)) return;
    const { shop } = req.params;
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter((x) => typeof x === 'string').slice(0, MAX_PIECES) : null;
    if (!ids) return res.status(400).json({ error: 'Send the pieces in their new order.' });
    try {
      const store = await ready(shop);
      await store.order(shop, ids);
      res.json({ ok: true });
    } catch (err) { fail(res, 'order', err); }
  });

  router.post('/photos',
    express.raw({ type: Object.keys(PHOTO_TYPES), limit: MAX_PHOTO_BYTES }),
    async (req, res) => {
      if (!requireOwner(req, res)) return;
      const { shop } = req.params;
      const mime = (req.headers['content-type'] || '').split(';')[0].trim();
      const bytes = req.body;
      if (!PHOTO_TYPES[mime] || !Buffer.isBuffer(bytes) || bytes.length < 100) {
        return res.status(400).json({ error: 'Send a JPEG, PNG or WebP photo.' });
      }
      if (bytes.subarray(0, PHOTO_TYPES[mime].length).toString('latin1') !== PHOTO_TYPES[mime]) {
        return res.status(400).json({ error: 'That file is not the kind of photo it says it is.' });
      }
      try {
        const id = crypto.randomBytes(12).toString('hex');
        await getStore().addPhoto(shop, id, mime, bytes);
        res.status(201).json({ ok: true, url: `/api/demo/${shop}/photos/${id}` });
      } catch (err) { fail(res, 'upload', err); }
    });

  router.get('/photos/:id', async (req, res) => {
    const { shop, id } = req.params;
    if (!/^[a-f0-9]{24}$/.test(id)) return res.sendStatus(404);
    try {
      const photo = await getStore().getPhoto(shop, id);
      if (!photo) return res.sendStatus(404);
      res.setHeader('Content-Type', photo.mime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(photo.bytes);
    } catch (err) { fail(res, 'photo', err); }
  });

  // An upload over the size limit arrives here as a 413 from express.raw.
  router.use((err, _req, res, next) => {
    if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'That photo is too large.' });
    next(err);
  });

  app.use('/api/demo/:shop', router);
}
