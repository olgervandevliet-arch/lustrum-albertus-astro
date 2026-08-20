(() => {
  const TARGET_DATE = document.querySelector('[data-target-date]')?.dataset.targetDate || '2027-08-18T20:00:00';

  /* ---------- countdown flap tiles ---------- */
  const flapAnimating = new Set();

  function setFlap(id, value) {
    const root = document.querySelector('[data-flap="' + id + '"]');
    if (!root) return;
    root.dataset.flapValue = value;
    const upper = root.querySelector('[data-flap-upper]');
    const lower = root.querySelector('[data-flap-lower]');
    const leafTop = root.querySelector('[data-flap-leaf-top]');
    const leafBottom = root.querySelector('[data-flap-leaf-bottom]');
    [upper, lower, leafTop, leafBottom].forEach((el) => { if (el) el.textContent = value; });
  }

  function animateFlap(id, from, to) {
    const root = document.querySelector('[data-flap="' + id + '"]');
    const gsap = window.gsap;
    if (!root || !gsap || flapAnimating.has(id)) { setFlap(id, to); return; }
    const leafTopWrap = root.querySelector('[data-leaf-top]');
    const leafBottomWrap = root.querySelector('[data-leaf-bottom]');
    const upper = root.querySelector('[data-flap-upper]');
    const lower = root.querySelector('[data-flap-lower]');
    const leafTop = root.querySelector('[data-flap-leaf-top]');
    const leafBottom = root.querySelector('[data-flap-leaf-bottom]');
    if (!leafTopWrap || !leafBottomWrap) { setFlap(id, to); return; }

    flapAnimating.add(id);
    upper.textContent = to;
    lower.textContent = from;
    leafTop.textContent = from;
    leafBottom.textContent = to;
    leafTopWrap.style.visibility = 'visible';
    leafBottomWrap.style.visibility = 'visible';

    gsap.set(leafTopWrap, { rotateX: 0 });
    gsap.set(leafBottomWrap, { rotateX: 90 });
    gsap.timeline({
      onComplete: () => {
        leafTopWrap.style.visibility = 'hidden';
        leafBottomWrap.style.visibility = 'hidden';
        setFlap(id, to);
        flapAnimating.delete(id);
      },
    })
      .to(leafTopWrap, { rotateX: -90, duration: 0.3, ease: 'power2.in' }, 0)
      .to(leafBottomWrap, { rotateX: 0, duration: 0.34, ease: 'power2.out' }, 0.3);
  }

  const pad = (n, len) => String(n).padStart(len, '0');
  let lastDigits = null;

  function target() {
    const t = Date.parse(TARGET_DATE);
    return Number.isNaN(t) ? Date.now() + 365 * 864e5 : t;
  }

  function tick(instant) {
    const diff = Math.max(0, target() - Date.now());
    const total = Math.floor(diff / 1000);
    const d = pad(Math.min(999, Math.floor(total / 86400)), 3);
    const h = pad(Math.floor(total / 3600) % 24, 2);
    const m = pad(Math.floor(total / 60) % 60, 2);
    const s = pad(total % 60, 2);
    const digits = {
      d0: d[0], d1: d[1], d2: d[2],
      h0: h[0], h1: h[1],
      m0: m[0], m1: m[1],
      s0: s[0], s1: s[1],
    };
    Object.keys(digits).forEach((id) => {
      const val = digits[id];
      if (!lastDigits) { setFlap(id, val); return; }
      if (lastDigits[id] !== val) {
        if (instant) setFlap(id, val);
        else animateFlap(id, lastDigits[id], val);
      }
    });
    lastDigits = digits;
  }

  tick(true);
  setInterval(() => tick(false), 1000);

  /* ---------- video lightbox ---------- */
  const modal = document.querySelector('[data-video-modal]');
  const modalFrame = document.querySelector('[data-video-frame]');
  const openButtons = document.querySelectorAll('[data-video-open]');
  const closeButtons = document.querySelectorAll('[data-video-close]');

  function openVideo(embedUrl) {
    if (!modal || !modalFrame) return;
    modalFrame.setAttribute('src', embedUrl + '?autoplay=1');
    modal.style.display = 'flex';
  }
  function closeVideo() {
    if (!modal || !modalFrame) return;
    modal.style.display = 'none';
    modalFrame.setAttribute('src', '');
  }
  openButtons.forEach((btn) => {
    btn.addEventListener('click', () => openVideo(btn.getAttribute('data-video-open')));
  });
  closeButtons.forEach((btn) => btn.addEventListener('click', closeVideo));
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeVideo(); });

  const track = document.querySelector('[data-video-track]');
  document.querySelector('[data-video-prev]')?.addEventListener('click', () => {
    track?.scrollBy({ left: -(track.clientWidth * 0.8), behavior: 'smooth' });
  });
  document.querySelector('[data-video-next]')?.addEventListener('click', () => {
    track?.scrollBy({ left: track.clientWidth * 0.8, behavior: 'smooth' });
  });

  /* ---------- title reveal (scroll-triggered split text) ---------- */
  function runTitleReveal() {
    const els = document.querySelectorAll('[data-title-reveal]');
    if (!els.length) return;
    const gsap = window.gsap;
    const setup = () => {
      els.forEach((el) => {
        el.style.overflow = 'hidden';
        const split = new window.SplitText(el, { type: 'words, chars' });
        gsap.set(split.chars, { opacity: 0, yPercent: 120 });
        const play = () => {
          gsap.killTweensOf(split.chars);
          gsap.to(split.chars, { opacity: 1, yPercent: 0, duration: 0.5, stagger: 0.02, ease: 'power3.out' });
        };
        const reset = () => {
          gsap.killTweensOf(split.chars);
          gsap.to(split.chars, { opacity: 0, yPercent: 120, duration: 0.2, stagger: 0.01, ease: 'power1.in' });
        };
        window.ScrollTrigger.create({ trigger: el, start: 'top 85%', end: 'top 85%', onEnter: play, onLeaveBack: reset });
      });
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(setup);
    else setup();
  }

  function waitForSplit(tries) {
    tries = tries || 0;
    if (window.gsap && window.SplitText && window.ScrollTrigger) return runTitleReveal();
    if (tries > 120) return;
    setTimeout(() => waitForSplit(tries + 1), 60);
  }
  waitForSplit();

  /* ---------- preloader ---------- */
  let startLetterIntro = null;

  function runPreloader() {
    const el = document.querySelector('[data-preloader]');
    if (!el) { if (startLetterIntro) startLetterIntro(); return; }
    let seen = false;
    try {
      seen = localStorage.getItem('albertus-visited') === '1';
      localStorage.setItem('albertus-visited', '1');
    } catch (e) {}
    if (seen) {
      el.remove();
      if (startLetterIntro) startLetterIntro();
      return;
    }
    const gsap = window.gsap;
    const texts = Array.from(el.querySelectorAll('[data-preloader-text]'));
    const tl = gsap.timeline({
      onComplete: () => {
        if (startLetterIntro) startLetterIntro();
        gsap.to(el, {
          yPercent: 100,
          duration: 0.9,
          ease: 'power4.inOut',
          onComplete: () => el.remove(),
        });
      },
    });
    texts.forEach((t, i) => {
      const split = new window.SplitText(t, { type: 'words, chars' });
      gsap.set(t, { opacity: 1 });
      gsap.set(split.chars, { opacity: 0, yPercent: 120 });
      tl.to(split.chars, { opacity: 1, yPercent: 0, duration: 0.4, stagger: 0.02, ease: 'power2.out' });
      tl.to(split.chars, { opacity: 0, yPercent: -120, duration: 0.3, stagger: 0.015, ease: 'power2.in' }, '+=0.5');
      if (i < texts.length - 1) tl.set(t, { opacity: 0 });
    });
  }

  function waitForGsapPreloader(tries) {
    tries = tries || 0;
    if (window.gsap && window.SplitText) {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(runPreloader);
      else runPreloader();
      return;
    }
    if (tries > 120) return;
    setTimeout(() => waitForGsapPreloader(tries + 1), 60);
  }
  waitForGsapPreloader();

  /* ---------- hero letters + countdown scroll motion ---------- */
  let safetyTimer;
  let scrollTriggers = [];
  let introTimeline;
  let lenis;
  let rafTick;

  function initMotion() {
    const gsap = window.gsap;
    gsap.registerPlugin(window.ScrollTrigger);

    if (window.Lenis && !lenis) {
      lenis = new window.Lenis({ duration: 0.9, smoothWheel: true, wheelMultiplier: 1 });
      lenis.on('scroll', window.ScrollTrigger.update);
      rafTick = (time) => lenis.raf(time * 1000);
      gsap.ticker.add(rafTick);
      gsap.ticker.lagSmoothing(0);
    }

    const wrap = document.querySelector('[data-hero-wrap]');
    const letters = Array.from(document.querySelectorAll('[data-letter]')).sort(
      (a, b) => b.getBoundingClientRect().top - a.getBoundingClientRect().top
    );
    const counter = document.querySelector('[data-counter]');
    if (!wrap || !letters.length) return;

    const screens = 1;
    wrap.style.height = (screens + 1) * 100 + 'vh';
    gsap.set(counter, { opacity: 1, y: 0 });

    const armSafety = () => {
      clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => {
        gsap.set(counter, { opacity: 1 });
        letters.forEach((el) => gsap.set(el, { y: restY(), x: 0, rotate: Number(el.dataset.rot) || 0 }));
      }, 1500);
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const preloaderActive = !!document.querySelector('[data-preloader]');

    const perLetterNeed = (el) => window.innerHeight - 120 - (el.offsetTop + (el.offsetHeight || 300));
    const extraDrop = Math.max(0, ...letters.map(perLetterNeed));
    const restY = () => extraDrop;

    letters.forEach((el) => {
      if (preloaderActive && !reduced) {
        gsap.set(el, { x: 0, y: () => -(window.innerHeight * 0.85 + (el.offsetHeight || 300)), rotate: (Number(el.dataset.rot) || 0) - 14, transformOrigin: '50% 50%' });
      } else {
        gsap.set(el, { x: 0, y: restY(el), transformOrigin: '50% 50%' });
      }
    });
    gsap.set(counter, { xPercent: -50, x: 0, y: 0, opacity: 1, transformOrigin: '50% 50%' });

    const runLetterIntro = () => {
      if (reduced) return;
      try {
        introTimeline = gsap.timeline({
          onComplete: () =>
            letters.forEach((el) => gsap.set(el, { y: restY(el), x: 0, rotate: Number(el.dataset.rot) || 0 })),
        });
        const step = 0.08;
        letters.forEach((el, i) => {
          const rot = Number(el.dataset.rot) || 0;
          const sway = Number(el.dataset.sway) || 0;
          const h = () => el.offsetHeight || 300;
          const rest = restY(el);
          const t = i * step;

          introTimeline.fromTo(
            el,
            { y: () => -(window.innerHeight * 0.85 + h()), x: 0, rotate: rot - 14, immediateRender: true },
            { y: rest, rotate: rot, duration: 0.68, ease: 'power2.in' },
            t
          );
          introTimeline
            .to(el, { x: sway, y: rest - h() * 0.1, rotate: rot + sway / 5, duration: 0.16, ease: 'power2.out' }, t + 0.46)
            .to(el, { x: sway * 0.4, y: rest, rotate: rot + sway / 12, duration: 0.15, ease: 'power2.in' }, t + 0.62)
            .to(el, { x: 0, rotate: rot, duration: 0.22, ease: 'power2.out' }, t + 0.77);
        });
        introTimeline.fromTo(
          counter,
          { y: 70, opacity: 0.999 },
          { y: 0, opacity: 1, duration: 1.05, ease: 'power3.out' },
          letters.length * step + 0.15
        );
      } catch (e) {
        letters.forEach((el) => gsap.set(el, { y: restY(el), x: 0, rotate: Number(el.dataset.rot) || 0 }));
        gsap.set(counter, { y: 0, opacity: 1 });
      }
    };

    const releaseLetters = () => { armSafety(); runLetterIntro(); };
    const waitForReveal = (fn) => {
      const pt = window.__pageTransition;
      if (pt && pt.onRevealed) pt.onRevealed(fn);
      else fn();
    };
    if (preloaderActive) {
      startLetterIntro = () => waitForReveal(releaseLetters);
    } else {
      waitForReveal(releaseLetters);
    }

    const tl = gsap.timeline({
      scrollTrigger: { trigger: wrap, start: 'top top', end: 'bottom bottom', scrub: 0.3 },
    });
    letters.forEach((el) => {
      const speed = Number(el.dataset.speed) || 1;
      const rot = Number(el.dataset.rot) || 0;
      const dx = Number(el.dataset.dx) || 0;
      gsap.set(el, { transformOrigin: '50% 50%' });
      tl.to(el, { yPercent: -(160 + speed * 480), scale: 1 + speed * 0.35, ease: 'none' }, 0);
      tl.to(el, { x: () => window.innerWidth * dx * 1.6, rotate: rot + (dx >= 0 ? 13 : -12), ease: 'power1.in' }, 0.22);
    });
    tl.to(counter, { y: -60, scale: 1.08, ease: 'none' }, 0);

    const title = document.querySelector('[data-hero-title]');
    const setupTitleSplit = () => {
      const split = window.SplitText ? new window.SplitText(title, { type: 'words, chars' }) : null;
      const chars = split ? split.chars : [title];
      gsap.set(chars, { opacity: 0, yPercent: 120 });
      let shown = false;
      window.ScrollTrigger.create({
        trigger: wrap,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => {
          const pastPoint = self.progress > 0.62;
          if (pastPoint === shown) return;
          shown = pastPoint;
          gsap.killTweensOf(chars);
          if (pastPoint) gsap.to(chars, { opacity: 1, yPercent: 0, duration: 0.4, stagger: 0.02, ease: 'power2.out' });
          else gsap.to(chars, { opacity: 0, yPercent: 120, duration: 0.2, stagger: 0.01, ease: 'power1.in' });
        },
      });
    };
    if (title) {
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(setupTitleSplit);
      else setupTitleSplit();
    }

    const gradient = document.querySelector('[data-gradient]');
    if (gradient) tl.fromTo(gradient, { yPercent: -6 }, { yPercent: -70, ease: 'none' }, 0);

    scrollTriggers = window.ScrollTrigger.getAll();
  }

  function waitForGsap(tries) {
    tries = tries || 0;
    if (window.gsap && window.ScrollTrigger) return initMotion();
    if (tries > 120) return;
    setTimeout(() => waitForGsap(tries + 1), 60);
  }
  waitForGsap();

  window.addEventListener('beforeunload', () => {
    clearTimeout(safetyTimer);
    scrollTriggers.forEach((t) => t.kill());
    if (introTimeline) introTimeline.kill();
    if (lenis) {
      if (rafTick && window.gsap) window.gsap.ticker.remove(rafTick);
      lenis.destroy();
    }
  });
})();
