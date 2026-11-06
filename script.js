// The Bare Necessities — Shonku. Light interactions, no dependencies.
document.documentElement.classList.add('js');

// footer year
document.getElementById('year').textContent = new Date().getFullYear();

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ───────────────────── the bars: top on a laptop, bottom on a phone ───────────────────── */
const nav = document.getElementById('nav');
const tabs = [...document.querySelectorAll('#tabbar a')];
// each section names the tab it belongs to: the features after "Try it" still count as Shonku
const tabSections = [...document.querySelectorAll('section[data-tab]')];
let ticking = false;
const update = () => {
  ticking = false;
  // laptop: the top bar shrinks onto glass once the page moves
  nav.classList.toggle('scrolled', window.scrollY > 24);
  // phone: the tab for the section you're in is lit, like a phone app's tab bar
  const line = window.innerHeight * 0.4;
  let current = 'top';
  tabSections.forEach((el) => { if (el.getBoundingClientRect().top <= line) current = el.dataset.tab; });
  tabs.forEach((a) => {
    if (a.hash === '#' + current) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
};
const onScroll = () => { if (!ticking){ ticking = true; requestAnimationFrame(update); } };
update();
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onScroll, { passive: true });

/* ───────────────────── scroll reveals ───────────────────── */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  });
}, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

/* ───────────────────── the Professor, in dots ─────────────────────
   The line portrait, redrawn as a field of square dots: a lit beard, a dimmer head, dark eyes
   inside bright spectacles. The dots shimmer, and swell near the pointer. */
const canvas = document.getElementById('dots');
if (canvas && canvas.getContext){
  document.documentElement.classList.add('js-dots');
  const ctx = canvas.getContext('2d');
  // shapes in the portrait's own 400 × 480 drawing, with how bright each one is
  const P = (d) => new Path2D(d);
  const HEAD  = P('M128,214 L126,196 C120,132 160,96 200,96 C240,96 280,132 274,196 L272,214 Z');
  const BEARD = P('M128,212 C121,250 125,290 137,322 C129,348 139,372 145,394 C141,418 157,438 171,450 C180,462 191,471 200,476 C209,471 220,462 229,450 C243,438 259,418 255,394 C261,372 271,348 263,322 C275,290 279,250 272,212 Z');
  const COAT  = P('M70,480 C80,420 112,392 150,382 L250,382 C288,392 320,420 330,480 Z');
  const EARS  = P('M126,196 C112,192 110,214 124,220 Z M274,196 C288,192 290,214 276,220 Z');
  const MOUSTACHE = P('M200,244 C182,236 160,236 150,250 C158,252 168,252 178,250 C186,254 194,254 200,250 C206,254 214,254 222,250 C232,252 242,252 250,250 C240,236 218,236 200,244 Z');
  const STRANDS = ['M150,262 C146,292 150,318 160,340','M250,262 C254,292 250,318 240,340','M160,282 C155,320 160,360 171,398','M240,282 C245,320 240,360 229,398','M174,280 C170,326 174,374 184,426','M226,280 C230,326 226,374 216,426','M188,280 C186,336 189,396 195,452','M212,280 C214,336 211,396 205,452','M200,284 C201,340 200,400 200,462'].map(P);

  // paint the portrait once, small, into an offscreen canvas: its pixels become the dots
  const COLS = 72, ROWS = Math.round(COLS * 480 / 400);
  const src = document.createElement('canvas'); src.width = COLS; src.height = ROWS;
  const s = src.getContext('2d');
  s.scale(COLS / 400, ROWS / 480);
  const fill = (path, v) => { s.fillStyle = `rgb(${v},${v},${v})`; s.fill(path); };
  const line = (path, v, w) => { s.strokeStyle = `rgb(${v},${v},${v})`; s.lineWidth = w; s.lineCap = 'round'; s.stroke(path); };
  fill(COAT, 46);
  fill(HEAD, 92); fill(EARS, 80);
  fill(BEARD, 205);
  STRANDS.forEach((p) => line(p, 120, 5));
  fill(MOUSTACHE, 28);
  line(P('M200,196 C198,212 194,226 190,232 C194,238 206,238 210,232 C206,226 202,212 200,196'), 70, 6); // nose
  // the lenses catch the light
  s.fillStyle = 'rgb(140,140,140)'; s.beginPath(); s.arc(166, 190, 24, 0, Math.PI * 2); s.arc(234, 190, 24, 0, Math.PI * 2); s.fill();
  const SPECS = new Path2D(); SPECS.arc(166, 190, 26, 0, Math.PI * 2); SPECS.moveTo(260, 190); SPECS.arc(234, 190, 26, 0, Math.PI * 2);
  line(SPECS, 255, 11);
  line(P('M192,188 C198,182 202,182 208,188'), 255, 8);
  s.fillStyle = '#000'; s.beginPath(); s.arc(166, 192, 5, 0, Math.PI * 2); s.arc(234, 192, 5, 0, Math.PI * 2); s.fill(); // eyes
  const px = s.getImageData(0, 0, COLS, ROWS).data;
  const cells = [];
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++){
    const i = (y * COLS + x) * 4, a = px[i + 3] / 255;
    const v = (px[i] / 255) * a;
    // the empty room around him keeps a faint dust of dots, fading out towards the edges
    const d = Math.hypot((x - COLS / 2) / (COLS / 2), (y - ROWS * .52) / (ROWS / 2));
    const dust = Math.max(0, 1 - d) ** 1.6 * 0.06;
    cells.push({ x, y, v: a > 0.05 ? Math.max(v, 0.08) : dust, inside: a > 0.05, seed: Math.random() * 6.283 });
  }

  let w = 0, h = 0, cell = 0, dpr = 1, pointer = null, running = false, raf = 0;
  const size = () => {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = r.width; h = r.height; cell = w / COLS;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const draw = (t) => {
    ctx.clearRect(0, 0, w, h);
    const gap = Math.max(1, cell * 0.16);
    for (const c of cells){
      let v = c.v;
      if (c.inside && !reduce) v *= 0.82 + 0.18 * Math.sin(t / 900 + c.seed);   // the shimmer
      let grow = 0;
      if (pointer && !reduce){
        const dx = (c.x + .5) * cell - pointer.x, dy = (c.y + .5) * cell - pointer.y;
        const near = Math.max(0, 1 - Math.hypot(dx, dy) / (cell * 9));
        v = Math.min(1, v + near * (c.inside ? 0.45 : 0.18)); grow = near * gap * 0.9;
      }
      if (v < 0.012) continue;
      const l = Math.round(24 + Math.pow(v, 1.25) * 222);
      ctx.fillStyle = `rgb(${l},${l - 4},${l - 10})`;
      const sz = cell - gap + grow;
      ctx.fillRect(c.x * cell + (cell - sz) / 2, c.y * cell + (cell - sz) / 2, sz, sz);
    }
  };
  const loop = (t) => { draw(t); if (running) raf = requestAnimationFrame(loop); };
  const start = () => { if (!running && !reduce){ running = true; raf = requestAnimationFrame(loop); } };
  const stop = () => { running = false; cancelAnimationFrame(raf); };

  size(); draw(0);
  window.addEventListener('resize', () => { size(); draw(performance.now()); }, { passive: true });
  // only animate while he's on screen
  new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop())).observe(canvas);
  const hero = document.querySelector('.hero');
  hero.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    pointer = { x: e.clientX - r.left, y: e.clientY - r.top };
    if (reduce) draw(0);
  });
  hero.addEventListener('pointerleave', () => { pointer = null; if (reduce) draw(0); });
}

