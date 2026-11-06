// The Bare Necessities: three silent loops for the site, drawn on a wall of square dots (loops.board).
// Each is periodic in its own length, so the last frame runs straight back into the first.
//   raea render edit.tsx --composition hero -o out/hero.mp4
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame, useVideoConfig } from "raea";
import { Dots, Lit, TAU, clamp01, hash, segDist, smooth } from "./components/dots";
import { css } from "./styles.gen";

const FPS = 30;

/** the loop's phase, 0..1, for this frame */
function usePhase() {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (f % durationInFrames) / durationInFrames;
}

function Wall({ cell, sample }: { cell: number; sample: (x: number, y: number) => Lit }) {
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill style={{ background: "var(--brand-background)" }}>
      <style>{css}</style>
      <Dots width={width} height={height} cell={cell} sample={sample} />
    </AbsoluteFill>
  );
}

/* ───────── 1. hero: sushi on the counter, and a cocktail being poured ───────── */

const HERO_W = 1920, HERO_H = 1008, HERO_A = HERO_W / HERO_H, HERO_T = 12;
const TOP = 0.66;                       // the counter's top edge
const G0 = 0.665 * HERO_A;              // where the coupe stands for the pour
const BOTTLES = [0.08, 0.15, 0.21, 0.30, 0.37, 0.52, 0.60, 0.69, 0.78, 0.86, 0.93].map((x, i) => ({
  x: x * HERO_A, h: 0.12 + 0.07 * hash(i, 3), w: 0.024 + 0.012 * hash(i, 7), v: 0.07 + 0.06 * hash(i, 11),
}));

/** the coupe at gx, filled to `fill` (0..1): glass edges in ink, the drink in amber */
function coupe(X: number, Y: number, gx: number, fill: number): Lit | null {
  const cy = 0.40, rx = 0.125, ry = 0.13, bottom = cy + ry;
  if (Math.abs(X - gx) < 0.065 && Y > TOP - 0.014 && Y <= TOP) return { v: 0.7 };            // foot
  if (Math.abs(X - gx) < 0.009 && Y > bottom - 0.004 && Y <= TOP - 0.014) return { v: 0.6 };  // stem
  if (Y < cy - 0.0055) return null;
  const e = Math.hypot((X - gx) / rx, (Y - cy) / ry);
  if (Math.abs(Y - cy) < 0.0055 && Math.abs(X - gx) < rx) return { v: 0.55 };                 // rim
  if (Math.abs(e - 1) * ry < 0.0065) return { v: 0.85 };                                     // the bowl's edge
  const level = bottom - fill * ry * 0.92;
  if (e < 1 && Y > level) {
    if (Y - level < 0.008) return { v: 1, warm: 1 };                                         // the surface
    return { v: 0.8, warm: 1 };
  }
  return null;
}

