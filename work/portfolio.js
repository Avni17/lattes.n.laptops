/* portfolio.js: fills the portfolio from content/portfolio.json (edited in /admin), then starts script.js and fx.js.
   The HTML in work/index.html is the built-in fallback: if the JSON can't load, the page shows that instead.
   Every section renders into the exact markup the page already uses, so styles and animations stay the same. */
(() => {
  const root = document.documentElement;
  root.classList.add('js'); // hide .reveal blocks now so they don't flash before the content swap
  const SITE = new URL('../', document.currentScript.src).href;

  const $ = (s, el = document) => el.querySelector(s);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Images: "/img/x.jpg" or "img/x.jpg" are site paths (works on github.io/<repo>/ too); full URLs pass through
  const asset = (p) => (!p ? '' : /^(https?:|data:|\/\/)/.test(p) ? p : SITE + String(p).replace(/^\/+/, ''));
  const list = (v) => (Array.isArray(v) ? v.filter((x) => x != null && x !== '') : []);
  const num = (v) => (Number.isFinite(+v) ? +v : 0);
  const COLORS = ['#4a2f2c', '#d98a98', '#f2b8c0', '#c9a98a', '#a36f4f', '#e7a1ad', '#7a4b33'];

  const set = (sel, html) => { const n = $(sel); if (n && html != null) n.innerHTML = html; };
  const text = (sel, v) => { const n = $(sel); if (n && v) n.textContent = v; };
  // A list emptied in /admin removes that block from the page (instead of falling back to the built-in text)
  const hide = (...sels) => sels.forEach((sel) => document.querySelectorAll(sel).forEach((n) => { n.style.display = 'none'; }));
  const isHidden = (sel) => { const n = $(sel); return !n || n.style.display === 'none'; };

  const sections = {
    hero(d) {
      if (!d) return;
      const img = $('.hero__img');
      if (img && d.image) img.src = asset(d.image);
      text('.hero .eyebrow', d.eyebrow);
      text('.hero__tag', d.tagline);
      text('.hero__niches', d.niches);
      const ig = $('.hero__social a');
      if (ig && d.instagram) ig.href = d.instagram;
      const soon = $('.hero__social .soon');
      if (soon) { if (d.extra_note) soon.textContent = d.extra_note; else soon.remove(); }
    },
    about(d) {
      if (!d) return;
      const photos = list(d.photos);
      if (!photos.length) hide('.about__strip');
      document.querySelectorAll('.about__strip .ph').forEach((ph, i) => {
        if (!photos[i]) return;
        ph.innerHTML = `<span>Photo</span><img src="${esc(asset(photos[i]))}" alt="" loading="lazy" draggable="false" onerror="this.remove()">`;
      });
      const paras = list(d.paragraphs);
      if (paras.length) {
        const body = $('.about__body');
        body.querySelectorAll('p').forEach((p) => p.remove());
        body.insertAdjacentHTML('beforeend', paras.map((p) => `<p>${esc(p)}</p>`).join(''));
      }
      const facts = list(d.facts);
      if (!facts.length) hide('.about .card dl');
      if (facts.length) set('.about .card dl', facts.map((f) => `<dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd>`).join(''));
      const stats = list(d.stats);
      if (!stats.length) hide('.about .stats');
      if (stats.length) {
        set('.about .stats', stats.map((s) =>
          `<li><b data-count="${num(s.value)}" data-decimals="${num(s.decimals)}" data-suffix="${esc(s.suffix || '')}">0</b><span>${esc(s.label)}</span></li>`).join(''));
      }
    },
    audience(d) {
      if (!d) return;
      const facts = list(d.facts);
      if (!facts.length) hide('.audience .facts');
      if (facts.length) set('.audience .facts', facts.map((f) => `<li><b>${esc(f.value)}</b><span>${esc(f.label)}</span></li>`).join(''));
      const countries = list(d.countries).filter((c) => num(c.pct) > 0);
      if (!countries.length) hide('.donut');
      if (!countries.length) return;
      const svg = $('.donut__svg');
      let offset = 0;
      const segs = countries.map((c, i) => {
        const seg = `<circle class="donut__seg" data-pct="${num(c.pct)}" data-offset="${offset}" cx="21" cy="21" r="15.915" fill="none" stroke-width="9" style="--c:${COLORS[i % COLORS.length]}"/>`;
        offset += num(c.pct);
        return seg;
      });
      svg.innerHTML = '<circle class="donut__ring" cx="21" cy="21" r="15.915" fill="none" stroke-width="9"/>' + segs.join('');
      svg.setAttribute('aria-label', countries.map((c) => `${c.name} ${num(c.pct)} percent`).join(', '));
      set('.donut figcaption', countries.map((c, i) =>
        `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${esc(c.name)} ${num(c.pct)}%</span>`).join(''));
    },
    niches(d) {
      const items = list(d);
      if (!items.length) hide('section.niches');
      if (items.length) set('.niches .chips', items.map((n) => `<li>${esc(n)}</li>`).join(''));
    },
    services(d) {
      const items = list(d);
      if (!items.length) hide('.services__list');
      if (items.length) set('.services__list', items.map((n) => `<li>${esc(n)}</li>`).join(''));
    },
    services_photos(d) {
      const items = list(d);
      if (!items.length) hide('.services__tiles');
      if (items.length) set('.services__tiles', items.map((p) => `<img class="ph ph--sq" src="${esc(asset(p))}" alt="" loading="lazy">`).join(''));
    },
    reels(d) {
      const items = list(d);
      if (!items.length) { hide('#phones'); return; }
      set('#phones', items.map((r) => {
        const attrs = [
          r.link ? `data-href="${esc(r.link)}"` : '',
          r.preview ? `data-preview="${esc(asset(r.preview))}"` : '',
          r.video ? `data-video="${esc(asset(r.video))}"` : '',
          (r.preview || r.video) && r.cover ? `data-poster="${esc(asset(r.cover))}"` : '',
          r.badge ? `data-badge="${esc(r.badge)}"` : '',
        ].filter(Boolean).join(' ');
        if (r.cover) {
          return `<figure class="phone has-cover" ${attrs}><img class="cover" src="${esc(asset(r.cover))}" alt="${esc(r.alt || r.title)}" loading="lazy"><figcaption class="cover__title">${esc(r.title)}</figcaption></figure>`;
        }
        return `<figure class="phone" ${attrs}><div class="ph ph--phone"><span>${esc(r.title)}</span></div></figure>`;
      }).join(''));
    },
    cases(d) {
      const items = list(d);
      if (!items.length) { hide('.cases'); return; }
      const row = (label, v) => (v ? `<dt>${label}</dt><dd>${esc(v)}</dd>` : '');
      set('.cases', items.map((c) => `
        <article class="case">
          <p class="case__brand">${esc(c.brand)}</p>
          <h3>${esc(c.title)}</h3>
          <dl>${row('Campaign goal', c.goal)}${row('Concept', c.concept)}${row('My role', c.role)}${row('Deliverables', c.deliverables)}</dl>
          <p class="case__result">${list(c.results).map((r) => `<b>${esc(r.value)}</b> ${esc(r.label)}`).join(' <span>&middot;</span> ')}</p>
        </article>`).join(''));
    },
    collabs(d) { if (!brands('.brands--wide', d)) hide('.brands--wide'); },
    featured_brands(d) { if (!brands('.brands:not(.brands--wide)', d)) hide('.brands:not(.brands--wide)', '.brands__sub'); },
    performance(d) {
      const items = list(d);
      if (!items.length) hide('section.perf');
      if (items.length) {
        set('.perf .pills', items.map((s) =>
          `<li><b data-count="${num(s.value)}" data-decimals="${num(s.decimals)}" data-suffix="${esc(s.suffix || '')}">0</b><span>${esc(s.label)}</span></li>`).join(''));
      }
    },
    testimonials(d) {
      const items = list(d);
      if (!items.length) hide('section.testimonials');
      if (items.length) {
        set('.quotes', items.map((t) => `<blockquote><p>${esc(t.quote)}</p><footer>${esc(t.author)}</footer></blockquote>`).join(''));
      }
    },
    contact(d) {
      if (!d || !d.email) return;
      const form = $('#contact-form');
      if (form) form.dataset.email = d.email;
      document.querySelectorAll('a[href^="mailto:"]').forEach((a) => {
        a.href = a.href.replace(/^mailto:[^?]*/, 'mailto:' + d.email);
        if (a.textContent.includes('@')) a.textContent = d.email;
      });
    },
  };

  function brands(sel, d) {
    const items = list(d);
    if (!items.length) return false;
    set(sel, items.map((b) => (b.logo
      ? `<li class="logo${b.dark ? ' logo--dark' : ''}"><img src="${esc(asset(b.logo))}" alt="${esc(b.name)}"></li>`
      : `<li>${esc(b.name)}</li>`)).join(''));
    return true;
  }

  // Whole sections go when everything inside them was removed; so do menu links pointing at them
  const tidy = () => {
    if (isHidden('.audience .facts') && isHidden('.donut')) hide('section.audience');
    if (isHidden('.services__list') && isHidden('.services__tiles')) hide('section.services');
    if (isHidden('#phones') && isHidden('.cases')) hide('section.work');
    if (isHidden('.brands--wide') && isHidden('.brands:not(.brands--wide)')) hide('section.collabs');
    document.querySelectorAll('section[id]').forEach((sec) => {
      if (sec.style.display === 'none') hide(`a[href="#${sec.id}"]`);
    });
  };

  const render = (data) => {
    Object.keys(sections).forEach((key) => {
      // A missing list counts as emptied (the editor may drop it); missing text blocks keep the built-in copy
      if (!(key in data) && ['hero', 'about', 'audience', 'contact'].includes(key)) return;
      try { sections[key](data[key]); } catch (e) { console.warn('[portfolio] could not render', key, e); }
    });
    tidy();
  };

  const load = (src) => new Promise((done) => {
    const s = document.createElement('script');
    s.src = SITE + src;
    s.onload = s.onerror = done;
    document.body.append(s);
  });

  (async () => {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 3500);
      const res = await fetch(SITE + 'content/portfolio.json', { cache: 'no-cache', signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) render(await res.json());
    } catch (e) {
      console.warn('[portfolio] using built-in content', e);
    }
    await load('script.js');
    await load('fx.js');
  })();
})();