/* ───────────────────── the live conversation ───────────────────── */
const thread = document.getElementById('thread');
const chips  = document.getElementById('chips');

// Shonku's replies — dry, precise, plainly helpful.
const SCRIPT = {
  order: [
    "Three things worth your attention:",
    "• 9:30, standup\n• 1:00, lunch with Anil at Soi 7\n• the lease email from Priya, still unanswered\n\nThe afternoon's clear. I'd keep it that way."
  ],
  remind: [
    "Done. Today at 6:00 PM. I'll nudge you.",
    "<reminder>Reminder set · Call Ma · Today, 18:00</reminder>"
  ],
  email: [
    "Two, really:",
    "• Priya needs the signed lease by Thursday\n• your card statement is due Friday\n\nThe rest is newsletters. Want a line to Priya you can paste?"
  ],
  book: [
    "Where to, and for how many?",
    "If it's Soi 7 for two, I can hold 8:00 PM. I'll just need you to confirm on their page when it asks. Shall I start?"
  ]
};

const pad = (n) => String(n).padStart(2, '0');
const clock = () => { const d = new Date(); return d.getHours() + ':' + pad(d.getMinutes()); };
const TICKS = '<svg class="ticks" viewBox="0 0 18 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M1 6l3.2 3.4L9.6 3"/><path d="M8 9.4L13.4 3"/></svg>';