function Hero() {
  const p = usePhase(), a = p * TAU, t = p * HERO_T;
  const camX = 0.012 * Math.cos(a), camY = 0.006 * Math.sin(a);

  // the pour: in, pour, stop, away; then the full glass is served and a fresh one slides in
  const tipIn = smooth(0, 1.1, t), away = smooth(7.2, 8.4, t);
  const fill = smooth(1.2, 6.8, t);
  const pouring = t > 1.1 && t < 7.4;
  const stop = smooth(6.6, 7.3, t);                       // the stream's top end falls away as it stops
  const served = t < 10.8;
  const gx = served ? G0 + (HERO_A + 0.3 - G0) * smooth(9.5, 10.8, t) : HERO_A + 0.3 + (G0 - HERO_A - 0.3) * smooth(10.8, 12, t);
  const glassFill = served ? fill : 0;
  // the shaker: its mouth swings in over the glass, tipped to pour, then lifts away
  const mx = G0 + 0.035 + 0.5 * (1 - tipIn) + 0.5 * away, my = 0.17 - 0.32 * (1 - tipIn) - 0.4 * away;
  const ang = (-80 + 45 * tipIn - 45 * away) * Math.PI / 180;   // the direction from mouth to base
  const dx = Math.cos(ang), dy = Math.sin(ang);

  const sample = (fx: number, fy: number): Lit => {
    // framed medium-close on the counter: the sushi on the left, the glass on the right, the back bar above
    const sx = 0.43 + (fx - 0.5) / 1.45, sy = 0.375 + (fy - 0.5) / 1.45;
    const X = sx * HERO_A + camX, Y = sy + camY;
    // the light: a pendant above the pour, out of frame
    const light = Math.exp(-Math.hypot(X - 0.58 * HERO_A, (Y + 0.15) * 1.3) / 0.75);

    // the stream, falling from the shaker's mouth to the drink
    const level = 0.40 + 0.13 - glassFill * 0.13 * 0.92;
    if (pouring) {
      const top = my + (level - my) * stop;
      const wob = Math.sin(Y * 55 - t * 18) * 0.0015;
      if (Y > top && Y < level && Math.abs(X - (mx + wob)) < 0.0085) return { v: 1, warm: 1 };
    }
    // the shaker tin, tapered, with a bright band down its middle
    const rx = X - mx, ry = Y - my;
    const u = rx * dx + ry * dy, w = -rx * dy + ry * dx;
    if (u > 0 && u < 0.3) {
      const half = 0.026 + 0.012 * (u / 0.3);
      if (Math.abs(w) < half) return { v: (0.45 + 0.45 * (1 - Math.abs(w) / half)) * (0.5 + 0.5 * light) };
    }
    const glass = coupe(X, Y, gx, glassFill);
    if (glass) return glass;

    // sushi on its board
    const B = (n: number) => n * HERO_A;
    if (X > B(0.085) && X < B(0.5)) {
      // nigiri: white rice, and a slice draped over it (salmon striped with fat, tuna dark), a dark seam between
      const lit = 0.65 + 0.35 * light;
      const nigiri = [{ x: B(0.13), salmon: true }, { x: B(0.205), salmon: false }, { x: B(0.28), salmon: true }];
      for (const n of nigiri) {
        const fishE = Math.hypot((X - n.x) / 0.066, (Y - 0.548) / 0.024);
        if (fishE < 1 && Y < 0.561) {
          const fat = ((X * 0.8 - Y * 1.6) * 34 % 1 + 1) % 1 < 0.32;
          return { v: (n.salmon ? (fat ? 0.95 : 0.5) : (fat ? 0.42 : 0.3)) * lit };
        }
        const riceE = Math.hypot((X - n.x) / 0.058, (Y - 0.58) / 0.024);
        if (riceE < 1 && Y > 0.566 && Y < 0.6) return { v: (0.78 + 0.22 * hash(Math.floor(fx * 160), Math.floor(fy * 84))) * lit };
      }
      // maki, cut face on: a dark ring of nori, white rice, a bright filling
      for (const mx2 of [B(0.36), B(0.415), B(0.47)]) {
        const d = Math.hypot(X - mx2, Y - 0.557);
        if (d < 0.043) return { v: (d > 0.035 ? 0.16 : d > 0.014 ? 0.82 + 0.18 * hash(Math.floor(fx * 160), Math.floor(fy * 84)) : 0.55) * lit };
      }
      // the board: a low wooden geta with its grain
      if (Y > 0.6 && Y < 0.642) return { v: (0.28 + (((Y * 260) % 1) < 0.25 ? 0.08 : 0)) * (0.55 + 0.45 * light) };
      if (Y >= 0.642 && Y < TOP && ((X > B(0.1) && X < B(0.125)) || (X > B(0.46) && X < B(0.485)))) return { v: 0.18 };
    }
    // a small dish of soy beside the board
    if (Math.hypot((X - 0.545 * HERO_A) / 0.05, (Y - 0.651) / 0.011) < 1) return { v: Y < 0.65 ? 0.1 : 0.45 };

    // the counter: its edge catching the light, a dark front below
    if (Y > TOP && Y < TOP + 0.014) return { v: 0.3 + 0.5 * light };
    if (Y >= TOP + 0.014) return { v: 0.045 + (Math.abs(((X * 3) % 1) - 0.5) > 0.49 ? 0.04 : 0) };

    // the back bar: a shelf of bottles in the dark, drifting a little less than the counter
    const BX = X - camX * 0.4;
    if (Math.abs(Y - 0.37) < 0.006) return { v: 0.12 };
    for (const b of BOTTLES) {
      const body = Math.abs(BX - b.x) < b.w && Y > 0.37 - b.h && Y < 0.364;
      const neck = Math.abs(BX - b.x) < b.w * 0.35 && Y > 0.37 - b.h - 0.05 && Y <= 0.37 - b.h;
      if (body || neck) return { v: b.v + (Math.abs(BX - b.x + b.w * 0.5) < 0.005 ? 0.08 : 0) };
    }
    return { v: 0 };
  };
  return <Wall cell={12} sample={sample} />;
}

/* ───────── 2. agents: friends' agents find each other and agree on one dinner spot ───────── */

const AG_W = 1440, AG_H = 1080, AG_A = AG_W / AG_H, AG_T = 10;
const FRIENDS = [[0.22, 0.27], [0.80, 0.21], [0.17, 0.77], [0.77, 0.80]].map(([x, y]) => [x * AG_A, y]);
const SPOT = [0.53 * AG_A, 0.55];
const PAIRS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];

