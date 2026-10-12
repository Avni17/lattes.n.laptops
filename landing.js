/* landing.js: "Latte or Laptop?" landing.
   1. Intro: the latte pours and the laptop opens, then the cup flies into the Shop card and the laptop into the Work card.
   2. Live bits from the admin: sticky notes, product snapshots, laptop screen stats, brand names.
   3. Cards tilt toward the mouse; on phones they take turns "waking up".
   4. Leaving: the cup pours into the shop, or the laptop screen zooms into the portfolio. */
(() => {
  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const make = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const SITE = new URL('.', document.currentScript.src).href;
  const asset = (p) => (!p ? '' : /^(https?:|data:|\/\/)/.test(p) ? p : SITE + String(p).replace(/^\/+/, ''));
  const getJSON = (path) => fetch(SITE + path, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));

  const shopCard = $('.lp-card--shop');
  const workCard = $('.lp-card--work');
  const ready = () => root.classList.add('lp-ready');

  /* ---------- 1. Intro ---------- */
  // Plays on a fresh visit or a refresh; skipped when coming back from the shop or the portfolio.
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  const fromInside = (() => {
    try { return document.referrer && new URL(document.referrer).origin === location.origin && new URL(document.referrer).pathname !== location.pathname; } catch (e) { return false; }
  })();
  const playIntro = !reduceMotion && (!fromInside || (nav && nav.type === 'reload'));

  const introDone = (() => {
    if (!playIntro) { ready(); return Promise.resolve(); }
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
    root.classList.add('lp-intro');

    const intro = make('div', 'fx-intro', `
      <div class="fx-intro__fit"><div class="fx-intro__scene" aria-hidden="true">
        <span class="fx-intro__shadow fx-intro__shadow--laptop"></span>
        <span class="fx-intro__shadow fx-intro__shadow--cup"></span>
        <div class="fx-intro__laptop">
          <div class="fx-intro__lid"><div class="fx-intro__screen"><span class="fx-intro__type"></span><span class="fx-intro__caret"></span></div></div>
          <div class="fx-intro__base"></div>
        </div>
        <div class="fx-intro__cup">
          <span class="fx-intro__stream"></span>
          <svg viewBox="0 0 100 100">
            <defs>
              <clipPath id="fx-intro-clip"><path d="M18 34h56v24a24 24 0 0 1-24 24h-8a24 24 0 0 1-24-24z"/></clipPath>
              <linearGradient id="fx-intro-latte" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stop-color="#f6e2c8"/><stop offset=".2" stop-color="#d2a47b"/><stop offset="1" stop-color="#7a4b33"/>
              </linearGradient>
            </defs>
            <g class="fx-intro__steam" fill="none" stroke="#f2b8c0" stroke-width="2.5" stroke-linecap="round">
              <path d="M36 28c-4-5 4-8 0-14"/><path d="M46 28c-4-5 4-8 0-14"/><path d="M56 28c-4-5 4-8 0-14"/>
            </g>
            <g clip-path="url(#fx-intro-clip)"><rect class="fx-intro__fill" x="14" y="34" width="64" height="52" fill="url(#fx-intro-latte)"/></g>
            <path class="fx-intro__art" d="M46 52c-4-4-10-1-7 4l7 7 7-7c3-5-3-8-7-4z" fill="#fdf6e8"/>
            <path d="M18 34h56v24a24 24 0 0 1-24 24h-8a24 24 0 0 1-24-24z" fill="none" stroke="#f2b8c0" stroke-width="3" stroke-linejoin="round"/>
            <path d="M74 42h6a9 9 0 0 1 0 18h-6" fill="none" stroke="#f2b8c0" stroke-width="3"/>
            <path d="M8 90h84" stroke="#f2b8c0" stroke-width="3" stroke-linecap="round"/>
          </svg>
        </div>
        <span class="fx-intro__desk"></span>
      </div></div>
      <button type="button" class="fx-intro__skip">Skip intro &rsaquo;</button>`);
    const fitBox = $('.fx-intro__fit', intro);
    const typed = $('.fx-intro__type', intro);
    const iCup = $('.fx-intro__cup', intro);
    const iLaptop = $('.fx-intro__laptop', intro);
    document.body.append(intro);
    root.classList.add('fx-intro-lock');
    const fit = () => { fitBox.style.scale = Math.min(1, (window.innerWidth - 32) / 460, (window.innerHeight - 120) / 260).toFixed(3); };
    fit();
    intro.classList.add('fx-intro--play');

    return new Promise((resolve) => {
      const timers = [];
      const at = (ms, fn) => timers.push(setTimeout(fn, ms));
      let finished = false;
      const finish = (fast) => {
        if (finished) return;
        finished = true;
        timers.forEach(clearTimeout);
        root.classList.remove('fx-intro-lock', 'lp-intro', 'lp-splitting');
        ready();
        resolve();
        if (fast) {
          intro.classList.add('fx-intro--out', 'fx-intro--fast');
          setTimeout(() => intro.remove(), 250);
        } else {
          intro.remove(); // the flying cup and laptop sit exactly on the real ones now
        }
      };
      // Fly an intro object onto its twin inside a card (works with the fit scale and the card tilt)
      const flyTo = (el, target) => {
        const a = el.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        if (!a.width || !b.width) return null;
        const k = parseFloat(fitBox.style.scale) || 1;
        const dx = (b.left + b.width / 2 - (a.left + a.width / 2)) / k;
        const dy = (b.top + b.height / 2 - (a.top + a.height / 2)) / k;
        // offsetWidth ignores the card's tilt (the tilted bounding box is a bit wider than the cup itself)
        const s = (target.offsetWidth || b.width) / ((el.offsetWidth * k) || a.width);
        return el.animate([
          { translate: '0 0', scale: '1', rotate: '0deg' },
          { translate: `${(dx * 0.5).toFixed(1)}px ${(dy * 0.5 - 40).toFixed(1)}px`, scale: String(((1 + s) / 2).toFixed(3)), rotate: el === iCup ? '-10deg' : '4deg', offset: 0.5 },
          { translate: `${dx.toFixed(1)}px ${dy.toFixed(1)}px`, scale: String(s.toFixed(3)), rotate: '0deg' },
        ], { duration: 720, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'forwards' });
      };
      // Typing on the laptop screen
      const word = 'lattes.n.laptops';
      [...word].forEach((_, i) => at(960 + i * 22, () => { typed.textContent = word.slice(0, i + 1); }));
      // Split: the scene's background fades, the cards appear, the cup and laptop fly into them
      at(1450, () => {
        intro.classList.add('lp-split');
        root.classList.add('lp-splitting');
        const cupTarget = $('.lp-cup', shopCard);
        const lapTarget = $('.lp-laptop', workCard);
        const flights = [flyTo(iCup, cupTarget), flyTo(iLaptop, lapTarget)].filter(Boolean);
        if (!flights.length) { finish(true); return; }
        Promise.all(flights.map((f) => f.finished)).then(() => finish(false), () => finish(true));
      });
      $('.fx-intro__skip', intro).addEventListener('click', (e) => { e.stopPropagation(); finish(true); });
      intro.addEventListener('click', () => finish(true));
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(true); });
      window.addEventListener('resize', fit);
    });
  })();

  /* ---------- 2. Live content from the admin ---------- */
  const setNote = (which, txt) => {
    const n = $(`[data-landing-note="${which}"]`);
    if (!n) return;
    if (txt) n.textContent = txt; else n.remove();
  };
  getJSON('content/shop.json').then((shop) => {
    const page = shop.page || {};
    if ('landing_note' in page) setNote('shop', page.landing_note);
    const cats = (shop.categories || []).filter((c) => c && c.name);
    const today = new Date().toISOString().slice(0, 10);
    const products = cats.flatMap((c) => (c.products || []).filter((p) => p && p.name && !p.hidden));
    const coupons = products.filter((p) => p.coupon && p.coupon.code && (!p.coupon.expires || String(p.coupon.expires).slice(0, 10) >= today));
    const meta = $('[data-landing-meta="shop"]');
    if (meta && products.length) {
      meta.textContent = `${products.length} picks · ${coupons.length} live coupon${coupons.length === 1 ? '' : 's'} · ${cats.slice(0, 3).map((c) => c.name).join(' · ')}`;
    }
    // Product photos for the snapshots behind the cup (featured first)
    const withImg = [...products.filter((p) => p.featured), ...products.filter((p) => !p.featured)].filter((p) => p.image);
    $$('.lp-snap__img').forEach((box, i) => {
      const p = withImg[i];
      if (!p) return;
      const img = make('img');
      img.alt = '';
      img.src = asset(p.image);
      img.onload = () => box.replaceChildren(img);
    });
  }).catch(() => { /* keep the built-in text */ });

  let screenLines = ['3.8M+ lifetime views', '65+ brands worked with', '7.2% avg. engagement'];
  getJSON('content/portfolio.json').then((pf) => {
    const land = pf.landing || {};
    if ('note' in land) setNote('work', land.note);
    if (Array.isArray(land.screen) && land.screen.filter(Boolean).length) screenLines = land.screen.filter(Boolean);
    const brands = [...(pf.collabs || []), ...(pf.featured_brands || [])].map((b) => b && b.name).filter(Boolean);
    const meta = $('[data-landing-meta="work"]');
    if (meta && brands.length) meta.textContent = brands.slice(0, 4).join(' · ');
  }).catch(() => { /* keep the built-in text */ });

  // Laptop screen: types each stat, holds, then the next one
  const ticker = $('.lp-ticker', workCard);
  if (ticker) {
    let line = 0;
    const typeLine = () => {
      const txt = screenLines[line % screenLines.length];
      line++;
      if (reduceMotion) { ticker.textContent = txt; setTimeout(typeLine, 3000); return; }
      let i = 0;
      const step = () => {
        ticker.textContent = txt.slice(0, ++i);
        if (i < txt.length) setTimeout(step, 38);
        else setTimeout(typeLine, 2200);
      };
      step();
    };
    introDone.then(() => setTimeout(typeLine, 1200));
  }

  /* ---------- 3. Tilt, glow, and phone "wake up" turns ---------- */
  const cards = [shopCard, workCard].filter(Boolean);
  if (!reduceMotion && finePointer) {
    const glow = $('.lp-glow');
    window.addEventListener('pointermove', (e) => {
      if (glow) {
        glow.style.setProperty('--mx', e.clientX + 'px');
        glow.style.setProperty('--my', e.clientY + 'px');
      }
    }, { passive: true });
    cards.forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width - 0.5;
        const ny = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--ry', (nx * 10).toFixed(2) + 'deg');
        card.style.setProperty('--rx', (-ny * 8).toFixed(2) + 'deg');
      });
      card.addEventListener('pointerleave', () => {
        card.style.removeProperty('--ry');
        card.style.removeProperty('--rx');
      });
    });
  } else if (!reduceMotion) {
    // Touch: the cards take turns showing their hover state so it's clear they're alive
    introDone.then(() => {
      let turn = 0;
      let touched = false;
      cards.forEach((c) => c.addEventListener('touchstart', () => {
        touched = true;
        cards.forEach((o) => o.classList.toggle('is-awake', o === c));
      }, { passive: true }));
      const loop = () => {
        if (touched) return;
        if (!document.hidden) cards.forEach((c, i) => c.classList.toggle('is-awake', i === turn % cards.length));
        turn++;
        setTimeout(loop, 2600);
      };
      setTimeout(loop, 900);
    });
  }

  /* ---------- 4. Leaving transitions ---------- */
  const leave = (card, e) => {
    if (reduceMotion || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    const href = card.href;
    const go = () => { window.location.href = href; };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (card.dataset.go === 'pour') {
      const r = $('.lp-cup', card).getBoundingClientRect();
      const x = r.left + r.width / 2;
      const y = r.top + r.height * 0.4;
      const end = Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y)) + 20;
      const layer = make('div', 'lp-leave lp-leave--pour', '<i></i><i></i>');
      document.body.append(layer);
      $('.lp-cup', card).animate({ rotate: ['0deg', '-28deg'] }, { duration: 300, easing: 'ease-out', fill: 'forwards' });
      const [latte, cream] = $$('i', layer);
      const grow = (el, delay) => el.animate(
        [{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(${end}px at ${x}px ${y}px)` }],
        { duration: 620, delay, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'both' });
      grow(latte, 80);
      grow(cream, 260).finished.then(go, go);
    } else {
      const s = $('.lp-screen', card).getBoundingClientRect();
      const layer = make('div', 'lp-leave lp-leave--dive', '<i></i>');
      document.body.append(layer);
      const inset = `inset(${s.top}px ${vw - s.right}px ${vh - s.bottom}px ${s.left}px round 6px)`;
      $('i', layer).animate([{ clipPath: inset }, { clipPath: 'inset(0px 0px 0px 0px round 0px)' }],
        { duration: 600, easing: 'cubic-bezier(.7,0,.3,1)', fill: 'both' }).finished.then(go, go);
    }
    setTimeout(go, 1500); // safety net
  };
  cards.forEach((card) => card.addEventListener('click', (e) => leave(card, e)));
  // Coming back with the browser's Back button: clear the overlay
  window.addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    $$('.lp-leave').forEach((n) => n.remove());
    $$('.lp-cup').forEach((c) => c.getAnimations().forEach((a) => a.cancel()));
  });
})();
