# Shonku waitlist — backend

A small Express + Postgres service behind the "Request an invite" form on the
site. Sign-ups are written to Postgres, which lives **outside** the web
container, so the list **persists across restarts, redeploys and scale-to-zero**.

```
server/
  index.js        # the whole service (~200 lines, 2 deps)
  package.json
  .env.example
../render.yaml     # provisions the DB + this service on Render
```

## Endpoints

| Method | Path                         | Who       | Does                                   |
|--------|------------------------------|-----------|----------------------------------------|
| POST   | `/api/waitlist`              | public    | Join the list `{ email, name? }`       |
| GET    | `/health`                    | public    | Health check                           |
| GET    | `/api/waitlist`              | admin     | JSON of all entries                    |
| GET    | `/api/waitlist/count`        | admin     | `{ count }`                            |
| GET    | `/api/waitlist/export.csv`   | admin     | CSV download                           |

Admin routes need the `ADMIN_TOKEN`, sent as `X-Admin-Token:` header or
`?token=` query. POST is rate-limited (10/min/IP), validated, de-duplicated on
email, and has a honeypot (`company`) field for bots.

## Deploy on Render (blueprint)

1. Push this repo to GitHub.
2. Render → **New +** → **Blueprint** → pick this repo. It reads
   [`../render.yaml`](../render.yaml) and creates the Postgres DB **and** this
   web service, wiring `DATABASE_URL` automatically and generating `ADMIN_TOKEN`.
3. When it's live, open the service → **Environment** and set
   `ALLOWED_ORIGINS` to your site URL(s), e.g.
   `https://thebarenecessities.app,https://www.thebarenecessities.app`.
4. Copy the service URL (e.g. `https://shonku-waitlist.onrender.com`).

### Persistence & the "free" caveat

Render's **free** Postgres is deleted after ~30 days unless upgraded (the
smallest paid tier is a few dollars/month and persists forever). For an
**always-free** database that persists indefinitely, make the DB on
**Neon** or **Supabase**, paste its connection string into `DATABASE_URL`,
set `DATABASE_SSL=true`, and drop the `databases:` block from `render.yaml`.
The server code is the same for all three.

## Wire the site

In [`../index.html`](../index.html), set the form's API base to your service URL:

```html
<form class="waitlist" id="waitlist" novalidate data-api="https://shonku-waitlist.onrender.com">
```

Leave `data-api` empty only if the API is served from the **same origin** as the
site (then the form posts to `/api/waitlist` directly).

## Run locally

```bash
cd server
cp .env.example .env    # optional
npm install
npm start               # in-memory store unless DATABASE_URL is set
```

Then point the site's `data-api` at `http://localhost:3000` and open the page.

Read the list:

```bash
curl -H "X-Admin-Token: $ADMIN_TOKEN" http://localhost:3000/api/waitlist
```