function Agents() {
  const p = usePhase(), a = p * TAU, t = p * AG_T;
  const camX = 0.006 * Math.cos(a), camY = 0.006 * Math.sin(a);
  const talk = smooth(3.0, 4.4, t) * (1 - smooth(5.0, 6.0, t));      // the friends' agents compare notes
  const agree = smooth(5.0, 6.3, t) * (1 - smooth(8.0, 9.4, t));     // lines close on one place
  const spot = smooth(6.0, 6.8, t) * (1 - smooth(8.6, 9.8, t));      // the place lights: dinner, settled

  const sample = (sx: number, sy: number): Lit => {
    const X = sx * AG_A + camX, Y = sy + camY;
    let v = 0, warm = 0;

    // the city at night: a faint grid of streets and blocks
    const gx = Math.abs(((X * 9.5) % 1) - 0.5), gy = Math.abs(((Y * 9.5 + 0.3) % 1) - 0.5);
    if (gx > 0.46 || gy > 0.46) v = 0.07;
    else if (hash(Math.floor(X * 38), Math.floor(Y * 38)) > 0.82) v = 0.045;

    // lines between the friends' agents, with small messages travelling along them
    PAIRS.forEach(([i, j], k) => {
      const [ax, ay] = FRIENDS[i], [bx, by] = FRIENDS[j];
      const grow = smooth(3.0 + 0.18 * k, 4.2 + 0.18 * k, t);
      if (talk <= 0 || grow <= 0) return;
      const ex = ax + (bx - ax) * grow, ey = ay + (by - ay) * grow;
      if (segDist(X, Y, ax, ay, ex, ey) < 0.0075) v = Math.max(v, 0.42 * talk);
      const m = ((t * 0.45 + k * 0.37) % 1);
      const mx = ax + (bx - ax) * m, my = ay + (by - ay) * m;
      if (m < grow && Math.hypot(X - mx, Y - my) < 0.014) v = Math.max(v, 0.95 * talk);
    });
    // then every line turns toward one place
    FRIENDS.forEach(([ax, ay], k) => {
      const grow = smooth(5.0 + 0.12 * k, 6.1 + 0.12 * k, t);
      if (agree <= 0 || grow <= 0) return;
      const ex = ax + (SPOT[0] - ax) * grow, ey = ay + (SPOT[1] - ay) * grow;
      if (segDist(X, Y, ax, ay, ex, ey) < 0.009) v = Math.max(v, 0.75 * agree);
    });

    // the friends' agents: steady dots with a ring breathing out from each
    FRIENDS.forEach(([ax, ay], k) => {
      const d = Math.hypot(X - ax, Y - ay);
      if (d < 0.024) v = Math.max(v, 0.92);
      const ring = ((t / 2.5 + k * 0.25) % 1);
      const rr = 0.03 + 0.07 * ring;
      if (Math.abs(d - rr) < 0.0055) v = Math.max(v, 0.5 * (1 - ring));
    });

    // the place they agreed on: the only warm light
    const ds = Math.hypot(X - SPOT[0], Y - SPOT[1]);
    if (spot > 0) {
      if (ds < 0.034 * spot) { v = 1; warm = 1; }
      else if (Math.abs(ds - (0.05 + 0.05 * spot)) < 0.006) v = Math.max(v, 0.6 * spot);
    }
    return { v, warm };
  };
  return <Wall cell={12} sample={sample} />;
}

/* ───────── 3. stools: the room fills to its cap, then a calm queue ───────── */

const ST_W = 2400, ST_H = 600, ST_A = ST_W / ST_H, ST_T = 14;
const STOOLS = [0.40, 0.50, 0.60, 0.70, 0.80].map((x) => x * ST_A);
const QUEUE = [0.22, 0.15, 0.08].map((x) => x * ST_A);        // just inside the door, on the left
const OUT = -0.3;                                              // off the frame, through the door

type Guest = { x: number; sit: number; lamp: number; fade: number };

