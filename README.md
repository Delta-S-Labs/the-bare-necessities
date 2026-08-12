# The Bare Necessities — portfolio site

A static, single-page portfolio for **The Bare Necessities**, a Delta S Labs brand
that builds small, specialized apps (a "cocktail bar, not a chain"). Its first
app is **Baloo**, an AI food concierge.

Design language is pulled straight from the Baloo app: forest green, cream,
warm sand, mint, amber — a Jungle Book nature palette. Editorial serif
(Fraunces) over Inter, with a grain texture, fireflies, and a marquee.

## Structure

```
index.html          # all page content
styles.css          # design system + layout
script.js           # scroll reveals, nav state, cap-meter fill
favicon.svg         # the bear mark
public/screens/     # Baloo app screenshots (demo account)
public/texture-*.jpg # washi paper (page ground), green watercolor
                     #  (dark panels + footer), sage botanical (contact)
```

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

- App name is **Baloo** (matching the screenshots), the Jungle Book bear.
- Contact email used on the page: `kaustav@banerjee.life`. Owner site: `banerjee.life`.
  Update these in `index.html` if either is different.
- The unreleased **Circle** (friend-agents) feature is described as "rolling out."