function metaHTML(out){
  return '<span class="meta"><span class="t">' + clock() + '</span>' + (out ? TICKS : '') + '</span>';
}
function rowOut(text){
  const r = document.createElement('div');
  r.className = 'tg-row out';
  const b = document.createElement('div'); b.className = 'bubble';
  b.textContent = text;
  b.insertAdjacentHTML('beforeend', metaHTML(true));
  r.appendChild(b); return r;
}
function rowIn(text){
  const m = /^<reminder>([\s\S]*)<\/reminder>$/.exec(text);
  if (m){
    const s = document.createElement('div');
    s.className = 'tg-service';
    s.textContent = m[1];
    return s;
  }
  const r = document.createElement('div');
  r.className = 'tg-row in';
  const b = document.createElement('div'); b.className = 'bubble';
  b.innerHTML = text.replace(/\n/g, '<br>') + metaHTML(false);
  r.appendChild(b); return r;
}
function typing(){
  const r = document.createElement('div');
  r.className = 'tg-row in tg-typing';
  const b = document.createElement('div'); b.className = 'bubble'; b.textContent = 'typing…';
  r.appendChild(b); return r;
}
const toBottom = () => { thread.scrollTop = thread.scrollHeight; };
const wait = (ms) => new Promise(r => setTimeout(r, reduce ? 0 : ms));

let busy = false;
async function ask(btn){
  if (busy) return; busy = true;
  // a disabled button drops keyboard focus, so hand it to the next question first
  if (btn === document.activeElement){
    const all = [...chips.querySelectorAll('.chip')];
    const i = all.indexOf(btn);
    const next = [...all.slice(i + 1), ...all.slice(0, i)].find(c => !c.disabled);
    (next || thread).focus();
  }
  btn.disabled = true;
  thread.appendChild(rowOut(btn.textContent)); toBottom();
  const lines = SCRIPT[btn.dataset.q] || ["One moment."];
  for (let i = 0; i < lines.length; i++){
    const t = typing(); thread.appendChild(t); toBottom();
    await wait(700 + lines[i].length * 9);
    t.remove();
    thread.appendChild(rowIn(lines[i])); toBottom();
    await wait(260);
  }
  busy = false;
  if ([...chips.querySelectorAll('.chip')].every(c => c.disabled)){
    await wait(400);
    thread.appendChild(rowIn("That's the lot for now. The rest reaches me on Telegram."));
    toBottom();
  }
}

if (chips){
  chips.addEventListener('click', (e) => {
    const btn = e.target.closest('.chip');
    if (btn && !btn.disabled) ask(btn);
  });
}

/* ───────────────────── the two forms: a seat on the waitlist, and a project brief ───────────────────── */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Sends a form's fields to the backend and says how it went. `check` returns
// [problem, field] for the first thing that's wrong, or nothing.
function wire(form, path, check, success){
  if (!form) return;
  const msg = form.querySelector('.form-msg');
  const btn = form.querySelector('button[type=submit]');
  const say = (text, kind) => { msg.textContent = text; msg.className = 'form-msg ' + kind; };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    const data = Object.fromEntries(new FormData(form));
    for (const k in data) data[k] = String(data[k]).trim();
    // honeypot; bots fill it. Not called "company": phone autofill fills that.
    data.nb_trap = form.elements['nb_trap'].value;

    const problem = check(data);
    if (problem){
      const [text, field] = problem;
      say(text, 'err');
      form.elements[field].setAttribute('aria-invalid', 'true');
      form.elements[field].focus();
      return;
    }

    // read the API base at submit time, so late/host config is honoured
    const endpoint = (form.dataset.api || '').replace(/\/+$/, '') + path;
    const label = btn.textContent;
    btn.disabled = true; btn.textContent = 'Sending…';
    try{
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const out = await res.json().catch(() => ({}));
      if (res.ok){
        form.reset();
        say(success(out), 'ok');
      } else if (res.status === 429){
        say('One moment — too many tries. Please wait a little.', 'err');
      } else {
        say((out && out.error) || 'Something went wrong. Please use the email link instead.', 'err');
      }
    } catch(err){
      say('Could not reach us just now. Please use the email link instead.', 'err');
    } finally {
      btn.disabled = false; btn.textContent = label;
    }
  });
}

wire(document.getElementById('waitlist'), '/api/waitlist',
  (d) => (!EMAIL.test(d.email) ? ['A valid email, please.', 'email'] : null),
  (out) => out.already
    ? "You're already on the list — the Professor has you noted."
    : "You're on the list. Shonku will write the moment a seat opens.");

wire(document.getElementById('project'), '/api/projects',
  (d) => {
    if (!EMAIL.test(d.email)) return ['A valid email, please, so we can reply.', 'email'];
    if (d.project.length < 10) return ['Tell us a little about it: a sentence or two is plenty.', 'project'];
    if (d.link && !/^https?:\/\/\S+\.\S+/.test(d.link)) return ['That link should start with https://', 'link'];
    return null;
  },
  () => "Thank you. Your brief is with us, and we'll reply by email.");