/** where everyone is at time t (seconds into the loop) */
function room(t: number): { guests: Guest[]; lamps: number[] } {
  const ease = (a: number, b: number) => smooth(a, b, t);
  const end = 1 - ease(12.8, 13.8);                               // the night ends; the room empties for the next
  const guests: Guest[] = [];
  const lamps = [0, 0, 0, 0, 0];
  // five guests walk in one by one and take the stools, far end first
  for (let k = 0; k < 5; k++) {
    const seat = 4 - k, t0 = 0.3 + 1.05 * k;
    let x = OUT + (STOOLS[seat] - OUT) * ease(t0, t0 + 1.3);
    let sit = ease(t0 + 1.3, t0 + 1.75);
    // the guest nearest the door gets up at ten and leaves
    if (seat === 0) {
      const up = ease(10.0, 10.4);
      sit *= 1 - up;
      x = x + (OUT - x) * ease(10.4, 11.6);
    }
    lamps[seat] = Math.max(lamps[seat], sit);
    guests.push({ x, sit, lamp: sit, fade: end });
  }
  // at the cap, three more arrive and wait by the door; the first takes the freed stool
  for (let q = 0; q < 3; q++) {
    const t0 = 6.3 + 0.95 * q;
    let x = OUT + (QUEUE[q] - OUT) * ease(t0, t0 + 1.2);
    let sit = 0;
    if (q === 0) { x = x + (STOOLS[0] - x) * ease(11.5, 12.4); sit = ease(12.4, 12.8); }
    else x = x + (QUEUE[q - 1] - x) * ease(11.7 + 0.2 * q, 12.5 + 0.2 * q);   // the rest step up
    if (q === 0) lamps[0] = Math.max(lamps[0], sit);
    guests.push({ x, sit, lamp: sit, fade: end });
  }
  return { guests, lamps: lamps.map((l) => l * end) };
}

function Stools() {
  const p = usePhase(), a = p * TAU, t = p * ST_T;
  const camX = 0.02 * Math.cos(a);
  const { guests, lamps } = room(t);

  const sample = (sx: number, sy: number): Lit => {
    const X = sx * ST_A + camX, Y = sy;
    // the hanging lamps over each stool: grey until someone sits, then warm
    for (let s = 0; s < 5; s++) {
      const lx = STOOLS[s];
      if (Math.abs(X - lx) < 0.013 && Y < 0.1) return { v: 0.16 };
      if (Math.abs(X - lx) < 0.05 - (0.16 - Y) * 0.2 && Y >= 0.1 && Y < 0.16) return lamps[s] > 0.5 ? { v: 1, warm: 1 } : { v: 0.28 + 0.4 * lamps[s] };
    }
    // the people, in front of the counter
    for (const g of guests) {
      if (g.fade <= 0.02) continue;
      const lift = 0.1 * g.sit;                                        // sitting brings them down onto the stool
      const hx = g.x, hy = 0.3 + lift, hr = 0.068;
      const lit = g.lamp > 0.5 ? 1 : 0;
      const head = Math.hypot(X - hx, Y - hy) < hr;
      const seated = g.sit > 0.5;
      const top = hy + hr * 1.3, bottom = seated ? 0.66 : 0.97;
      const halfW = 0.085 - (Y - top) * 0.02;
      const body = Y > top && Y < bottom && Math.abs(X - hx) < halfW;
      // seen side-on, facing the bar: a seated guest's thighs run forward along the seat, the shins hang down
      const thigh = seated && Y > 0.58 && Y < 0.66 && X > hx && X < hx + 0.17;
      const shin = seated && Y >= 0.66 && Y < 0.92 && X > hx + 0.12 && X < hx + 0.17;
      if (head || body || thigh || shin) return { v: (0.42 + 0.4 * lit * (head ? 1 : 0.6)) * g.fade };
    }
    // the stools: a seat and a leg each
    for (const x0 of STOOLS) {
      if (Math.abs(X - x0) < 0.075 && Y > 0.66 && Y < 0.7) return { v: 0.5 };
      if (Math.abs(X - x0) < 0.009 && Y >= 0.7 && Y < 0.95) return { v: 0.32 };
      if (Math.abs(X - x0) < 0.05 && Y >= 0.93 && Y < 0.96) return { v: 0.32 };
    }
    // the counter behind them, and the door frame on the left
    if (X > 0.33 * ST_A && X < 0.88 * ST_A && Y > 0.42 && Y < 0.46) return { v: 0.34 };
    if (X > 0.33 * ST_A && X < 0.88 * ST_A && Y >= 0.46 && Y < 0.97) return { v: 0.06 };
    if (Math.abs(X - 0.03 * ST_A) < 0.008 && Y > 0.12) return { v: 0.2 };
    if (X > 0.03 * ST_A - 0.008 && X < 0.27 * ST_A && Y > 0.12 && Y < 0.135) return { v: 0.2 };
    if (Y > 0.97) return { v: 0.12 };                                   // the floor
    return { v: 0 };
  };
  return <Wall cell={12} sample={sample} />;
}

registerRoot(() => (
  <>
    <Composition id="hero" component={Hero} width={HERO_W} height={HERO_H} fps={FPS} durationInFrames={HERO_T * FPS} />
    <Composition id="agents" component={Agents} width={AG_W} height={AG_H} fps={FPS} durationInFrames={AG_T * FPS} />
    <Composition id="stools" component={Stools} width={ST_W} height={ST_H} fps={FPS} durationInFrames={ST_T * FPS} />
  </>
));
