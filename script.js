// The Bare Necessities — Shonku. Light interactions, no dependencies.
document.documentElement.classList.add('js');

// footer year
document.getElementById('year').textContent = new Date().getFullYear();

// glass nav: shrinks once you scroll, turns dark-glass over the hero photograph
const nav  = document.getElementById('nav');
const hero = document.querySelector('.hero');
// the hero's height is measured on resize only, and class changes wait for a frame
let heroH = 0, ticking = false;
const measure = () => { heroH = hero ? hero.offsetHeight : 0; };
const update = () => {
  ticking = false;
  const y = window.scrollY;
  nav.classList.toggle('scrolled', y > 40);
  nav.classList.toggle('on-dark', !!hero && y < heroH - 72);
};
const onScroll = () => { if (!ticking){ ticking = true; requestAnimationFrame(update); } };
measure(); update();
window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => { measure(); onScroll(); }, { passive: true });

// hero photograph settles slowly, once laid out
if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('lit')));

// small-screen menu
const toggle = document.querySelector('.nav-toggle');
const menu   = document.getElementById('menu');
// while it's open, the page behind it can't be reached by Tab or a screen reader
const behindMenu = () => document.querySelectorAll('body > :not(header):not(#menu):not(script)');
function setMenu(open, returnFocus){
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('menu-open', open);
  nav.classList.toggle('menu-on', open);
  behindMenu().forEach((el) => { el.inert = open; });
  if (open){
    menu.hidden = false;
    requestAnimationFrame(() => menu.classList.add('open'));
    menu.querySelector('a').focus();
  } else {
    menu.classList.remove('open');
    setTimeout(() => { if (toggle.getAttribute('aria-expanded') === 'false') menu.hidden = true; }, 350);
    if (returnFocus) toggle.focus();
  }
}
if (toggle && menu){
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true', true));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) setMenu(false, true); });
  window.matchMedia('(min-width: 921px)').addEventListener('change', (m) => { if (m.matches) setMenu(false); });
}

// the ticker can be paused
const ticker = document.querySelector('.ticker');
const tickerBtn = ticker && ticker.querySelector('.ticker-toggle');
if (tickerBtn){
  tickerBtn.addEventListener('click', () => {
    const paused = ticker.classList.toggle('paused');
    tickerBtn.setAttribute('aria-pressed', String(paused));
  });
}

// scroll reveals (+ staggered groups)
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (!e.isIntersecting) return;
    e.target.classList.add('in');
    io.unobserve(e.target);
  });
}, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal, .stagger').forEach((el) => io.observe(el));

/* ───────────────────── the live conversation ───────────────────── */
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

/* ───────────────────── the invite waitlist ───────────────────── */
const wlForm = document.getElementById('waitlist');
if (wlForm){
  const wlMsg = document.getElementById('wl-msg');
  const wlBtn = wlForm.querySelector('.wl-submit');
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  wlForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    wlMsg.className = 'wl-msg';
    // read the API base at submit time, so late/host config is honoured
    const endpoint = (wlForm.dataset.api || '').replace(/\/+$/, '') + '/api/waitlist';
    const email   = wlForm.elements['email'].value.trim();
    const name    = wlForm.elements['name'].value.trim();
    // honeypot; bots fill it. Not called "company": phone autofill fills that.
    const trap    = wlForm.elements['nb_trap'].value;

    if (!EMAIL.test(email)){
      wlMsg.textContent = 'A valid email, please.';
      wlMsg.classList.add('err');
      wlForm.elements['email'].focus();
      return;
    }

    const label = wlBtn.textContent;
    wlBtn.disabled = true; wlBtn.textContent = 'Sending…';
    try{
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, nb_trap: trap })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok){
        wlForm.reset();
        wlMsg.textContent = data.already
          ? "You're already on the list — the Professor has you noted."
          : "You're on the list. Shonku will write the moment a seat opens.";
        wlMsg.classList.add('ok');
      } else if (res.status === 429){
        wlMsg.textContent = 'One moment — too many tries. Please wait a little.';
        wlMsg.classList.add('err');
      } else {
        wlMsg.textContent = (data && data.error) || 'Something went wrong. Please use the email link below.';
        wlMsg.classList.add('err');
      }
    } catch(err){
      wlMsg.textContent = 'Could not reach the waitlist. Please use the email link below.';
      wlMsg.classList.add('err');
    } finally {
      wlBtn.disabled = false; wlBtn.textContent = label;
    }
  });
}
