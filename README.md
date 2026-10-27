# The Bare Necessities — portfolio site

A static, single-page site for **The Bare Necessities**, a Delta S Labs brand
that builds small, specialized apps (a "cocktail bar, not a chain"). Its first
app is **Shonku** — an invite-only personal agent you reach on Telegram, named
after Satyajit Ray's Professor Shonku.

The page leads with the brand (a cocktail bar, not a chain; the capped guest
list), then pours its first app, Shonku.

Design direction: an old-world printed annual with a modern layer on top. STIX
Two Text for reading, Instrument Sans for interface labels, a Bengali-print
palette of bone paper, sepia ink, post red and slate blue, and public-domain
archival plates (an orrery, celestial charts, a brass astrolabe, a 1689 world
map). The modern layer: a floating glass nav that narrows on scroll (and a
full-screen glass menu on phones), glass chips over the hero photograph, a
ticker, bento tiles, a live orrery around the Professor's portrait, and
scroll-driven reveals. All motion stops under `prefers-reduced-motion`.

## Structure

```
index.html          # all page content
styles.css          # design system + layout
script.js           # scroll reveals, nav state, live Telegram demo, waitlist form
public/logo.png     # the Bare Necessities mark (nav + favicon)
public/art/         # imagery: archival images, the Shonku portrait, Telegram wallpaper
public/texture-paper.jpg  # faint paper grain

server/             # the invite-waitlist backend (Node + Postgres) — see server/README.md
render.yaml         # Render blueprint: provisions the DB + the backend
```

The "Ask it" section is a working, in-page Telegram demo, styled to match a real
Telegram chat (wallpaper, bubbles with tails, read ticks, a bot reply keyboard):
tap a prompt and Shonku answers in character. The demo itself needs no backend.

The "Request an invite" form posts to the waitlist backend in `server/`. Set the
form's `data-api` attribute (in `index.html`) to your deployed service URL. See
[`server/README.md`](server/README.md) for deploy and persistence notes.

## Run locally

Any static server works. For example:

```bash
python3 -m http.server 8722
```

Then open http://localhost:8722.

## Deploy

It's fully static — drag the folder onto Netlify, or point Vercel /
GitHub Pages / Cloudflare Pages at this repo. No build step, no dependencies.
Fonts load from Google Fonts; everything else is local.

## Notes

- The featured app is **Shonku** (Telegram, invite-only). Capabilities shown
  match the project: memory, morning briefing, Gmail/Calendar (read-only), its
  own browser + computer, a sealed credential vault, voice both ways, and the
  ChakraMCP agent network.
- Contact email used on the page: `kaustav@banerjee.life`. Owner site: `banerjee.life`.
  Update these in `index.html` if either is different.
- All page imagery is public domain; credits are in the footer and in
  `public/art/credits.json`.
- Sample content in the demo (names, times, the briefing) is illustrative —
  swap before launch if you want different examples.
