// Rajani's Boutique — the shop page.
//
// The collection comes from the API (the owner edits it on admin/). The free
// server sleeps when nobody has called it for a while and takes up to a minute
// to wake, so the page first shows the last collection this browser saw (or
// the bundled snapshot, pieces.json) and swaps in the live one when it lands.

(() => {
  'use strict';
  document.documentElement.classList.add('js');

  const SHOP = 'rajanis-boutique';
  const WHATSAPP = '919051183849';
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const API = LOCAL ? `http://${location.hostname}:3011` : 'https://shonku-waitlist.onrender.com';
  const CACHE_KEY = `demo:${SHOP}:pieces:v1`;
  const PAGE = new URL('./', document.baseURI).href; // …/demo/rajanis-boutique/
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const $ = (s, el = document) => el.querySelector(s);
  const grid = $('#grid');
  const tabs = $('.tabs');
  const status = $('#grid-status');
  const dialog = $('#piece');

  let pieces = [];
  let categories = [];
  let current = 'All';
  let open = null; // the piece in the dialog

  const rupees = (n) => (n === null || n === undefined ? 'Price on request' : '₹' + Number(n).toLocaleString('en-IN'));
  const photoUrl = (u) => (u.startsWith('/api/') ? API + u : new URL(u, PAGE).href);
  const smallUrl = (u) => (/^img\/.+\.webp$/.test(u) ? new URL(u.replace(/\.webp$/, '-s.webp'), PAGE).href : photoUrl(u));
  const pieceLink = (p) => `${PAGE}?piece=${encodeURIComponent(p.id)}`;
  const waLink = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;

  /* ───────── the general WhatsApp links ───────── */
  const GENERAL = {
    general: "Hi Rajani's Boutique! I found you on your website and have a question.",
    fitting: "Hi Rajani's Boutique! I'd like to book a fitting to get something stitched.",
  };
  document.querySelectorAll('[data-wa]').forEach((a) => {
    const text = GENERAL[a.dataset.wa];
    if (text) a.href = waLink(text);
  });

  /* ───────── the collection ───────── */
  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids) if (k) n.append(k);
    return n;
  }

  function renderTabs() {
    const counts = new Map();
    for (const p of pieces) counts.set(p.category, (counts.get(p.category) || 0) + 1);
    const names = ['All', ...categories.filter((c) => counts.has(c))];
    if (!names.includes(current)) current = 'All';
    tabs.replaceChildren(...names.map((name) => {
      const b = el('button', {
        class: 'tab', type: 'button', role: 'tab',
        'aria-selected': String(name === current),
        tabindex: name === current ? '0' : '-1',
      }, name, el('span', { class: 'n', text: String(name === 'All' ? pieces.length : counts.get(name)) }));
      b.addEventListener('click', () => { current = name; renderTabs(); renderGrid(); });
      return b;
    }));
  }

  // Arrow keys move between tabs, as tabs do.
  tabs.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const all = [...tabs.querySelectorAll('.tab')];
    let i = all.indexOf(document.activeElement);
    if (i < 0) return;
    i = e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1
      : (i + (e.key === 'ArrowRight' ? 1 : -1) + all.length) % all.length;
    all[i].focus(); all[i].click(); e.preventDefault();
  });

  function renderGrid() {
    const shown = current === 'All' ? pieces : pieces.filter((p) => p.category === current);
    grid.replaceChildren(...shown.map((p, i) => {
      const first = p.photos?.[0];
      const pic = el('span', { class: 'tile-pic' },
        first ? el('img', {
          src: smallUrl(first), alt: '', width: 520, height: 650,
          loading: i < 4 ? 'eager' : 'lazy', decoding: 'async',
        }) : null,
        p.isNew ? el('span', { class: 'flag', text: 'New' }) : null);
      const btn = el('button', { type: 'button', 'aria-label': `${p.name}, ${rupees(p.price)}` },
        pic,
        el('span', { class: 'tile-txt' },
          el('span', { class: 'tile-name', text: p.name }),
          el('span', { class: 'tile-meta' },
            el('span', { class: 'price', text: rupees(p.price) }),
            el('span', { text: p.madeToMeasure ? 'Can be made to measure' : p.category }))));
      btn.addEventListener('click', () => openPiece(p));
      const li = el('li', { class: 'tile' }, btn);
      if (!reduced) li.style.animationDelay = `${Math.min(i, 8) * 60}ms`;
      return li;
    }));
    status.hidden = shown.length > 0;
    if (!shown.length) status.textContent = 'Nothing here right now. Ask us on WhatsApp what is coming in.';
  }

  function show(data, live) {
    pieces = (data.pieces || []).filter((p) => !p.hidden);
    categories = data.categories || [...new Set(pieces.map((p) => p.category))];
    renderTabs();
    renderGrid();
    if (live) grid.setAttribute('aria-busy', 'false');
    // A ?piece= link opens that piece once we have it.
    const want = new URL(location.href).searchParams.get('piece');
    if (want && !open) {
      const p = pieces.find((x) => x.id === want);
      if (p) openPiece(p, { push: false });
      else if (live) history.replaceState(null, '', PAGE + location.hash);
    }
    if (open) { // keep an open piece current if the owner changed it
      const p = pieces.find((x) => x.id === open.id);
      if (p) fillPiece(p);
    }
  }

  async function load() {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch { /* private mode */ }
    if (cached?.pieces) show(cached, false);
    else {
      try { show(await (await fetch('pieces.json', { cache: 'no-cache' })).json(), false); } catch { /* the live one will do */ }
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(`${API}/api/demo/${SHOP}/pieces`, { signal: AbortSignal.timeout(75_000) });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        show(data, true);
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ categories: data.categories, pieces: data.pieces })); } catch { /* fine */ }
        return;
      } catch (err) {
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    grid.setAttribute('aria-busy', 'false'); // keep what we showed; it is the best we have
  }

  /* ───────── one piece, close up ───────── */
  const track = $('#piece-track');
  const dots = $('#piece-dots');
  const sizesBox = $('#fit-sizes');
  const measure = $('#fit-measure');
  const measureWrap = $('#fit-measure-wrap');
  const msgText = $('#msg-text');
  const waBtn = $('#piece-wa');

  function message(p) {
    const choice = dialog.querySelector('input[name="fit"]:checked');
    const lines = [
      "Hi Rajani's Boutique! I'd like to ask about this piece:",
      '',
      `${p.name} (${rupees(p.price)})`,
      pieceLink(p),
    ];
    if (choice) {
      lines.push('');
      lines.push(choice.value === 'measure' ? "I'd like it stitched to my measure." : `Size: ${choice.value}`);
    }
    return lines.join('\n');
  }

  function updateMessage() {
    if (!open) return;
    const text = message(open);
    msgText.textContent = text;
    waBtn.href = waLink(text);
  }

  function fillPiece(p) {
    open = p;
    $('#piece-cat').textContent = p.category + (p.isNew ? ' · New' : '');
    $('#piece-name').textContent = p.name;
    $('#piece-price').textContent = rupees(p.price);
    $('#piece-desc').textContent = p.description || '';
    $('#piece-fabric').textContent = p.fabric ? `Fabric: ${p.fabric}` : '';

    const photos = p.photos?.length ? p.photos : [];
    track.replaceChildren(...photos.map((u, i) => el('img', {
      src: photoUrl(u), alt: i === 0 ? p.name : `${p.name}, photo ${i + 1}`, width: 1000, height: 1250,
      loading: i === 0 ? 'eager' : 'lazy',
    })));
    track.scrollLeft = 0;
    dots.replaceChildren(...(photos.length > 1 ? photos.map((_, i) => el('span', { class: i === 0 ? 'on' : '' })) : []));

    const keep = dialog.querySelector('input[name="fit"]:checked')?.value;
    sizesBox.replaceChildren(...(p.sizes || []).map((s) => el('label', {},
      el('input', { type: 'radio', name: 'fit', value: s, checked: s === keep || (p.sizes.length === 1 && !p.madeToMeasure) }),
      el('span', { text: s }))));
    measureWrap.hidden = !p.madeToMeasure;
    measure.checked = p.madeToMeasure && (keep === 'measure' || !(p.sizes || []).length);
    $('#fit').hidden = !(p.sizes || []).length && !p.madeToMeasure;
    updateMessage();
  }

  dialog.addEventListener('change', (e) => { if (e.target.name === 'fit') updateMessage(); });
  track.addEventListener('scroll', () => {
    const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    dots.querySelectorAll('span').forEach((d, k) => d.classList.toggle('on', k === i));
  }, { passive: true });

  let opener = null;
  let pushed = false; // did opening this piece add a history entry we should step back over?
  function openPiece(p, { push = true } = {}) {
    opener = document.activeElement;
    dialog.querySelectorAll('input[name="fit"]').forEach((i) => { i.checked = false; });
    fillPiece(p);
    const url = `${PAGE}?piece=${encodeURIComponent(p.id)}`;
    if (push && !dialog.open) { history.pushState({ piece: p.id }, '', url); pushed = true; }
    else history.replaceState({ piece: p.id }, '', url);
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = 0;
    $('.piece-read').scrollTop = 0;
    $('#piece-close').focus({ preventScroll: true });
  }

  // Tidy up after the piece closes, whichever way it closed (the button, Escape,
  // a tap outside, or Back). Runs once per close.
  function afterClose() {
    if (!open) return;
    open = null;
    if (new URL(location.href).searchParams.has('piece')) {
      if (pushed) history.back();
      else history.replaceState(null, '', PAGE + '#collection');
    }
    pushed = false;
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }
  function closePiece() {
    if (dialog.open) dialog.close();
    afterClose();
  }
  dialog.addEventListener('close', afterClose);
  $('#piece-close').addEventListener('click', () => closePiece());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) closePiece(); });
  addEventListener('popstate', () => {
    const want = new URL(location.href).searchParams.get('piece');
    if (!want && dialog.open) { pushed = false; open = null; dialog.close(); }
    else if (want && (!open || open.id !== want)) {
      const p = pieces.find((x) => x.id === want);
      if (p) openPiece(p, { push: false });
    }
  });

  /* ───────── the stage follows the reading ───────── */
  const stage = document.querySelectorAll('.stage img');
  if (stage.length) {
    const setStage = (name) => stage.forEach((img) => img.classList.toggle('on', img.dataset.stage === name));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) setStage(e.target.dataset.stage || 'fitting');
    }, { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('.hero, .split-read [data-stage]').forEach((s) => io.observe(s));
  }

  /* ───────── entrances ───────── */
  const revealIo = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      e.target.classList.add('in');
      revealIo.unobserve(e.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.reveal').forEach((n) => {
    const sibs = [...n.parentElement.children].filter((c) => c.classList.contains('reveal'));
    if (!reduced) n.style.transitionDelay = `${Math.min(sibs.indexOf(n), 5) * 80}ms`;
    revealIo.observe(n);
  });

  load();
})();
