// Rajani's Boutique — the owner's admin page: add, change, hide, reorder and
// remove pieces. Photos are shrunk in the browser before upload (longest side
// 1600px, WebP where the browser can write it), so a phone photo of several MB
// goes up as a few hundred KB.

(() => {
  'use strict';

  const SHOP = 'rajanis-boutique';
  const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const API = (LOCAL ? `http://${location.hostname}:3011` : 'https://shonku-waitlist.onrender.com') + `/api/demo/${SHOP}`;
  const PASS_KEY = `demo:${SHOP}:passcode`;
  const PAGE = new URL('./', document.baseURI).href;
  const MAX_PHOTOS = 6;

  const $ = (s, el = document) => el.querySelector(s);
  let passcode = '';
  let pieces = [];
  let categories = [];
  let sizes = [];
  let filter = 'All';

  try { passcode = sessionStorage.getItem(PASS_KEY) || ''; } catch { /* private mode */ }

  const rupees = (n) => (n === null || n === undefined ? 'Price on request' : '₹' + Number(n).toLocaleString('en-IN'));
  const photoUrl = (u) => (u.startsWith('/api/') ? API.replace(/\/api\/demo\/.*$/, '') + u : new URL(u, PAGE).href);
  const smallUrl = (u) => (/^img\/.+\.webp$/.test(u) ? new URL(u.replace(/\.webp$/, '-s.webp'), PAGE).href : photoUrl(u));

  function el(tag, attrs = {}, ...kids) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids) if (k !== null && k !== undefined && k !== false) n.append(k);
    return n;
  }
  const svg = (d) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d);
    s.append(p); return s;
  };
  const ICON = { up: 'M12 19V5M5 12l7-7 7 7', down: 'M12 5v14M5 12l7 7 7-7', left: 'M19 12H5M12 5l-7 7 7 7', x: 'M6 6l12 12M18 6L6 18' };

  // Every call to the API. A sleeping server takes up to a minute to answer the
  // first call, so say so when a call is slow instead of looking stuck.
  async function api(path, { method = 'GET', body, type, note } = {}) {
    const headers = { 'X-Demo-Passcode': passcode };
    if (body !== undefined && !type) headers['Content-Type'] = 'application/json';
    if (type) headers['Content-Type'] = type;
    const slow = note ? setTimeout(() => { note.classList.remove('bad'); note.textContent = 'Waking the server up. The first time in a while this can take up to a minute…'; }, 3500) : null;
    try {
      const res = await fetch(API + path, {
        method, headers,
        body: body === undefined ? undefined : type ? body : JSON.stringify(body),
        signal: AbortSignal.timeout(90_000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.error || `The server said ${res.status}.`);
        err.status = res.status;
        throw err;
      }
      return data;
    } catch (err) {
      if (err.name === 'TimeoutError' || err.name === 'TypeError') {
        const e = new Error('Could not reach the server. Check your connection and try again.');
        e.status = 0; throw e;
      }
      throw err;
    } finally {
      if (slow) clearTimeout(slow);
      if (note && note.textContent.startsWith('Waking')) note.textContent = '';
    }
  }

  const say = (node, text, bad = false) => { node.textContent = text; node.classList.toggle('bad', bad); };

  /* ───────── sign in ───────── */
  const signin = $('#signin');
  const manage = $('#manage');
  const signinMsg = $('#signin-msg');

  async function enter() {
    signin.hidden = true;
    manage.hidden = false;
    $('#signout').hidden = false;
    await refresh();
  }

  $('#signin-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const value = $('#passcode').value.trim();
    if (!value) { say(signinMsg, 'Type the passcode first.', true); $('#passcode').focus(); return; }
    const btn = $('#signin-btn');
    btn.disabled = true; say(signinMsg, 'Checking…');
    passcode = value;
    try {
      await api('/login', { method: 'POST', note: signinMsg });
      try { sessionStorage.setItem(PASS_KEY, passcode); } catch { /* fine */ }
      say(signinMsg, '');
      await enter();
    } catch (err) {
      passcode = '';
      say(signinMsg, err.message, true);
      $('#passcode').select();
    } finally { btn.disabled = false; }
  });

  $('#signout').addEventListener('click', () => {
    try { sessionStorage.removeItem(PASS_KEY); } catch { /* fine */ }
    passcode = '';
    location.reload();
  });

  /* ───────── the list ───────── */
  const list = $('#list');
  const listMsg = $('#list-msg');

  async function refresh() {
    say(listMsg, pieces.length ? '' : 'Loading the collection…');
    try {
      const data = await api('/pieces', { note: listMsg });
      pieces = data.pieces; categories = data.categories; sizes = data.sizes;
      say(listMsg, '');
      render();
    } catch (err) {
      if (err.status === 401) { passcode = ''; try { sessionStorage.removeItem(PASS_KEY); } catch { /**/ } location.reload(); return; }
      say(listMsg, err.message, true);
    }
  }

  function render() {
    const hidden = pieces.filter((p) => p.hidden).length;
    $('#counts').textContent = `${pieces.length} ${pieces.length === 1 ? 'piece' : 'pieces'}` +
      (hidden ? `, ${hidden} hidden from the shop page` : ', all on the shop page');

    const counts = new Map();
    for (const p of pieces) counts.set(p.category, (counts.get(p.category) || 0) + 1);
    const names = ['All', ...categories.filter((c) => counts.has(c))];
    if (!names.includes(filter)) filter = 'All';
    $('#filters').replaceChildren(...names.map((n) => {
      const b = el('button', { class: 'filter', type: 'button', role: 'tab', 'aria-selected': String(n === filter) },
        `${n} ${n === 'All' ? pieces.length : counts.get(n)}`);
      b.addEventListener('click', () => { filter = n; render(); });
      return b;
    }));

    const shown = filter === 'All' ? pieces : pieces.filter((p) => p.category === filter);
    if (!shown.length) {
      list.replaceChildren(el('li', { class: 'empty', text: 'No pieces yet. Add your first one.' }));
      return;
    }
    list.replaceChildren(...shown.map((p) => {
      const i = pieces.indexOf(p);
      const up = el('button', { class: 'icon', type: 'button', 'aria-label': `Move ${p.name} up`, disabled: i === 0 }, svg(ICON.up));
      const down = el('button', { class: 'icon', type: 'button', 'aria-label': `Move ${p.name} down`, disabled: i === pieces.length - 1 }, svg(ICON.down));
      up.addEventListener('click', () => move(p, -1));
      down.addEventListener('click', () => move(p, 1));
      const edit = el('button', { class: 'item-edit', type: 'button', text: p.name });
      edit.addEventListener('click', () => openEditor(p));
      return el('li', { class: 'item' + (p.hidden ? ' is-hidden' : '') },
        el('div', { class: 'item-pic' }, p.photos?.[0] ? el('img', { src: smallUrl(p.photos[0]), alt: '', loading: 'lazy', width: 64, height: 80 }) : null),
        el('div', { class: 'item-main' }, edit,
          el('div', { class: 'item-sub' },
            el('span', { text: p.category }),
            p.isNew ? el('span', { text: 'New' }) : null,
            p.madeToMeasure ? el('span', { text: 'Made to measure' }) : null,
            p.hidden ? el('span', { class: 'off', text: 'Hidden' }) : null)),
        el('div', { class: 'item-price', text: rupees(p.price) }),
        el('div', { class: 'item-move' }, up, down));
    }));
  }

  async function move(p, by) {
    const i = pieces.indexOf(p);
    const j = i + by;
    if (j < 0 || j >= pieces.length) return;
    [pieces[i], pieces[j]] = [pieces[j], pieces[i]];
    render();
    const focusLabel = `Move ${p.name} ${by < 0 ? 'up' : 'down'}`;
    list.querySelector(`[aria-label="${CSS.escape(focusLabel)}"]:not([disabled])`)?.focus();
    try {
      await api('/order', { method: 'PUT', body: { ids: pieces.map((x) => x.id) }, note: listMsg });
      say(listMsg, 'Order saved.');
    } catch (err) { say(listMsg, err.message, true); refresh(); }
  }

  /* ───────── the editor ───────── */
  const editor = $('#editor');
  const form = $('#editor-form');
  const editorMsg = $('#editor-msg');
  const photoList = $('#photo-list');
  let editing = null; // the piece being changed, or null for a new one
  let photos = [];    // [{ url } | { pending: true, local, error }]

  function renderPhotos() {
    photoList.replaceChildren(...photos.map((ph, i) => {
      const tools = el('div', { class: 'photo-tools' });
      if (i > 0 && ph.url) {
        const first = el('button', { class: 'icon', type: 'button', 'aria-label': `Make photo ${i + 1} the first` }, svg(ICON.left));
        first.addEventListener('click', () => { photos.unshift(...photos.splice(i, 1)); renderPhotos(); });
        tools.append(first);
      }
      const rm = el('button', { class: 'icon', type: 'button', 'aria-label': `Remove photo ${i + 1}` }, svg(ICON.x));
      rm.addEventListener('click', () => { photos.splice(i, 1); renderPhotos(); });
      tools.append(rm);
      return el('li', { class: 'photo' },
        el('img', { src: ph.local || smallUrl(ph.url), alt: `Photo ${i + 1}` }),
        i === 0 && ph.url ? el('span', { class: 'photo-first', text: 'First' }) : null,
        ph.pending || ph.error ? el('div', { class: 'busy' + (ph.error ? ' bad' : ''), text: ph.error || 'Uploading…' }) : null,
        tools);
    }));
    $('#photo-add').hidden = photos.length >= MAX_PHOTOS;
  }

  function openEditor(p) {
    editing = p || null;
    form.reset();
    say(editorMsg, '');
    $('#editor-title').textContent = p ? 'Edit piece' : 'Add a piece';
    $('#delete').hidden = !p;
    form.category.replaceChildren(el('option', { value: '', text: 'Choose…' }),
      ...categories.map((c) => el('option', { value: c, text: c })));
    $('#size-chips').replaceChildren(...sizes.map((s) => el('label', { class: 'chip' },
      el('input', { type: 'checkbox', name: 'sizes', value: s }), el('span', { text: s }))));
    if (p) {
      form.name.value = p.name;
      form.category.value = p.category;
      form.price.value = p.price ?? '';
      form.fabric.value = p.fabric || '';
      form.description.value = p.description || '';
      form.querySelectorAll('input[name="sizes"]').forEach((c) => { c.checked = (p.sizes || []).includes(c.value); });
      form.madeToMeasure.checked = Boolean(p.madeToMeasure);
      form.isNew.checked = Boolean(p.isNew);
      form.shown.checked = !p.hidden;
    } else {
      form.category.value = filter !== 'All' ? filter : '';
      form.shown.checked = true;
      form.madeToMeasure.checked = true;
    }
    photos = (p?.photos || []).map((url) => ({ url }));
    renderPhotos();
    editor.showModal();
    editor.querySelector('.editor-body').scrollTop = 0;
    (p ? form.name : form.name).focus();
  }

  $('#add').addEventListener('click', () => openEditor(null));
  $('#editor-close').addEventListener('click', () => editor.close());
  $('#cancel').addEventListener('click', () => editor.close());

  // Shrink a photo in the browser: longest side 1600px, WebP (JPEG where the
  // browser can't write WebP), corrected for the phone's orientation.
  async function shrink(file) {
    let bitmap;
    try { bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch {
      try { bitmap = await createImageBitmap(file); }
      catch { throw new Error('Could not read this photo. Try a JPEG or PNG.'); }
    }
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale), h = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob = (t, q) => new Promise((r) => canvas.toBlob(r, t, q));
    let out = await blob('image/webp', 0.82);
    if (!out || out.type !== 'image/webp') out = await blob('image/jpeg', 0.85);
    if (!out) throw new Error('Could not prepare this photo.');
    return out;
  }

  $('#photo-input').addEventListener('change', async (e) => {
    const files = [...e.target.files].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    await Promise.all(files.map(async (file) => {
      const ph = { pending: true, local: URL.createObjectURL(file) };
      photos.push(ph); renderPhotos();
      try {
        const blob = await shrink(file);
        const data = await api('/photos', { method: 'POST', body: blob, type: blob.type, note: editorMsg });
        ph.url = data.url;
        ph.pending = false;
      } catch (err) {
        ph.pending = false; ph.error = err.message;
      }
      renderPhotos();
    }));
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (photos.some((ph) => ph.pending)) { say(editorMsg, 'Wait for the photos to finish uploading.', true); return; }
    const name = form.name.value.trim();
    if (!name) { say(editorMsg, 'Give the piece a name.', true); form.name.focus(); return; }
    if (!form.category.value) { say(editorMsg, 'Choose a category.', true); form.category.focus(); return; }
    const priceText = form.price.value.replace(/[₹,\s]/g, '');
    if (priceText && !/^\d+$/.test(priceText)) { say(editorMsg, 'The price should be a number, like 4500.', true); form.price.focus(); return; }
    const body = {
      name,
      category: form.category.value,
      price: priceText ? Number(priceText) : null,
      fabric: form.fabric.value,
      description: form.description.value,
      sizes: [...form.querySelectorAll('input[name="sizes"]:checked')].map((c) => c.value),
      madeToMeasure: form.madeToMeasure.checked,
      isNew: form.isNew.checked,
      hidden: !form.shown.checked,
      photos: photos.filter((ph) => ph.url).map((ph) => ph.url),
    };
    const btn = $('#save');
    btn.disabled = true; say(editorMsg, 'Saving…');
    try {
      if (editing) await api(`/pieces/${encodeURIComponent(editing.id)}`, { method: 'PUT', body, note: editorMsg });
      else await api('/pieces', { method: 'POST', body, note: editorMsg });
      editor.close();
      say(listMsg, editing ? `Saved “${name}”.` : `Added “${name}” to the top of the collection.`);
      await refresh();
    } catch (err) {
      say(editorMsg, err.message, true);
    } finally { btn.disabled = false; }
  });

  $('#delete').addEventListener('click', async () => {
    if (!editing) return;
    if (!confirm(`Remove “${editing.name}” from the collection? This can't be undone. To take it off the site for now, untick “Show on the shop page” instead.`)) return;
    const btn = $('#delete');
    btn.disabled = true;
    try {
      await api(`/pieces/${encodeURIComponent(editing.id)}`, { method: 'DELETE', note: editorMsg });
      const name = editing.name;
      editor.close();
      say(listMsg, `Removed “${name}”.`);
      await refresh();
    } catch (err) { say(editorMsg, err.message, true); }
    finally { btn.disabled = false; }
  });

  // Signed in already in this tab? Go straight to the list.
  if (passcode) enter();
  else $('#passcode').focus();
})();
