/* shop.js: "Shop my picks". Everything is rendered from content/shop.json (Avni edits it at /admin).
   Features: today's special, coupon counter (tap to copy), category menu with a sliding foam tab, search, sort,
   save-for-later hearts, share, "Surprise me", auto New badges, coupon countdowns, expired coupons hide themselves. */
(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SITE = new URL('../', document.currentScript.src).href;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const make = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const asset = (p) => (!p ? '' : /^(https?:|data:|\/\/)/.test(p) ? p : SITE + String(p).replace(/^\/+/, ''));
  const slugify = (s) => String(s).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-') || 'item';
  const rupees = (n) => '₹' + Math.round(n).toLocaleString('en-IN');
  const DAY = 86400000;
  const TAPES = ['#f2b8c0', '#c9a98a', '#e7a1ad', '#d9c3a5', '#b9898f', '#efd9c4'];

  document.getElementById('year').textContent = new Date().getFullYear();

  /* ---------- Nav: mobile menu + espresso mode (shared with the portfolio) ---------- */
  const toggle = $('.nav__toggle');
  const links = $('#nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) { links.classList.remove('open'); toggle.setAttribute('aria-expanded', 'false'); }
  });
  // The category bar sticks right under the navbar, whatever its height
  const navBar = $('.nav');
  const setNavH = () => root.style.setProperty('--sp-nav', navBar.offsetHeight + 'px');
  setNavH();
  window.addEventListener('resize', setNavH);
  (() => {
    const KEY = 'fx-espresso';
    const btn = make('button', 'fx-theme', '<span class="fx-theme__icon" aria-hidden="true">&#9790;</span><span class="fx-theme__label">Espresso mode</span>');
    btn.type = 'button';
    btn.title = 'Espresso mode';
    const set = (on, animate) => {
      if (animate && !reduceMotion) {
        root.classList.add('fx-theme-anim');
        setTimeout(() => root.classList.remove('fx-theme-anim'), 700);
      }
      root.classList.toggle('fx-espresso', on);
      btn.setAttribute('aria-pressed', String(on));
      $('.fx-theme__icon', btn).innerHTML = on ? '&#9728;' : '&#9790;';
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* storage blocked */ }
    };
    let saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) { /* storage blocked */ }
    set(saved === '1', false);
    btn.addEventListener('click', () => set(!root.classList.contains('fx-espresso'), true));
    links.append(btn);
  })();

  /* ---------- Toast + little heart burst ---------- */
  const toastEl = $('.sp-toast');
  let toastTimer;
  const toast = (html) => {
    toastEl.innerHTML = html;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2400);
  };
  const hearts = (x, y, n = 8) => {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      const h = make('span', 'fx-burst fx-burst--heart', '&#9829;');
      h.setAttribute('aria-hidden', 'true');
      h.style.left = x + 'px';
      h.style.top = y + 'px';
      document.body.append(h);
      const a = Math.random() * Math.PI * 2;
      const d = 50 + Math.random() * 70;
      h.animate([
        { transform: 'translate(-50%, -50%) scale(.3)', opacity: 1 },
        { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d - 30}px)) scale(1)`, opacity: 0 },
      ], { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => h.remove();
    }
  };
  const copyText = async (txt) => {
    try { await navigator.clipboard.writeText(txt); return true; } catch (e) { /* fall back below */ }
    const ta = make('textarea');
    ta.value = txt;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  };

  /* ---------- Saved (wishlist) ---------- */
  const SAVED = 'sp-saved';
  let saved = new Set();
  try { saved = new Set(JSON.parse(localStorage.getItem(SAVED) || '[]')); } catch (e) { /* storage blocked */ }
  const persist = () => { try { localStorage.setItem(SAVED, JSON.stringify([...saved])); } catch (e) { /* storage blocked */ } };

  /* ---------- Data ---------- */
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const parseDate = (s) => {
    const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  const couponState = (c) => {
    if (!c || !String(c.code || '').trim()) return null;
    const exp = parseDate(c.expires);
    if (exp && exp < today) return null; // expired coupons disappear by themselves
    const days = exp ? Math.round((exp - today) / DAY) : null;
    const label = days == null ? 'no expiry'
      : days === 0 ? 'ends today'
      : days === 1 ? 'ends tomorrow'
      : days <= 7 ? `ends in ${days} days`
      : 'valid till ' + exp.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    return { code: String(c.code).trim(), discount: c.discount || '', terms: c.terms || '', exp, days, label, urgent: days != null && days <= 3 };
  };

  let CATS = [];
  let PRODUCTS = [];
  const normalise = (data) => {
    const usedC = new Set();
    const usedP = new Set();
    const uniq = (base, used) => { let s = base; let i = 2; while (used.has(s)) s = `${base}-${i++}`; used.add(s); return s; };
    let order = 0;
    CATS = (data.categories || []).filter((c) => c && c.name).map((c, ci) => {
      const cat = { name: c.name, emoji: c.emoji || '', blurb: c.blurb || '', slug: uniq(slugify(c.name), usedC), tape: TAPES[ci % TAPES.length] };
      cat.products = (c.products || []).filter((p) => p && p.name && !p.hidden).map((p) => {
        const added = parseDate(p.added);
        let badge = p.badge && p.badge !== 'none' ? p.badge : '';
        if (!badge && added && today - added <= 14 * DAY) badge = 'new';
        const price = +p.price || 0;
        const mrp = +p.mrp || 0;
        return {
          ...p, cat, order: order++, slug: uniq(slugify(p.name), usedP), badge, added,
          price, mrp, off: mrp > price && price > 0 ? Math.round((1 - price / mrp) * 100) : 0,
          soldOut: badge === 'sold-out', coupon: couponState(p.coupon),
          search: [p.name, p.brand, p.note, c.name, p.coupon && p.coupon.code].join(' ').toLowerCase(),
        };
      });
      return cat;
    }).filter((c) => c.products.length); // e.g. "New from Wishlink" while every import is still hidden
    PRODUCTS = CATS.flatMap((c) => c.products);
  };

  /* ---------- Building blocks ---------- */
  const BADGES = { new: 'New', fav: "Avni's fav", bestseller: 'Bestseller', 'sold-out': 'Sold out', limited: 'Limited' };
  const photo = (p, cls = '') => `
    <div class="sp-photo ${cls}">
      <span class="sp-ph" aria-hidden="true">${esc(p.cat.emoji || '☕')}</span>
      ${p.image ? `<img src="${esc(asset(p.image))}" alt="${esc(p.name)}" loading="lazy" onerror="this.remove()">` : ''}
      ${p.badge && !p.soldOut ? `<span class="sp-badge sp-badge--${esc(p.badge)}">${esc(BADGES[p.badge] || p.badge)}</span>` : ''}
      ${p.soldOut ? '<span class="sp-stamp">Sold out</span>' : ''}
      <button type="button" class="sp-heart" data-save="${p.slug}" aria-pressed="${saved.has(p.slug)}" aria-label="Save ${esc(p.name)}">&#9829;</button>
      ${p.price ? `<span class="sp-tag"><b>${rupees(p.price)}</b>${p.off ? `<s>${rupees(p.mrp)}</s><i>-${p.off}%</i>` : ''}</span>` : ''}
    </div>`;
  const couponBtn = (p) => (p.coupon && !p.soldOut ? `
    <button type="button" class="sp-coupon${p.coupon.urgent ? ' is-urgent' : ''}" data-code="${esc(p.coupon.code)}" aria-label="Copy coupon ${esc(p.coupon.code)}"
      title="${esc([p.coupon.discount, p.coupon.code, p.coupon.label, p.coupon.terms].filter(Boolean).join(' · '))}">
      <span class="sp-coupon__off">${esc(p.coupon.discount || 'Coupon')}</span>
      <code>${esc(p.coupon.code)}</code>
      <span class="sp-coupon__meta"><span class="sp-coupon__hint">tap to copy</span> &middot; ${esc(p.coupon.label)}${p.coupon.terms ? ` &middot; <span class="sp-coupon__terms">${esc(p.coupon.terms)}</span>` : ''}</span>
    </button>` : '');
  const actions = (p) => `
    <div class="sp-actions">
      ${p.soldOut ? '<span class="sp-buy is-off" aria-disabled="true">Sold out</span>'
    : `<a class="sp-buy" href="${esc(p.link || '#')}" target="_blank" rel="noopener sponsored">Shop now <b aria-hidden="true">&#8599;</b></a>`}
      ${p.reel ? `<a class="sp-mini" href="${esc(p.reel)}" target="_blank" rel="noopener" aria-label="Watch my reel about ${esc(p.name)}"><span aria-hidden="true">&#9654;</span> Reel</a>` : ''}
      <button type="button" class="sp-mini sp-mini--icon" data-share="${p.slug}" aria-label="Share ${esc(p.name)}" title="Share">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </button>
    </div>`;
  const card = (p, i) => `
    <article class="sp-card${p.soldOut ? ' is-soldout' : ''}" id="p-${p.slug}" data-slug="${p.slug}"
      style="--tape:${p.cat.tape};--tilt:${((i % 5) - 2) * 0.7}deg;--i:${i % 12}">
      <span class="sp-card__tape" aria-hidden="true"></span>
      ${photo(p)}
      <div class="sp-body">
        <p class="sp-brand">${esc(p.brand || p.cat.name)}</p>
        <h3 class="sp-name" title="${esc(p.name)}">${esc(p.name)}</h3>
        ${p.note ? `<p class="sp-note">&ldquo;${esc(p.note)}&rdquo;</p>` : ''}
        ${actions(p)}
      </div>
    </article>`;

  /* ---------- Sections ---------- */
  const renderPage = (page) => {
    const note = $('[data-page="note"]');
    if (note) note.hidden = !String(page.note || '').trim(); // emptied in /admin: no note
    $$('[data-page]').forEach((n) => {
      const v = page[n.dataset.page];
      if (!v) return;
      if (n.tagName === 'IMG') n.src = asset(v);
      else n.textContent = v;
    });
    if (page.title) document.title = `${page.title} | Avni Arora | Lattes.n.laptops`;
  };

  const countUp = (el, to) => {
    if (reduceMotion || !to) { el.textContent = to; return; }
    const t0 = performance.now();
    const tick = (now) => {
      const k = Math.min((now - t0) / 900, 1);
      el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const renderStats = () => {
    countUp($('[data-stat="picks"]'), PRODUCTS.length);
    countUp($('[data-stat="coupons"]'), PRODUCTS.filter((p) => p.coupon && !p.soldOut).length);
    countUp($('[data-stat="cats"]'), CATS.length);
  };

  const renderSpecial = () => {
    const p = PRODUCTS.find((x) => x.featured && !x.soldOut);
    const sec = $('#special');
    if (!p) { sec.hidden = true; return; }
    sec.hidden = false;
    $('.sp-special__inner', sec).innerHTML = `
      <p class="sp-special__label"><span>&#9733;</span> Today's special <span>&#9733;</span></p>
      <article class="sp-spec" data-slug="${p.slug}">
        <div class="polaroid sp-spec__frame">${photo(p, 'sp-photo--big')}</div>
        <div class="sp-spec__body">
          <p class="sp-brand">${esc(p.brand || p.cat.name)} &middot; ${esc(p.cat.emoji)} ${esc(p.cat.name)}</p>
          <h3 class="sp-spec__name" title="${esc(p.name)}">${esc(p.name)}</h3>
          ${p.note ? `<p class="sp-spec__note">${esc(p.note)}</p>` : ''}
          ${couponBtn(p)}
          ${actions(p)}
        </div>
      </article>`;
  };

  const renderCoupons = () => {
    const list = PRODUCTS.filter((p) => p.coupon && !p.soldOut)
      .sort((a, b) => (a.coupon.days ?? 1e9) - (b.coupon.days ?? 1e9));
    const sec = $('#coupons');
    sec.hidden = !list.length;
    $('.sp-nav-coupons').hidden = !list.length;
    const more = $('.sp-tickets-more', sec);
    if (more) more.remove();
    $('.sp-tickets', sec).classList.toggle('is-collapsed', list.length > 3);
    if (list.length > 3) {
      const b = make('button', 'sp-tickets-more', `Show all ${list.length} coupons <b aria-hidden="true">&darr;</b>`);
      b.type = 'button';
      b.addEventListener('click', () => { $('.sp-tickets', sec).classList.remove('is-collapsed'); b.remove(); });
      sec.append(b);
    }
    $('.sp-tickets', sec).innerHTML = list.map((p, i) => `
      <button type="button" class="sp-ticket${p.coupon.urgent ? ' is-urgent' : ''}" data-code="${esc(p.coupon.code)}" data-goto="${p.slug}"
        style="--i:${i};--tape:${p.cat.tape}" aria-label="Copy coupon ${esc(p.coupon.code)} for ${esc(p.brand || p.name)}">
        <span class="sp-ticket__left">
          <span class="sp-ticket__off">${esc(p.coupon.discount || 'Coupon')}</span>
          <span class="sp-ticket__brand">${esc(p.brand || p.cat.name)}</span>
          <span class="sp-ticket__item">${esc(p.name)}</span>
        </span>
        <span class="sp-ticket__right">
          <code>${esc(p.coupon.code)}</code>
          <span class="sp-ticket__hint">tap to copy</span>
          <span class="sp-ticket__exp">${esc(p.coupon.label)}</span>
        </span>
      </button>`).join('');
  };

  /* ---------- Menu: tabs, search, sort, grid ---------- */
  const state = { cat: 'all', q: '', sort: 'avni' };
  const tabs = $('.sp-tabs');
  const foam = $('.sp-tabs__foam');
  const grid = $('.sp-grid');
  const empty = $('.sp-empty');
  const results = $('.sp-results');
  const blurb = $('.sp-blurb');
  const searchInput = $('.sp-search input');
  const sortSelect = $('.sp-sort select');

  const renderTabs = () => {
    const all = [{ slug: 'all', name: 'All', emoji: '☕', count: PRODUCTS.length },
      ...CATS.map((c) => ({ slug: c.slug, name: c.name, emoji: c.emoji, count: c.products.length })),
      { slug: 'saved', name: 'Saved', emoji: '♡', count: [...saved].filter((s) => PRODUCTS.some((p) => p.slug === s)).length }];
    $$('.sp-tab', tabs).forEach((t) => t.remove());
    all.forEach((t) => {
      const b = make('button', 'sp-tab', `<span aria-hidden="true">${esc(t.emoji)}</span> ${esc(t.name)} <small>${t.count}</small>`);
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.cat = t.slug;
      tabs.append(b);
    });
    markTab();
  };
  const markTab = () => {
    let active = null;
    $$('.sp-tab', tabs).forEach((t) => {
      const on = t.dataset.cat === state.cat;
      t.setAttribute('aria-selected', String(on));
      if (on) active = t;
    });
    if (active) {
      foam.style.left = active.offsetLeft + 'px';
      foam.style.top = active.offsetTop + 'px';
      foam.style.width = active.offsetWidth + 'px';
      foam.style.height = active.offsetHeight + 'px';
      if (!reduceMotion) foam.animate({ scale: ['1 1', '1.08 .8', '1 1'] }, { duration: 420, easing: 'ease-out' });
      const tl = tabs.scrollLeft;
      if (active.offsetLeft < tl || active.offsetLeft + active.offsetWidth > tl + tabs.clientWidth) {
        tabs.scrollTo({ left: active.offsetLeft - 16, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
    }
  };

  const visible = () => {
    let list = PRODUCTS;
    if (state.q) list = list.filter((p) => state.q.split(/\s+/).every((w) => p.search.includes(w)));
    else if (state.cat === 'saved') list = list.filter((p) => saved.has(p.slug));
    else if (state.cat !== 'all') list = list.filter((p) => p.cat.slug === state.cat);
    const by = {
      avni: (a, b) => a.order - b.order,
      new: (a, b) => (b.added || 0) - (a.added || 0) || a.order - b.order,
      low: (a, b) => (a.price || 1e9) - (b.price || 1e9),
      high: (a, b) => (b.price || 0) - (a.price || 0),
      deal: (a, b) => b.off - a.off || a.order - b.order,
    }[state.sort];
    return [...list].sort(by).sort((a, b) => a.soldOut - b.soldOut); // sold out always last
  };

  const renderGrid = () => {
    const list = visible();
    grid.innerHTML = list.map(card).join('');
    empty.hidden = list.length > 0;
    const cat = CATS.find((c) => c.slug === state.cat);
    blurb.textContent = state.q ? 'Searching the whole shelf' : cat ? cat.blurb || `${cat.emoji} ${cat.name}` : state.cat === 'saved' ? 'Your saved picks, kept on this device ♡' : 'Everything on my shelf right now.';
    results.textContent = state.q ? `${list.length} pick${list.length === 1 ? '' : 's'} for "${state.q}"` : '';
    $('.sp-empty__text').textContent = state.cat === 'saved' && !state.q ? 'Tap the ♡ on any product to save it here.' : 'Try another category, or clear the search.';
  };

  const setCat = (slug, push = true) => {
    state.cat = slug;
    if (state.q) { state.q = ''; searchInput.value = ''; hint.hidden = true; }
    markTab();
    renderGrid();
    if (push) history.replaceState(null, '', slug === 'all' ? location.pathname : '#c-' + slug);
  };
  tabs.addEventListener('click', (e) => {
    const t = e.target.closest('.sp-tab');
    if (t) setCat(t.dataset.cat);
  });
  // Typing filters the menu quietly (no jumping); a hint under the box offers to take you to the results
  const hint = make('p', 'sp-search-hint');
  hint.hidden = true;
  hint.setAttribute('aria-live', 'polite');
  $('.sp-search').after(hint);
  // Shorter placeholder on phones so the whole hint fits in the box
  const phoneQ = window.matchMedia('(max-width: 480px)');
  const setPlaceholder = () => { searchInput.placeholder = phoneQ.matches ? 'Search, e.g. "serum"' : 'Search my picks... try "serum"'; };
  setPlaceholder();
  phoneQ.addEventListener('change', setPlaceholder);
  const clear = make('button', 'sp-search__clear', '&times;');
  clear.type = 'button';
  clear.setAttribute('aria-label', 'Clear search');
  clear.hidden = true;
  $('.sp-search').append(clear);
  clear.addEventListener('click', () => {
    searchInput.value = '';
    searchInput.dispatchEvent(new Event('input'));
    searchInput.focus();
  });
  searchInput.addEventListener('input', () => { clear.hidden = !searchInput.value; });
  const toResults = () => $('#picks').scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  let qTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => {
      state.q = searchInput.value.trim().toLowerCase();
      if (state.q && state.cat !== 'all') { state.cat = 'all'; markTab(); }
      renderGrid();
      const n = visible().length;
      hint.hidden = !state.q;
      if (state.q) {
        hint.innerHTML = `<span>${n ? `${n} pick${n === 1 ? '' : 's'} found` : 'No picks match yet'}</span>${n ? '<button type="button">Show &darr;</button>' : ''}`;
        const b = $('button', hint);
        if (b) b.addEventListener('click', toResults);
      }
    }, 220);
  });
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); searchInput.blur(); toResults(); }
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); searchInput.focus(); }
  });
  sortSelect.addEventListener('change', () => { state.sort = sortSelect.value; renderGrid(); });
  window.addEventListener('resize', markTab);

  const updateSavedCount = () => {
    const n = [...saved].filter((s) => PRODUCTS.some((p) => p.slug === s)).length;
    $$('[data-saved-count]').forEach((c) => { c.textContent = n; });
    const tab = $('.sp-tab[data-cat="saved"] small', tabs);
    if (tab) tab.textContent = n;
  };
  $('[data-saved-link]').addEventListener('click', () => setCat('saved'));

  // Scroll to a product card and make it glow (used by deep links, tickets and Surprise me)
  const spotlight = (slug) => {
    let el = document.getElementById('p-' + slug);
    if (!el) { setCat('all'); el = document.getElementById('p-' + slug); }
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('sp-pulse');
    void el.offsetWidth;
    el.classList.add('sp-pulse');
  };
  $('.sp-surprise').addEventListener('click', (e) => {
    const pool = PRODUCTS.filter((p) => !p.soldOut);
    if (!pool.length) return;
    const p = pool[Math.floor(Math.random() * pool.length)];
    const r = e.currentTarget.getBoundingClientRect();
    hearts(r.left + r.width / 2, r.top + r.height / 2, 10);
    toast(`Today you're getting: <b>${esc(p.name)}</b> &#9749;`);
    setTimeout(() => spotlight(p.slug), 250);
  });

  // Desktop: cards tilt toward the mouse
  if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    grid.addEventListener('pointermove', (e) => {
      const c = e.target.closest('.sp-card');
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--ry', (((e.clientX - r.left) / r.width - 0.5) * 8).toFixed(2) + 'deg');
      c.style.setProperty('--rx', (-((e.clientY - r.top) / r.height - 0.5) * 6).toFixed(2) + 'deg');
    });
    grid.addEventListener('pointerout', (e) => {
      const c = e.target.closest('.sp-card');
      if (c && !c.contains(e.relatedTarget)) { c.style.removeProperty('--ry'); c.style.removeProperty('--rx'); }
    });
  }

  /* ---------- Clicks anywhere: copy coupon, save, share ---------- */
  document.addEventListener('click', async (e) => {
    const code = e.target.closest('[data-code]');
    if (code) {
      const ok = await copyText(code.dataset.code);
      const r = code.getBoundingClientRect();
      hearts(r.left + r.width / 2, r.top + r.height / 2);
      code.classList.remove('is-copied');
      void code.offsetWidth;
      code.classList.add('is-copied');
      setTimeout(() => code.classList.remove('is-copied'), 1600);
      toast(ok ? `<b>${esc(code.dataset.code)}</b> copied &#9749; paste it at checkout` : `Your code: <b>${esc(code.dataset.code)}</b>`);
      return;
    }
    const heart = e.target.closest('[data-save]');
    if (heart) {
      const s = heart.dataset.save;
      const on = !saved.has(s);
      if (on) saved.add(s); else saved.delete(s);
      persist();
      $$(`[data-save="${s}"]`).forEach((h) => h.setAttribute('aria-pressed', String(on)));
      if (on) { const r = heart.getBoundingClientRect(); hearts(r.left + r.width / 2, r.top + r.height / 2, 6); }
      if (!reduceMotion) heart.animate({ scale: ['1', '1.4', '1'] }, { duration: 380, easing: 'ease-out' });
      updateSavedCount();
      if (state.cat === 'saved' && !on) renderGrid();
      toast(on ? 'Saved to your picks ♡' : 'Removed from saved');
      return;
    }
    const share = e.target.closest('[data-share]');
    if (share) {
      const p = PRODUCTS.find((x) => x.slug === share.dataset.share);
      const url = location.origin + location.pathname + '#p-' + p.slug;
      const data = { title: p.name, text: `${p.name} (Avni's pick)${p.coupon ? ` · code ${p.coupon.code}` : ''}`, url };
      if (navigator.share) { try { await navigator.share(data); } catch (err) { /* cancelled */ } return; }
      toast((await copyText(url)) ? 'Link copied, send it to your bestie ♡' : url);
    }
  });

  /* ---------- Load ---------- */
  const fail = () => {
    grid.innerHTML = '';
    empty.hidden = false;
    $('.script', empty).textContent = 'The menu is being restocked';
    $('.sp-empty__text').textContent = 'Please refresh in a minute ☕';
  };
  fetch(SITE + 'content/shop.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((data) => {
      normalise(data);
      renderPage(data.page || {});
      renderStats();
      renderSpecial();
      renderCoupons();
      renderTabs();
      // Deep links: #c-skincare opens a category, #p-<product> scrolls to it
      const h = decodeURIComponent(location.hash.slice(1));
      if (h.startsWith('c-') && CATS.some((c) => c.slug === h.slice(2))) state.cat = h.slice(2);
      markTab();
      renderGrid();
      updateSavedCount();
      if (h.startsWith('p-')) setTimeout(() => spotlight(h.slice(2)), 300);
    })
    .catch(fail);
})();
