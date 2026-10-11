/* fx.js: interactive layer (animations, micro-interactions, easter eggs, Brew your brief).
   Purely additive: it builds on top of index.html, styles.css and script.js without changing them.
   Remove the <script src="fx.js"> and <link href="fx.css"> lines to switch everything off. */
(() => {
  const root = document.documentElement;
  root.classList.add('fx');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const desktop = window.matchMedia('(min-width: 721px)');

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const make = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const behavior = () => (reduceMotion ? 'auto' : 'smooth');

  // Run cb once script.js's scroll-reveal marks the element visible (adds .in)
  const onReveal = (node, cb) => {
    if (!node) return;
    if (node.classList.contains('in')) { cb(node); return; }
    const mo = new MutationObserver(() => {
      if (node.classList.contains('in')) { mo.disconnect(); cb(node); }
    });
    mo.observe(node, { attributes: true, attributeFilter: ['class'] });
  };

  // Run cb once an element that script.js doesn't track scrolls into view
  const onView = (node, cb, threshold = 0.3) => {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); cb(node); }
    }, { threshold });
    io.observe(node);
  };

  // Give children a --i index so CSS can stagger their animations
  const stagger = (selector) => $$(selector).forEach((n, i) => n.style.setProperty('--i', i));

  // Hearts + lilies flying out from a point (viewport coordinates)
  const burst = (x, y, { hearts = 14, lilies = 4, spread = 0, size = 1 } = {}) => {
    if (reduceMotion) return;
    const fly = (isLily) => {
      const p = isLily ? make('img', 'fx-burst fx-burst--lily') : make('span', 'fx-burst fx-burst--heart', '&#9829;');
      if (isLily) { p.src = 'img/lily.png'; p.alt = ''; }
      p.setAttribute('aria-hidden', 'true');
      p.style.left = x + 'px';
      p.style.top = y + 'px';
      if (size !== 1) {
        const k = size * rand(0.7, 1.4);
        if (isLily) p.style.width = (44 * k).toFixed(0) + 'px'; else p.style.fontSize = (1.2 * k).toFixed(2) + 'rem';
      }
      document.body.append(p);
      const a = rand(0, Math.PI * 2);
      const d = spread ? rand(0.35, 1) * spread : rand(70, isLily ? 190 : 150);
      const dx = Math.cos(a) * d;
      const dy = Math.sin(a) * d - 40;
      p.animate([
        { transform: 'translate(-50%, -50%) scale(.3) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1) rotate(${rand(-160, 160)}deg)`, opacity: 1, offset: 0.6 },
        { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 90}px)) scale(.8) rotate(${rand(-220, 220)}deg)`, opacity: 0 },
      ], { duration: spread ? rand(1500, 2200) : rand(1100, 1600), easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = () => p.remove();
    };
    for (let i = 0; i < hearts; i++) fly(false);
    for (let i = 0; i < lilies; i++) fly(true);
  };

  // Count a number in text like "482K" or "8.4%" up from zero, keeping decimals and suffix
  const countText = (b, duration = 1200) => {
    const m = b.textContent.trim().match(/^([\d.]+)(.*)$/);
    if (!m || reduceMotion) return;
    const target = parseFloat(m[1]);
    const decimals = (m[1].split('.')[1] || '').length;
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      b.textContent = (target * (1 - Math.pow(1 - p, 3))).toFixed(decimals) + m[2];
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  /* ---------- Intro: latte pours, laptop opens, dive into the screen (~2.2s, every page load) ---------- */
  // Skipped only for visitors who prefer reduced motion.
  const introDone = (() => {
    const ready = () => root.classList.add('fx-ready');
    if (reduceMotion) { ready(); return Promise.resolve(); }
    // Start at the top so the intro lands on the hero (unless the URL points at a section)
    if (!window.location.hash) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
    }

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
    const scene = $('.fx-intro__scene', intro);
    const screen = $('.fx-intro__screen', intro);
    const typed = $('.fx-intro__type', intro);
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
        intro.classList.add('fx-intro--out');
        if (fast) intro.classList.add('fx-intro--fast');
        root.classList.remove('fx-intro-lock');
        ready();
        resolve();
        setTimeout(() => intro.remove(), fast ? 250 : 400);
      };
      // Typing on the laptop screen
      const word = 'lattes.n.laptops';
      [...word].forEach((_, i) => at(960 + i * 22, () => { typed.textContent = word.slice(0, i + 1); }));
      // Dive into the screen until it covers the viewport (its background matches the hero)
      at(1400, () => {
        const s = screen.getBoundingClientRect();
        const box = scene.getBoundingClientRect();
        const k = parseFloat(fitBox.style.scale) || 1;
        scene.style.transformOrigin = `${((s.left + s.width / 2 - box.left) / k).toFixed(1)}px ${((s.top + s.height / 2 - box.top) / k).toFixed(1)}px`;
        const zoom = Math.max(window.innerWidth / s.width, window.innerHeight / s.height) * 1.25;
        scene.animate([{ transform: 'scale(1)' }, { transform: `scale(${zoom.toFixed(2)})` }],
          { duration: 560, easing: 'cubic-bezier(.7,0,.84,0)', fill: 'forwards' });
      });
      at(1800, () => finish(false));
      $('.fx-intro__skip', intro).addEventListener('click', (e) => { e.stopPropagation(); finish(true); });
      intro.addEventListener('click', () => finish(true));
      window.addEventListener('keydown', (e) => { if (e.key === 'Escape') finish(true); });
      window.addEventListener('resize', fit);
    });
  })();

  /* ---------- 1. Latte cup scroll progress (click = back to top) ---------- */
  const cup = make('button', 'fx-cup', `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath id="fx-cup-clip"><path d="M14 24h32v14a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14z"/></clipPath>
        <linearGradient id="fx-latte" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#f6e2c8"/><stop offset=".22" stop-color="#d2a47b"/><stop offset="1" stop-color="#7a4b33"/>
        </linearGradient>
      </defs>
      <g class="fx-cup__steam" fill="none" stroke="#f2b8c0" stroke-width="2" stroke-linecap="round">
        <path d="M24 19c-3-3 3-5 0-9"/><path d="M30 19c-3-3 3-5 0-9"/><path d="M36 19c-3-3 3-5 0-9"/>
      </g>
      <g clip-path="url(#fx-cup-clip)"><rect class="fx-cup__fill" x="10" y="52" width="40" height="40" fill="url(#fx-latte)"/></g>
      <path class="fx-cup__art" d="M30 34c-3-3-7-1-5 3l5 5 5-5c2-4-2-6-5-3z" fill="#fdf6e8"/>
      <path d="M14 24h32v14a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14z" fill="none" stroke="#f2b8c0" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M46 28h3a5 5 0 0 1 0 10h-4" fill="none" stroke="#f2b8c0" stroke-width="2.4"/>
      <path d="M10 56h40" stroke="#f2b8c0" stroke-width="2.4" stroke-linecap="round"/>
    </svg>`);
  cup.type = 'button';
  cup.setAttribute('aria-label', 'Back to top');
  document.body.append(cup);
  const cupFill = $('.fx-cup__fill', cup);
  let cupFull = false;
  let cupTicking = false;
  const updateCup = () => {
    cupTicking = false;
    const max = root.scrollHeight - window.innerHeight;
    const p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 1;
    cupFill.setAttribute('y', (52 - p * 28).toFixed(2));
    cup.classList.toggle('show', window.scrollY > 160);
    const full = p > 0.97;
    cup.dataset.label = full ? 'Freshly brewed ♡ back to top' : Math.round(p * 100) + '% brewed';
    if (full && !cupFull && !reduceMotion) {
      cup.animate({ rotate: ['0deg', '-12deg', '10deg', '-6deg', '0deg'] }, { duration: 700, easing: 'ease-out' });
    }
    cupFull = full;
    cup.classList.toggle('fx-cup--full', full);
  };
  window.addEventListener('scroll', () => {
    if (!cupTicking) { cupTicking = true; requestAnimationFrame(updateCup); }
  }, { passive: true });
  window.addEventListener('resize', updateCup);
  cup.addEventListener('click', () => window.scrollTo({ top: 0, behavior: behavior() }));
  updateCup();

  /* ---------- 4. Self-writing signature (CSS does the wipe, this adds the swash) ---------- */
  const heroText = $('.hero__text');
  const heroName = $('.hero__name');
  if (heroName) {
    heroName.insertAdjacentHTML('beforeend',
      '<svg class="fx-swash" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="M4 17C60 5 118 25 178 12S270 6 296 13" pathLength="1"/></svg>');
  }

  /* ---------- 5. Typewriter tagline ---------- */
  const tag = $('.hero__tag');
  if (tag && !reduceMotion) {
    const text = tag.textContent.trim();
    tag.classList.add('fx-type');
    tag.textContent = '';
    const ghost = make('span', 'fx-type__ghost');
    ghost.textContent = text; // keeps the layout and is what screen readers read
    const live = make('span', 'fx-type__live');
    live.setAttribute('aria-hidden', 'true');
    const typed = document.createTextNode('');
    const caret = make('span', 'fx-type__caret');
    live.append(typed, caret);
    tag.append(ghost, live);
    const type = (i = 0) => {
      typed.data = text.slice(0, i);
      if (i >= text.length) { tag.classList.add('fx-type--done'); return; }
      const ch = text[i];
      setTimeout(() => type(i + 1), /[:,.]/.test(ch) ? 260 : rand(18, 42));
    };
    onReveal(heroText, () => introDone.then(() => setTimeout(type, 1700)));
  }

  /* ---------- "CREATIVE PORTFOLIO": letters stamp in one by one (CSS reads --i) ---------- */
  const h1 = $('.hero h1');
  if (h1 && !reduceMotion) {
    h1.setAttribute('aria-label', h1.textContent.trim().replace(/\s+/g, ' '));
    let n = 0;
    $$('span', h1).forEach((word) => {
      const text = word.textContent;
      word.textContent = '';
      word.setAttribute('aria-hidden', 'true');
      [...text].forEach((ch) => {
        const l = make('span', 'fx-l');
        l.textContent = ch;
        l.style.setProperty('--i', n++);
        word.append(l);
      });
    });
    h1.classList.add('fx-split');
  }

  /* ---------- Hero photo develops like an instant photo after the intro ---------- */
  const heroImg = $('.hero__img');
  if (heroImg && !reduceMotion) {
    const dev = heroImg.animate([
      { filter: 'grayscale(1) sepia(.5) brightness(1.4) contrast(.55) blur(1.5px)' },
      { filter: 'grayscale(.4) sepia(.6) brightness(1.15) contrast(.85) blur(.4px)', offset: 0.5 },
      { filter: 'none' },
    ], { duration: 2800, easing: 'ease-in-out' });
    dev.pause();
    introDone.then(() => dev.play());
  }

  /* ---------- Hero: polaroid tilt + glare, lily parallax, falling petals ---------- */
  const hero = $('.hero');
  const heroPolaroid = $('.hero .polaroid');
  if (hero && heroPolaroid && !reduceMotion) {
    heroPolaroid.classList.add('fx-tilt');
    const lilies = $$('.hero .lily').map((l) => ({
      el: l,
      depth: l.classList.contains('lily--hero-b') ? -20 : l.classList.contains('lily--hero-a') ? 14 : 10,
    }));
    let raf = 0;
    const tilt = (nx, ny) => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        heroPolaroid.style.setProperty('--fx-rx', (-ny * 8).toFixed(2) + 'deg');
        heroPolaroid.style.setProperty('--fx-ry', (nx * 10).toFixed(2) + 'deg');
        heroPolaroid.style.setProperty('--fx-gx', (50 + nx * 45).toFixed(1) + '%');
        heroPolaroid.style.setProperty('--fx-gy', (40 + ny * 45).toFixed(1) + '%');
        lilies.forEach(({ el, depth }) => { el.style.translate = `${(nx * depth).toFixed(1)}px ${(ny * depth).toFixed(1)}px`; });
      });
    };
    if (finePointer) {
      hero.addEventListener('pointermove', (e) => {
        const r = heroPolaroid.getBoundingClientRect();
        tilt(clamp((e.clientX - (r.left + r.width / 2)) / (r.width * 0.8), -1, 1),
             clamp((e.clientY - (r.top + r.height / 2)) / (r.height * 0.8), -1, 1));
      });
      hero.addEventListener('pointerleave', () => tilt(0, 0));
    } else {
      // Phones, 1) finger: tilt follows your finger on the photo (always works, doesn't block scrolling)
      const frame = heroPolaroid;
      const fromTouch = (t) => {
        const r = frame.getBoundingClientRect();
        tilt(clamp((t.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1),
             clamp((t.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1));
      };
      frame.addEventListener('touchstart', (e) => fromTouch(e.touches[0]), { passive: true });
      frame.addEventListener('touchmove', (e) => fromTouch(e.touches[0]), { passive: true });
      frame.addEventListener('touchend', () => tilt(0, 0), { passive: true });
      frame.addEventListener('touchcancel', () => tilt(0, 0), { passive: true });

      // Phones, 2) motion: tilt with the device where the browser allows it without asking
      // (Android on https). iPhones require a permission popup, so they just use finger tilt.
      let base = null;
      let sx = 0;
      let sy = 0;
      const onTilt = (e) => {
        if (e.gamma == null || e.beta == null || window.scrollY > hero.offsetHeight) return;
        if (!base) base = { g: e.gamma, b: e.beta }; // however the phone is held at first counts as "flat"
        sx += (clamp((e.gamma - base.g) / 25, -1, 1) - sx) * 0.25; // smooth out sensor jitter
        sy += (clamp((e.beta - base.b) / 25, -1, 1) - sy) * 0.25;
        tilt(sx, sy);
      };
      const listen = () => window.addEventListener('deviceorientation', onTilt, { passive: true });
      if (window.isSecureContext && 'DeviceOrientationEvent' in window
          && typeof DeviceOrientationEvent.requestPermission !== 'function') listen();
      // Re-centre after rotating the phone
      window.addEventListener('orientationchange', () => { base = null; });
    }

    // Occasional lily petal drifting down the hero
    let heroVisible = true;
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe(hero);
    const petal = () => {
      if (heroVisible && !document.hidden) {
        const p = make('span', 'fx-petal');
        p.setAttribute('aria-hidden', 'true');
        const size = rand(10, 18);
        const h = hero.clientHeight;
        p.style.cssText = `left:${rand(5, 95)}%;width:${size}px;height:${size * 1.4}px`;
        hero.append(p);
        const sway = rand(40, 120) * (Math.random() < 0.5 ? -1 : 1);
        p.animate([
          { transform: 'translate(0, -30px) rotate(0deg)', opacity: 0 },
          { opacity: 0.85, offset: 0.1 },
          { transform: `translate(${sway * 0.5}px, ${h * 0.5}px) rotate(${rand(120, 240)}deg)`, offset: 0.5 },
          { transform: `translate(${sway}px, ${h + 30}px) rotate(${rand(300, 480)}deg)`, opacity: 0 },
        ], { duration: rand(7000, 11000), easing: 'linear' }).onfinish = () => p.remove();
      }
      setTimeout(petal, rand(1800, 3800));
    };
    setTimeout(petal, 1500);
  }

  /* ---------- Charms: keychain swing; double-tap the heart (or the photo) = Instagram-style like ---------- */
  const swing = (c) => {
    if (reduceMotion) return;
    c.animate({ rotate: ['0deg', '22deg', '-16deg', '10deg', '-5deg', '0deg'] }, { duration: 1000, easing: 'ease-out' });
  };
  $$('.hero .charm').forEach((c) => {
    c.addEventListener('pointerenter', () => swing(c));
    c.addEventListener('click', () => swing(c));
  });
  // The like: a soft pink flash and a full-screen burst of lilies
  const LIKED = 'fx-liked';
  let liked = false;
  try { liked = localStorage.getItem(LIKED) === '1'; } catch (e) { /* storage blocked */ }
  const likePhoto = () => {
    liked = true;
    try { localStorage.setItem(LIKED, '1'); } catch (e) { /* storage blocked */ }
    if (reduceMotion) return;
    const flash = make('span', 'fx-like-flash');
    flash.setAttribute('aria-hidden', 'true');
    document.body.append(flash);
    flash.animate([{ opacity: 0 }, { opacity: 1, offset: 0.3 }, { opacity: 0 }], { duration: 1100, easing: 'ease-out' }).onfinish = () => flash.remove();
    burst(window.innerWidth / 2, window.innerHeight / 2, { hearts: 0, lilies: 24, spread: Math.max(window.innerWidth, window.innerHeight) * 0.55, size: 1.8 });
  };

  // Discoverability: the heart "taps itself" twice (double heartbeat + two ripples) every few seconds
  const heart = $('.charm--heart');
  const tapHint = make('span', 'fx-tap-hint', '<i></i><i></i>');
  tapHint.setAttribute('aria-hidden', 'true');
  if (heart) heart.after(tapHint);
  const doubleBeat = (beats = 2) => {
    if (reduceMotion || !heart) return;
    const frames = [{ scale: '1' }];
    for (let b = 0; b < beats; b++) frames.push({ scale: '1.3' }, { scale: '1' });
    heart.animate(frames, { duration: beats * 260, easing: 'ease-out' });
    tapHint.classList.remove('fx-tapping', 'fx-tapping--once');
    void tapHint.offsetWidth;
    tapHint.classList.add(beats > 1 ? 'fx-tapping' : 'fx-tapping--once');
  };
  if (heart && hero && !reduceMotion) {
    let heroInView = true;
    new IntersectionObserver(([e]) => { heroInView = e.isIntersecting; }).observe(hero);
    introDone.then(() => {
      const loop = () => {
        if (liked) return;
        if (heroInView && !document.hidden) doubleBeat(2);
        setTimeout(loop, 5000);
      };
      setTimeout(loop, 4500);
    });
  }

  const onDoubleTap = (el, fn, onFirst) => {
    let last = 0;
    el.addEventListener('click', () => {
      const now = performance.now();
      if (now - last < 450) { last = 0; fn(); } else { last = now; if (onFirst) onFirst(); }
    });
  };
  // First tap on the heart gives a single beat, as if waiting for the second tap
  if (heart) onDoubleTap(heart, likePhoto, () => doubleBeat(1));
  if (heroPolaroid) onDoubleTap(heroPolaroid, likePhoto);

  /* ---------- About polaroids: drop in, draggable (mouse/pen), tap = jiggle ---------- */
  const strip = $('.about__strip');
  if (strip) {
    const polaroids = $$('.polaroid', strip);
    onReveal(strip, () => {
      if (reduceMotion) return;
      polaroids.forEach((p, i) => p.animate([
        { translate: '0 -90px', rotate: '-12deg', opacity: 0 },
        { translate: '0 8px', rotate: '4deg', opacity: 1, offset: 0.65 },
        { translate: '0 -3px', rotate: '-2deg', offset: 0.85 },
        { translate: '0 0', rotate: '0deg', opacity: 1 },
      ], { duration: 900, delay: 150 + i * 180, easing: 'ease-out', fill: 'backwards' }));
    });
    polaroids.forEach((p) => {
      p.classList.add('fx-drag');
      let sx = 0;
      let sy = 0;
      let dragging = false;
      p.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') {
          if (!reduceMotion) p.animate({ rotate: ['0deg', '-5deg', '4deg', '-2deg', '0deg'] }, { duration: 500 });
          return;
        }
        dragging = true;
        sx = e.clientX;
        sy = e.clientY;
        p.setPointerCapture(e.pointerId);
        p.classList.add('fx-dragging');
        e.preventDefault();
      });
      p.addEventListener('pointermove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        p.style.translate = `${dx}px ${dy}px`;
        p.style.rotate = `${clamp(dx / 12, -12, 12)}deg`;
      });
      const drop = () => {
        if (!dragging) return;
        dragging = false;
        p.classList.remove('fx-dragging');
        const from = { translate: p.style.translate, rotate: p.style.rotate };
        p.style.translate = '';
        p.style.rotate = '';
        if (from.translate && !reduceMotion) p.animate([from, { translate: '0 0', rotate: '0deg' }], { duration: 650, easing: 'cubic-bezier(.3,1.5,.5,1)' });
      };
      p.addEventListener('pointerup', drop);
      p.addEventListener('pointercancel', drop);
    });
  }

  /* ---------- Staggered pop-ins (CSS reads --i) ---------- */
  stagger('.chips li');
  stagger('.services__list li');
  stagger('.quotes blockquote');
  stagger('.cases .case');
  stagger('.facts li');
  stagger('.services__tiles img');
  $$('.brands').forEach((list) => $$('li', list).forEach((li, i) => li.style.setProperty('--i', i)));

  /* ---------- Count-ups for numbers that were static text ---------- */
  onReveal($('.cases'), () => setTimeout(() => $$('.case__result b').forEach((b) => countText(b, 1400)), 500));
  const facts = $('.facts');
  if (facts) onReveal(facts.closest('.reveal'), () => $$('b', facts).forEach((b) => countText(b)));

  /* ---------- Collaborate pill (and mobile menu button) pulses once past halfway ---------- */
  const pulseTargets = $$('.nav__cta, .nav__toggle');
  const collabSection = $('#collaborate');
  if (pulseTargets.length && collabSection && !reduceMotion) {
    let collabVisible = false;
    new IntersectionObserver(([e]) => { collabVisible = e.isIntersecting; }, { threshold: 0.15 }).observe(collabSection);
    let pulseTicking = false;
    const updatePulse = () => {
      pulseTicking = false;
      const max = root.scrollHeight - window.innerHeight;
      const on = max > 0 && window.scrollY / max > 0.5 && !collabVisible;
      pulseTargets.forEach((t) => t.classList.toggle('fx-pulse', on));
    };
    window.addEventListener('scroll', () => {
      if (!pulseTicking) { pulseTicking = true; requestAnimationFrame(updatePulse); }
    }, { passive: true });
  }

  /* ---------- Footer: name writes itself, tiny steaming latte ---------- */
  const footer = $('.footer');
  if (footer) {
    const sig = $('.script', footer);
    if (sig) {
      sig.insertAdjacentHTML('beforeend',
        '<svg class="fx-mini-cup" viewBox="0 0 40 40" aria-hidden="true">' +
        '<g class="fx-mini-cup__steam" fill="none" stroke="#f2b8c0" stroke-width="2" stroke-linecap="round"><path d="M15 13c-2-3 2-4 0-8"/><path d="M21 13c-2-3 2-4 0-8"/></g>' +
        '<path d="M8 16h22v8a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9z" fill="#d2a47b" stroke="#f2b8c0" stroke-width="2"/>' +
        '<path d="M30 19h2a3.5 3.5 0 0 1 0 7h-2" fill="none" stroke="#f2b8c0" stroke-width="2"/></svg>');
    }
    onView(footer, () => footer.classList.add('fx-in'), 0.4);
  }

  /* ---------- Reels: fan out like playing cards + hover stat badges ---------- */
  // [EDIT] Badge text per reel, keyed by the reel ID in data-href. Numbers are taken from the case studies.
  const REEL_BADGES = {
    DeEVNDdIEDq: 'Navratri campaign · 310K views',
    DeBxMXqMmjm: 'Navratri campaign · 310K views',
    Dd1JlD7KV6T: 'Lotus WhiteGlow · 482K views',
    DdoRzj2hnwi: 'Lace series · 275K views',
  };
  const phones = $('#phones');
  if (phones) {
    const figs = $$('.phone', phones);
    figs.forEach((fig) => {
      const id = (fig.dataset.href || '').match(/reel\/([^/?]+)/);
      const text = id && REEL_BADGES[id[1]] ? REEL_BADGES[id[1]]
        : fig.dataset.href ? 'Watch on Instagram ↗' : 'Coming soon';
      const badge = make('span', 'fx-badge');
      badge.textContent = text;
      badge.setAttribute('aria-hidden', 'true');
      fig.append(badge);
    });
    onReveal(phones.closest('.carousel'), () => {
      if (reduceMotion || !desktop.matches) return;
      const box = phones.getBoundingClientRect();
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      figs.forEach((fig, i) => {
        const r = fig.getBoundingClientRect();
        fig.style.setProperty('--fx-dx', (cx - (r.left + r.width / 2)).toFixed(0) + 'px');
        fig.style.setProperty('--fx-dy', (cy - (r.top + r.height / 2)).toFixed(0) + 'px');
        fig.style.setProperty('--fx-rot', ((i - (figs.length - 1) / 2) * 6).toFixed(1) + 'deg');
        fig.style.setProperty('--fx-delay', (i * 70) + 'ms');
      });
      phones.classList.add('fx-fan');
    });
  }

  /* ---------- Donut chart: label in the hollow; hover (mouse) or tap (touch) a slice or legend item ---------- */
  const donut = $('.donut');
  if (donut) {
    const svg = $('.donut__svg', donut);
    const segs = $$('.donut__seg', donut);
    const keys = $$('figcaption span', donut);
    const tip = make('div', 'fx-tip');
    tip.setAttribute('aria-hidden', 'true');
    donut.append(tip);
    // SVG elements have no offsetLeft/offsetTop, so measure with rects to centre the label in the hole
    const centreTip = () => {
      const d = donut.getBoundingClientRect();
      const r = svg.getBoundingClientRect();
      tip.style.left = (r.left - d.left + r.width / 2).toFixed(1) + 'px';
      tip.style.top = (r.top - d.top + r.height / 2).toFixed(1) + 'px';
      // clientWidth ignores rotation (the spun wheel's bounding box is wider than the chart itself)
      tip.style.setProperty('--fx-hole', ((svg.clientWidth || r.width) * 0.54).toFixed(0) + 'px');
    };
    let active = -1; // -1 = idle: the label shows the largest group, no slice pulled out
    let sticky = false; // a tap keeps the selection until tapping again or elsewhere
    const touch = window.matchMedia('(pointer: coarse)').matches;
    let stopCycle = () => {};
    const buzz = () => { if (navigator.vibrate) navigator.vibrate(8); };
    let dots = null;
    let lastRot = 0;
    const focus = (i) => {
      segs.forEach((s, j) => {
        const on = j === i;
        const a = ((+s.dataset.offset + +s.dataset.pct / 2) / 100) * Math.PI * 2;
        s.style.transform = on ? `translate(${(Math.cos(a) * 1.2).toFixed(2)}px, ${(Math.sin(a) * 1.2).toFixed(2)}px)` : '';
        s.classList.toggle('fx-on', on);
        if (keys[j]) keys[j].classList.toggle('fx-on', on);
      });
      donut.classList.toggle('fx-has-on', i >= 0);
      const key = keys[i >= 0 ? i : 0];
      if (key) {
        const label = key.textContent.trim();
        const cut = label.lastIndexOf(' ');
        tip.innerHTML = `<b>${esc(label.slice(cut + 1))}</b><span>${esc(label.slice(0, cut))}</span>`;
      }
      centreTip();
      active = i;
      if (touch) {
        // Spin the wheel so the selected slice sits at the top (shortest way round)
        const k = i >= 0 ? i : 0;
        const mid = (+segs[k].dataset.offset + +segs[k].dataset.pct / 2) * 3.6;
        let rot = -mid;
        while (rot - lastRot > 180) rot -= 360;
        while (rot - lastRot < -180) rot += 360;
        lastRot = rot;
        svg.style.rotate = rot.toFixed(1) + 'deg';
        if (dots) $$('i', dots).forEach((d, j) => d.classList.toggle('fx-on', j === k));
      }
    };
    onReveal(donut, () => setTimeout(() => { focus(-1); tip.classList.add('show'); }, reduceMotion ? 0 : 900));
    [segs, keys].forEach((list) => list.forEach((n, i) => {
      n.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !sticky) focus(i); });
      n.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !sticky) focus(-1); });
      n.addEventListener('click', (e) => {
        if (e.pointerType === 'mouse') return;
        e.stopPropagation();
        stopCycle();
        buzz();
        if (sticky && active === i) { sticky = false; focus(-1); } else { sticky = true; focus(i); }
      });
    }));
    document.addEventListener('click', (e) => {
      if (sticky && !donut.contains(e.target)) { sticky = false; focus(-1); }
    });
    window.addEventListener('resize', centreTip);

    if (touch) {
      donut.classList.add('fx-donut-touch');
      dots = make('div', 'fx-donut-dots', segs.map(() => '<i></i>').join(''));
      dots.setAttribute('aria-hidden', 'true');
      donut.append(dots);
      const step = (dir) => {
        const cur = active >= 0 ? active : 0;
        sticky = true;
        focus((cur + dir + segs.length) % segs.length);
      };
      // Auto-tour: cycles through the countries while the chart is on screen, until the visitor touches it
      let cycle = null;
      let toured = false;
      let inView = false;
      stopCycle = () => { toured = true; clearInterval(cycle); cycle = null; };
      if (!reduceMotion) {
        new IntersectionObserver(([e]) => {
          inView = e.isIntersecting;
          if (inView && !cycle && !toured) {
            cycle = setInterval(() => {
              if (!document.hidden) focus(((active >= 0 ? active : 0) + 1) % segs.length);
            }, 2200);
          } else if (!inView && cycle) { clearInterval(cycle); cycle = null; }
        }, { threshold: 0.5 }).observe(donut);
      }
      // Swipe the chart left/right to step through the slices
      let sx = null;
      let sy = 0;
      svg.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }, { passive: true });
      svg.addEventListener('touchend', (e) => {
        if (sx == null) return;
        const dx = e.changedTouches[0].clientX - sx;
        const dy = e.changedTouches[0].clientY - sy;
        sx = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) { stopCycle(); buzz(); step(dx < 0 ? 1 : -1); }
      }, { passive: true });
    }
  }

  /* ---------- Lace trim stitches in when each lace edge scrolls into view ---------- */
  $$('.lace-edge').forEach((sec) => {
    const s = make('span', 'fx-lace-sentinel');
    s.setAttribute('aria-hidden', 'true');
    sec.append(s);
    onView(s, () => sec.classList.add('fx-stitched'), 0.5);
  });

  /* ---------- 3. Performance receipt ---------- */
  const pills = $('.perf .pills');
  if (pills) {
    const lines = $$('li', pills).map((li) => {
      const b = $('b', li);
      const value = parseFloat(b.dataset.count).toFixed(parseInt(b.dataset.decimals || '0', 10)) + (b.dataset.suffix || '');
      return `<li><span>${esc($('span', li).textContent.trim())}</span><b>${esc(value)}</b></li>`;
    }).join('');
    const date = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    const wrap = make('div', 'fx-print', `
      <div class="fx-slot" aria-hidden="true"></div>
      <div class="fx-paper">
        <div class="fx-receipt" role="group" aria-label="Performance receipt">
          <p class="fx-receipt__head">Lattes.n.laptops Caf&eacute;</p>
          <p class="fx-receipt__meta">Performance receipt &middot; ${esc(date)}</p>
          <ul>${lines}</ul>
          <p class="fx-receipt__total"><span>Vibes</span><b>Immaculate</b></p>
          <p class="fx-receipt__thanks">Thank you for scrolling &#9825;</p>
          <div class="fx-receipt__barcode" aria-hidden="true"></div>
        </div>
      </div>`);
    pills.after(wrap);
    onView(wrap, () => wrap.classList.add('fx-printing'), 0.25);
  }

  /* ---------- 2. Brew your brief: café-style order builder that fills in the form ---------- */
  const form = $('#contact-form');
  const BREW = [
    { key: 'base', label: 'Pick your base', multi: false, options: [
      ['UGC Video', 'the signature espresso'], ['UGC Photos', 'a flat white'],
      ['Voiceover Review', 'the cold brew'], ['Instagram Reels', 'an iced latte'],
    ] },
    { key: 'flavour', label: 'Add flavour (pick any)', multi: true, options: [
      ['GRWM', 'vanilla'], ['Unboxing', 'caramel'], ['Before / After', 'hazelnut'],
      ['Talking-head', 'mocha'], ['Product demo', 'cinnamon'], ['Lifestyle integration', 'oat milk'],
    ] },
    { key: 'vibe', label: 'Choose the vibe', multi: false, options: [
      ['Pinterest-girl', 'rose latte'], ['Corporate-chic', 'americano'],
      ['Festive', 'masala chai'], ['Coffee-shop / WFH', 'cappuccino'],
    ] },
    { key: 'size', label: 'Size', multi: false, options: [
      ['1 reel', 'single shot'], ['3-reel bundle', 'doppio'], ['Monthly retainer', 'bottomless cup'],
    ] },
  ];
  if (form) {
    const groups = BREW.map((g, gi) => `
      <fieldset class="fx-menu__group">
        <legend>0${gi + 1} &middot; ${esc(g.label)}</legend>
        <div class="fx-menu__opts">
          ${g.options.map(([name, alias]) => `<button type="button" class="fx-opt" aria-pressed="false" data-group="${g.key}" data-value="${esc(name)}"><b>${esc(name)}</b><i>${esc(alias)}</i></button>`).join('')}
        </div>
      </fieldset>`).join('');
    const brew = make('div', 'fx-brew', `
      <button type="button" class="fx-brew__open" aria-expanded="false" aria-controls="fx-brew-panel">
        <span aria-hidden="true">&#9749;</span> Not sure what to ask for? <u>Brew your brief</u>
      </button>
      <div class="fx-brew__panel" id="fx-brew-panel" hidden>
        <div class="fx-menu">
          <p class="fx-menu__title">Avni's Content Caf&eacute;</p>
          <p class="fx-menu__sub">Build your order and I'll put it in the form for you</p>
          ${groups}
          <p class="fx-menu__hint" role="status" aria-live="polite"></p>
          <button type="button" class="fx-menu__print">Print my order</button>
        </div>
        <div class="fx-order" hidden>
          <div class="fx-slot" aria-hidden="true"></div>
          <div class="fx-paper"><div class="fx-receipt fx-ticket" role="group" aria-label="Your order"></div></div>
          <div class="fx-order__actions">
            <button type="button" class="fx-order__use">Use this order &darr;</button>
            <button type="button" class="fx-order__reset">Start over</button>
          </div>
        </div>
      </div>`);
    form.before(brew);

    const openBtn = $('.fx-brew__open', brew);
    const panel = $('.fx-brew__panel', brew);
    const hint = $('.fx-menu__hint', brew);
    const order = $('.fx-order', brew);
    const ticket = $('.fx-ticket', brew);
    const opts = $$('.fx-opt', brew);
    const picked = (key) => opts.filter((o) => o.dataset.group === key && o.getAttribute('aria-pressed') === 'true').map((o) => o.dataset.value);

    openBtn.addEventListener('click', () => {
      const open = panel.hidden;
      panel.hidden = !open;
      openBtn.setAttribute('aria-expanded', String(open));
    });

    opts.forEach((o) => o.addEventListener('click', () => {
      const g = BREW.find((x) => x.key === o.dataset.group);
      const on = o.getAttribute('aria-pressed') !== 'true';
      if (!g.multi) opts.filter((x) => x.dataset.group === g.key).forEach((x) => x.setAttribute('aria-pressed', 'false'));
      o.setAttribute('aria-pressed', String(on));
      hint.textContent = '';
    }));

    let message = '';
    $('.fx-menu__print', brew).addEventListener('click', () => {
      const base = picked('base')[0];
      const size = picked('size')[0];
      if (!base || !size) {
        hint.textContent = 'Pick at least a base and a size ☕';
        return;
      }
      const flavours = picked('flavour');
      const vibe = picked('vibe')[0];
      const sizeAlias = BREW[3].options.find(([n]) => n === size)[1];
      const now = new Date();
      const no = String(Math.floor(1000 + Math.random() * 9000));
      const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      ticket.innerHTML = `
        <p class="fx-receipt__head">Avni's Content Caf&eacute;</p>
        <p class="fx-receipt__meta">Order #${no} &middot; ${esc(time)}</p>
        <ul>
          <li><span>${esc(base)}</span><b>x1</b></li>
          ${flavours.map((f) => `<li class="fx-sub"><span>+ ${esc(f)}</span><b>&#9825;</b></li>`).join('')}
          ${vibe ? `<li><span>Vibe</span><b>${esc(vibe)}</b></li>` : ''}
          <li><span>Size</span><b>${esc(size)}</b></li>
          <li class="fx-sub"><span>(${esc(sizeAlias)})</span><b></b></li>
          <li><span>Zero fluff</span><b>Free</b></li>
          <li><span>Scroll-stopping hook</span><b>Free</b></li>
        </ul>
        <p class="fx-receipt__thanks">Served with love by Avni &#9825;</p>
        <div class="fx-receipt__barcode" aria-hidden="true"></div>`;
      message = "Hi Avni! Here's my order from the Content Café:\n"
        + `- Content: ${base}\n`
        + (flavours.length ? `- Flavours: ${flavours.join(', ')}\n` : '')
        + (vibe ? `- Vibe: ${vibe}\n` : '')
        + `- Size: ${size}\n`;
      order.hidden = false;
      order.classList.remove('fx-printing');
      void order.offsetWidth; // restart the print animation
      order.classList.add('fx-printing');
      order.scrollIntoView({ behavior: behavior(), block: 'nearest' });
    });

    $('.fx-order__use', brew).addEventListener('click', () => {
      const ta = form.elements.message;
      const rest = ta.value.replace(/^Hi Avni! Here's my order[\s\S]*?- Size: .*\n\n?/, '');
      ta.value = message + '\n' + rest;
      ta.removeAttribute('aria-invalid');
      ta.dispatchEvent(new Event('input', { bubbles: true }));
      const first = form.elements.name.value.trim() ? ta : form.elements.name;
      form.scrollIntoView({ behavior: behavior(), block: 'start' });
      first.focus({ preventScroll: true });
      if (!reduceMotion) ta.animate({ boxShadow: ['0 0 0 0 rgba(242,184,192,.9)', '0 0 0 10px rgba(242,184,192,0)'] }, { duration: 900 });
    });

    $('.fx-order__reset', brew).addEventListener('click', () => {
      opts.forEach((o) => o.setAttribute('aria-pressed', 'false'));
      order.hidden = true;
      hint.textContent = '';
      opts[0].focus();
    });
  }

  /* ---------- Contact form: envelope + wax seal on send, shake when invalid ---------- */
  // script.js registers its submit handler first, so validation (aria-invalid) is already set here
  if (form) {
    form.addEventListener('submit', () => {
      if (reduceMotion) return;
      if (form.querySelector('[aria-invalid="true"]')) {
        form.animate({ translate: ['0', '-10px', '9px', '-6px', '4px', '0'] }, { duration: 420, easing: 'ease-out' });
        return;
      }
      if (form.classList.contains('fx-sending')) return;
      const env = make('div', 'fx-env', `
        <div class="fx-env__back"></div>
        <div class="fx-env__flap"></div>
        <div class="fx-env__letter"><span>Hi Avni &#9825;</span><i></i><i></i><i></i></div>
        <div class="fx-env__front"></div>
        <div class="fx-env__seal">&#9829;</div>`);
      env.setAttribute('aria-hidden', 'true');
      form.classList.add('fx-sending');
      form.append(env);
      [[30, 's1'], [750, 's2'], [1250, 's3'], [2000, 's4']].forEach(([t, c]) => setTimeout(() => env.classList.add(c), t));
      setTimeout(() => {
        const r = env.getBoundingClientRect();
        burst(r.left + r.width / 2, r.top + r.height * 0.6, { hearts: 10, lilies: 5 });
      }, 1400);
      setTimeout(() => { env.remove(); form.classList.remove('fx-sending'); }, 3000);
    });
  }

  /* ---------- Espresso mode (dark theme toggle, remembered) ---------- */
  const navLinks = $('#nav-links');
  if (navLinks) {
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
    set(saved !== '0', false); // Espresso is the default; only an explicit switch to latte is remembered as off
    btn.addEventListener('click', () => set(!root.classList.contains('fx-espresso'), true));
    navLinks.append(btn);
  }

  /* ---------- Custom cursor with milk-foam trail (desktop mouse only) ---------- */
  if (finePointer && !reduceMotion) {
    const ring = make('div', 'fx-cursor');
    ring.setAttribute('aria-hidden', 'true');
    document.body.append(ring);
    let x = -100;
    let y = -100;
    let cx = x;
    let cy = y;
    let lastFoam = 0;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      ring.classList.add('on');
      const t = e.target.closest && e.target.closest('.phone, a, button, [role="link"], input, textarea, label, .charm, .fx-drag');
      const isPhone = !!t && t.classList.contains('phone');
      ring.classList.toggle('fx-cursor--play', isPhone);
      ring.classList.toggle('fx-cursor--hover', !!t && !isPhone);
      const now = performance.now();
      if (now - lastFoam > 50) {
        lastFoam = now;
        const f = make('span', 'fx-foam');
        f.style.left = x + 'px';
        f.style.top = y + 'px';
        document.body.append(f);
        f.animate([
          { transform: 'translate(-50%, -50%) scale(.5)', opacity: 0.6 },
          { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 0 },
        ], { duration: 700, easing: 'ease-out' }).onfinish = () => f.remove();
      }
    }, { passive: true });
    document.addEventListener('mouseleave', () => ring.classList.remove('on'));
    const follow = () => {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      ring.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      requestAnimationFrame(follow);
    };
    follow();
  }

  /* ---------- Navbar: milk-foam blob under the current section's link (desktop) ---------- */
  const nav = $('.nav');
  const navHeight = () => (nav ? nav.offsetHeight : 0);
  if (navLinks) {
    const targets = $$('a[href^="#"]', navLinks)
      .map((a) => ({ a, sec: document.getElementById(a.getAttribute('href').slice(1)) }))
      .filter((t) => t.sec);
    const blob = make('span', 'fx-foam-blob', '<i></i><i></i><i></i>');
    blob.setAttribute('aria-hidden', 'true');
    navLinks.append(blob);
    let current = null; // link for the section in view
    let shown = null; // link the blob is under right now (current, or the hovered one)
    let lastLeft = null;

    const place = (a, force) => {
      if (!desktop.matches) return;
      if (a === shown && !force) return;
      shown = a;
      if (!a) { blob.classList.remove('on'); return; }
      const box = navLinks.getBoundingClientRect();
      const r = a.getBoundingClientRect();
      const w = r.width * (a.classList.contains('nav__cta') ? 0.6 : 0.8);
      const left = r.left - box.left + (r.width - w) / 2;
      const right = box.right - r.right + (r.width - w) / 2;
      const appearing = !blob.classList.contains('on') || force;
      // Leading edge moves first and the trailing edge catches up, so it stretches like liquid
      const goingRight = lastLeft != null && left > lastLeft;
      blob.style.setProperty('--dl', appearing ? '0s' : goingRight ? '.12s' : '0s');
      blob.style.setProperty('--dr', appearing ? '0s' : goingRight ? '0s' : '.12s');
      if (appearing) blob.classList.add('fx-snap');
      blob.style.setProperty('--l', left.toFixed(1) + 'px');
      blob.style.setProperty('--r', right.toFixed(1) + 'px');
      if (appearing) { void blob.offsetWidth; blob.classList.remove('fx-snap'); }
      lastLeft = left;
      blob.classList.add('on');
      if (!reduceMotion && !appearing) {
        blob.classList.remove('fx-squish');
        void blob.offsetWidth;
        blob.classList.add('fx-squish');
      }
    };

    const pickSection = () => {
      const y = window.scrollY + window.innerHeight * 0.35;
      const atBottom = window.scrollY + window.innerHeight >= root.scrollHeight - 4;
      let found = null;
      [...targets].sort((x, z) => x.sec.offsetTop - z.sec.offsetTop).forEach((t) => {
        if (t.sec.offsetTop - navHeight() <= y) found = t.a;
      });
      if (atBottom && targets.length) found = targets.find((t) => t.sec.id === 'collaborate')?.a || found;
      if (found !== current) {
        targets.forEach((t) => {
          t.a.classList.toggle('fx-active', t.a === found);
          if (t.a === found) t.a.setAttribute('aria-current', 'location'); else t.a.removeAttribute('aria-current');
        });
        current = found;
      }
      if (!navLinks.matches(':hover')) place(current);
    };
    let navTicking = false;
    window.addEventListener('scroll', () => {
      if (!navTicking) { navTicking = true; requestAnimationFrame(() => { navTicking = false; pickSection(); }); }
    }, { passive: true });
    window.addEventListener('resize', () => { place(shown, true); pickSection(); });
    // Hover preview: the foam follows the pointer, then flows back to the current section
    targets.forEach((t) => t.a.addEventListener('pointerenter', () => place(t.a)));
    navLinks.addEventListener('pointerleave', () => place(current));
    pickSection();
  }

  /* ---------- Phones: charm-bracelet scroll indicator (drag the heart, tap a charm to jump) ---------- */
  if (window.matchMedia('(pointer: coarse)').matches) {
    const svg = (inner) => `<svg viewBox="0 0 24 24" fill="currentColor">${inner}</svg>`;
    const CHARMS = [
      { sel: '.hero', label: 'Top', icon: svg('<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" fill="none" stroke="currentColor" stroke-width="2"/>') },
      { sel: '#about', label: 'About', icon: svg('<path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z"/>') },
      { sel: '#services', label: 'Services', icon: '<img src="img/lily.png" alt="">' },
      { sel: '#work', label: 'My Work', icon: svg('<path d="M8 5v14l11-7z"/>') },
      { sel: '#testimonials', label: 'Testimonials', icon: svg('<path d="M5 18h4l2-4V7H5v7h3zm9 0h4l2-4V7h-6v7h3z"/>') },
      { sel: '#collaborate', label: 'Collaborate', icon: svg('<circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M11.5 11.5l9 9M17 17l2.5-2.5M14.5 14.5l2.5-2.5" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>') },
    ];
    const items = CHARMS.map((c) => ({ ...c, sec: $(c.sel) })).filter((c) => c.sec);
    // Visual shortcut only: the nav menu remains the accessible way to move between sections
    const rail = make('div', 'fx-rail', `
      <span class="fx-rail__thread"></span><span class="fx-rail__fill"></span>
      ${items.map((it) => `<button type="button" class="fx-rail__charm" tabindex="-1">${it.icon}</button>`).join('')}
      <span class="fx-rail__label"></span>
      <span class="fx-rail__bead"><svg viewBox="0 0 24 24"><defs><linearGradient id="fx-bead" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6e2c8"/><stop offset="1" stop-color="#a36f4f"/></linearGradient></defs><path d="M12 21s-8-5.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.5-8 11-8 11z" fill="url(#fx-bead)" stroke="#fdf6e8" stroke-width="1.6"/></svg></span>`);
    rail.setAttribute('aria-hidden', 'true');
    document.body.append(rail);
    const bead = $('.fx-rail__bead', rail);
    const label = $('.fx-rail__label', rail);
    $$('.fx-rail__charm', rail).forEach((btn, i) => { items[i].btn = btn; });

    const maxScroll = () => Math.max(root.scrollHeight - window.innerHeight, 1);
    const layout = () => { rail.style.setProperty('--fx-nav-h', navHeight() + 'px'); items.forEach((it) => {
      it.t = it.sel === '.hero' ? 0 : clamp((it.sec.offsetTop - navHeight()) / maxScroll(), 0, 1);
      it.btn.style.setProperty('--t', (it.t * 100).toFixed(2) + '%');
    }); };
    let active = null;
    const update = () => {
      const p = clamp(window.scrollY / maxScroll(), 0, 1);
      rail.style.setProperty('--p', (p * 100).toFixed(2) + '%');
      let now = items[0];
      items.forEach((it) => { if (it.t <= p + 0.01) now = it; });
      if (now !== active) {
        items.forEach((it) => it.btn.classList.toggle('fx-on', it === now));
        if (active && !reduceMotion) now.btn.animate({ rotate: ['0deg', '25deg', '-18deg', '10deg', '0deg'] }, { duration: 700, easing: 'ease-out' });
        active = now;
        label.textContent = now.label;
      }
    };
    let hideTimer;
    let dragging = false;
    const show = () => {
      if (root.classList.contains('fx-intro-lock')) return;
      rail.classList.add('show');
      clearTimeout(hideTimer);
      if (!dragging) hideTimer = setTimeout(() => rail.classList.remove('show', 'fx-labeling'), 1500);
    };
    let railTicking = false;
    window.addEventListener('scroll', () => {
      if (!railTicking) { railTicking = true; requestAnimationFrame(() => { railTicking = false; update(); show(); }); }
    }, { passive: true });
    window.addEventListener('resize', () => { layout(); update(); });
    new ResizeObserver(() => { layout(); update(); }).observe(document.body);

    // Drag the heart bead to scrub through the page
    bead.addEventListener('pointerdown', (e) => {
      dragging = true;
      bead.setPointerCapture(e.pointerId);
      rail.classList.add('fx-dragging', 'fx-labeling');
      show();
      e.preventDefault();
    });
    bead.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const r = rail.getBoundingClientRect();
      const p = clamp((e.clientY - r.top) / r.height, 0, 1);
      window.scrollTo({ top: p * maxScroll(), behavior: 'instant' });
    });
    const release = () => {
      if (!dragging) return;
      dragging = false;
      rail.classList.remove('fx-dragging');
      show();
    };
    bead.addEventListener('pointerup', release);
    bead.addEventListener('pointercancel', release);

    // Tap a charm to jump to its section
    items.forEach((it) => it.btn.addEventListener('click', () => {
      rail.classList.add('fx-labeling');
      if (it.sel === '.hero') window.scrollTo({ top: 0, behavior: behavior() });
      else it.sec.scrollIntoView({ behavior: behavior() });
      show();
    }));

    layout();
    update();
  }

  /* ---------- Phones: café menu board replaces the dropdown menu ---------- */
  // The original dropdown stays in the HTML; on phones the toggle opens this board instead.
  const navToggle = $('.nav__toggle');
  const mobile = window.matchMedia('(max-width: 720px)');
  if (navToggle && navLinks) {
    navToggle.insertAdjacentHTML('beforeend',
      '<svg class="fx-toggle-cup" viewBox="0 0 40 40" aria-hidden="true">' +
      '<g class="fx-toggle-cup__steam" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M16 12c-2-3 2-4 0-7"/><path d="M22 12c-2-3 2-4 0-7"/></g>' +
      '<path d="M9 15h20v7a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8z" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
      '<path d="M29 18h2a3 3 0 0 1 0 6h-2" fill="none" stroke="currentColor" stroke-width="2.2"/></svg>');

    const links = $$('a[href^="#"]', navLinks).filter((a) => !a.classList.contains('nav__cta'));
    const cta = $('.nav__cta', navLinks);
    const insta = $('.hero__social a[href*="instagram"]');
    const board = make('div', 'fx-board', `
      <img class="fx-board__lily fx-board__lily--l" src="img/lily.png" alt="" aria-hidden="true">
      <img class="fx-board__lily fx-board__lily--r" src="img/lily.png" alt="" aria-hidden="true">
      <button type="button" class="fx-board__close" aria-label="Close menu">&#10005;</button>
      <p class="fx-board__title" aria-hidden="true">Avni's Menu</p>
      <ol class="fx-board__list">
        ${links.map((a, i) => `<li style="--i:${i}"><a href="${esc(a.getAttribute('href'))}"><span class="fx-board__name">${esc(a.textContent.trim())}</span><i aria-hidden="true"></i><b aria-hidden="true">0${i + 1}</b></a></li>`).join('')}
      </ol>
      ${cta ? `<a class="fx-board__special" href="${esc(cta.getAttribute('href'))}"><small>&#9733; Today's special</small><span>Let's collaborate &#9749;</span></a>` : ''}
      <div class="fx-board__foot">
        <button type="button" class="fx-board__theme" aria-pressed="false"></button>
        ${insta ? `<a class="fx-board__insta" href="${esc(insta.href)}" target="_blank" rel="noopener">@lattes.n.laptops &middot; Instagram</a>` : ''}
      </div>`);
    board.id = 'fx-board';
    board.hidden = true;
    board.setAttribute('role', 'dialog');
    board.setAttribute('aria-modal', 'true');
    board.setAttribute('aria-label', 'Menu');
    document.body.append(board);

    const themeBtn = $('.fx-theme', navLinks);
    const boardTheme = $('.fx-board__theme', board);
    const syncTheme = () => {
      const on = root.classList.contains('fx-espresso');
      boardTheme.innerHTML = on ? '&#9728; Latte mode' : '&#9790; Espresso mode';
      boardTheme.setAttribute('aria-pressed', String(on));
    };
    if (themeBtn) boardTheme.addEventListener('click', () => { themeBtn.click(); syncTheme(); });
    else boardTheme.remove();

    const setToggle = (open) => {
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Close menu' : 'Toggle menu');
      navToggle.classList.toggle('fx-cup-mode', open);
    };
    const openBoard = () => {
      board.style.setProperty('--fx-nav-h', navHeight() + 'px');
      board.hidden = false;
      board.scrollTop = 0;
      board.classList.remove('fx-closing');
      void board.offsetWidth;
      board.classList.add('fx-open');
      root.classList.add('fx-board-lock');
      setToggle(true);
      const cur = $('a.fx-active', navLinks);
      $$('a[href^="#"]', board).forEach((a) => a.classList.toggle('fx-active', !!cur && a.getAttribute('href') === cur.getAttribute('href')));
      syncTheme();
      setTimeout(() => { const first = $('.fx-board__list a', board); if (first) first.focus({ preventScroll: true }); }, reduceMotion ? 0 : 400);
    };
    const closeBoard = (then) => {
      if (board.hidden || board.classList.contains('fx-closing')) return;
      board.classList.remove('fx-open');
      board.classList.add('fx-closing');
      root.classList.remove('fx-board-lock');
      setToggle(false);
      const done = () => {
        board.hidden = true;
        board.classList.remove('fx-closing');
        if (typeof then === 'function') then(); else navToggle.focus({ preventScroll: true });
      };
      if (reduceMotion) done(); else setTimeout(done, 350);
    };

    // Capture phase on window runs before script.js's own toggle handler, so it never opens the dropdown on phones
    window.addEventListener('click', (e) => {
      if (!mobile.matches || !e.target.closest || !e.target.closest('.nav__toggle')) return;
      e.stopPropagation();
      e.preventDefault();
      if (board.hidden) openBoard(); else closeBoard();
    }, true);
    navToggle.setAttribute('aria-controls', 'fx-board');

    $('.fx-board__close', board).addEventListener('click', () => closeBoard());
    $$('a[href^="#"]', board).forEach((a) => a.addEventListener('click', (e) => {
      e.preventDefault();
      const target = document.getElementById(a.getAttribute('href').slice(1));
      a.classList.add('fx-tapped');
      setTimeout(() => closeBoard(() => {
        a.classList.remove('fx-tapped');
        if (target) target.scrollIntoView({ behavior: behavior() });
      }), reduceMotion ? 0 : 280);
    }));

    // Keyboard: Esc closes, Tab stays inside the board
    board.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeBoard(); return; }
      if (e.key !== 'Tab') return;
      const f = $$('a, button', board).filter((n) => n.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });

    // Swipe the board up to close (when it isn't scrollable itself)
    let swipeY = null;
    board.addEventListener('touchstart', (e) => {
      swipeY = board.scrollHeight <= board.clientHeight + 2 ? e.touches[0].clientY : null;
    }, { passive: true });
    board.addEventListener('touchmove', (e) => {
      if (swipeY != null && swipeY - e.touches[0].clientY > 70) { swipeY = null; closeBoard(); }
    }, { passive: true });

    mobile.addEventListener('change', () => { if (!mobile.matches) closeBoard(); });
  }
})();
