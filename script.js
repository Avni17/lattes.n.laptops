(() => {
  document.documentElement.classList.add('js');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year').textContent = new Date().getFullYear();

  // Mobile menu
  const toggle = document.querySelector('.nav__toggle');
  const links = document.getElementById('nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  links.addEventListener('click', (e) => {
    if (e.target.tagName === 'A') {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // Count-up numbers
  const countUp = (el) => {
    const target = parseFloat(el.dataset.count);
    const decimals = parseInt(el.dataset.decimals || '0', 10);
    const suffix = el.dataset.suffix || '';
    if (reduceMotion) { el.textContent = target.toFixed(decimals) + suffix; return; }
    const start = performance.now();
    const duration = 1400;
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = (target * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  // Donut chart: draw each segment
  const drawDonut = (root) => {
    root.querySelectorAll('.donut__seg').forEach((seg) => {
      const pct = parseFloat(seg.dataset.pct);
      const offset = parseFloat(seg.dataset.offset);
      seg.style.strokeDashoffset = -offset;
      seg.style.strokeDasharray = `${pct} ${100 - pct}`;
    });
  };

  // Reveal on scroll, trigger counters and chart once visible
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      el.classList.add('in');
      el.querySelectorAll('[data-count]').forEach(countUp);
      if (el.classList.contains('donut')) drawDonut(el);
      io.unobserve(el);
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.reveal').forEach((el) => io.observe(el));

  // Contact form: validates, then opens the visitor's email client
  const CONTACT_EMAIL = 'lattes.n.laptops@gmail.com'; // [EDIT]
  const form = document.getElementById('contact-form');
  const status = form.querySelector('.form__status');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let valid = true;
    form.querySelectorAll('[required]').forEach((field) => {
      const ok = field.type === 'email'
        ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim())
        : field.value.trim() !== '';
      field.setAttribute('aria-invalid', String(!ok));
      if (!ok) valid = false;
    });
    if (!valid) {
      status.textContent = 'Please fill in name, a valid email, and a message.';
      return;
    }
    const data = new FormData(form);
    const subject = `Collaboration inquiry from ${data.get('name')}${data.get('brand') ? ' (' + data.get('brand') + ')' : ''}`;
    const body = `${data.get('message')}\n\n${data.get('name')}\n${data.get('email')}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    status.textContent = 'Opening your email app...';
  });

  // Featured videos: silent looping preview while in view, tap = full video with sound
  const phones = document.getElementById('phones');
  const figures = [...phones.querySelectorAll('.phone')];
  let active = null; // figure currently playing the full video

  const makeVideo = (fig) => {
    let v = fig.querySelector('video');
    if (v) return v;
    v = document.createElement('video');
    v.src = fig.dataset.preview || fig.dataset.video;
    if (fig.dataset.poster) v.poster = fig.dataset.poster;
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = 'metadata';
    fig.replaceChildren(v);
    return v;
  };

  const toPreview = (fig) => {
    const v = fig.querySelector('video');
    if (!v) return;
    fig.classList.remove('playing');
    v.muted = true;
    v.loop = true;
    const src = fig.dataset.preview || fig.dataset.video;
    if (!v.src.endsWith(src)) v.src = src;
    if (inView.has(fig) && !reduceMotion) v.play().catch(() => {});
    else v.pause();
  };

  const playFull = (fig) => {
    if (active && active !== fig) toPreview(active);
    active = fig;
    const v = makeVideo(fig);
    const full = fig.dataset.video || fig.dataset.preview;
    if (!v.src.endsWith(full)) v.src = full;
    v.muted = false;
    v.loop = false;
    v.currentTime = 0;
    v.play().catch(() => { v.muted = true; v.play().catch(() => {}); });
    fig.classList.add('playing');
    v.onended = () => { if (active === fig) { active = null; toPreview(fig); } };
  };

  const inView = new Set();
  const previewIO = new IntersectionObserver((entries) => {
    entries.forEach(({ target, isIntersecting }) => {
      const v = target.querySelector('video');
      if (isIntersecting) {
        inView.add(target);
        if (v && !target.classList.contains('playing') && !reduceMotion) v.play().catch(() => {});
      } else {
        inView.delete(target);
        if (v && target.classList.contains('playing')) { active = null; toPreview(target); }
        if (v) v.pause();
      }
    });
  }, { threshold: 0.6 });

  figures.forEach((fig) => {
    if (fig.dataset.video || fig.dataset.preview) {
      fig.classList.add('has-video');
      if (fig.dataset.preview) fig.classList.add('has-preview');
      fig.setAttribute('role', 'button');
      fig.tabIndex = 0;
      fig.setAttribute('aria-label', 'Play video with sound');
      makeVideo(fig);
      previewIO.observe(fig);
      const toggle = () => {
        if (fig.classList.contains('playing')) {
          const v = fig.querySelector('video');
          if (v.paused) v.play(); else v.pause();
        } else {
          playFull(fig);
        }
      };
      fig.addEventListener('click', toggle);
      fig.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
      return;
    }
    if (fig.dataset.href) {
      fig.setAttribute('role', 'link');
      fig.tabIndex = 0;
      fig.setAttribute('aria-label', 'Watch on Instagram: ' + fig.textContent.trim());
      const open = () => window.open(fig.dataset.href, '_blank', 'noopener');
      fig.addEventListener('click', open);
      fig.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(); });
    }
  });
  const stopAll = () => { if (active) { const f = active; active = null; toPreview(f); } };

  // Carousel arrows (visible on mobile via CSS)
  const prev = document.querySelector('.carousel__btn--prev');
  const next = document.querySelector('.carousel__btn--next');
  const step = () => (figures[0].offsetWidth || 200) + 16;
  const behavior = () => (reduceMotion ? 'auto' : 'smooth');
  const atStart = () => phones.scrollLeft <= 4;
  const atEnd = () => phones.scrollLeft + phones.clientWidth >= phones.scrollWidth - 4;
  // Loop: next at the end jumps to the first, prev at the start jumps to the last
  prev.addEventListener('click', () => {
    if (atStart()) phones.scrollTo({ left: phones.scrollWidth, behavior: behavior() });
    else phones.scrollBy({ left: -step(), behavior: behavior() });
  });
  next.addEventListener('click', () => {
    if (atEnd()) phones.scrollTo({ left: 0, behavior: behavior() });
    else phones.scrollBy({ left: step(), behavior: behavior() });
  });
  let scrollTimer;
  phones.addEventListener('scroll', () => {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(stopAll, 150); // pause videos once the user swipes away
  }, { passive: true });
})();
