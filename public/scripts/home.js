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

  /* ---------- tv theater: the tv zooms in and plays the newest video on its own screen ---------- */
  (function () {
    const theater = document.querySelector('[data-tv-theater]');
    const opener = document.querySelector('[data-tv-theater-open]');
    const smallTv = document.querySelector('[data-tv-wrap]');
    if (!theater || !opener || !smallTv) return;
    const bigTv = theater.querySelector('[data-tv-theater-tv]');
    const bigImg = theater.querySelector('[data-tv-theater-img]');
    const frame = theater.querySelector('[data-tv-theater-frame]');
    const canvas = theater.querySelector('[data-tv-theater-static]');
    const backdrop = theater.querySelector('[data-tv-theater-backdrop]');
    const closeBtn = theater.querySelector('[data-tv-theater-close]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // where the glass sits inside the tv picture, as fractions of its width/height
    const TV_RATIO = 524 / 640;
    let state = 'closed';
    let staticRaf = 0;
    let onPlaying = null;
    let openCount = 0;
    const command = (func, args) => {
      try { frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: func, args: args || [], id: 1, channel: 'widget' }), '*'); } catch (err) {}
    };

    // the small tv picture is shown first (already cached); the sharp one replaces it once loaded
    let bigImgRequested = false;
    const loadBigImg = () => {
      if (bigImgRequested) return;
      bigImgRequested = true;
      const sharp = new Image();
      sharp.onload = () => { bigImg.src = sharp.src; };
      sharp.src = bigImg.dataset.src;
    };
    opener.addEventListener('pointerenter', loadBigImg, { once: true });

    // tv noise, drawn small and scaled up: random grain with drifting horizontal bands
    const ctx = canvas.getContext('2d');
    // 'full' covers the whole screen. 'bands' leaves the picture visible and only
    // keeps two drifting strips of noise: one over the top and one over the middle,
    // which is where YouTube shows its title and pause icon for the first seconds.
    let staticMode = 'full';
    const bandAlpha = (pos, t) => {
      const top = 1 - Math.min(1, Math.max(0, (pos - 0.15) / 0.05));
      const mid = 0.5 + 0.012 * Math.sin(t * 5);
      const middle = 1 - Math.min(1, Math.max(0, (Math.abs(pos - mid) - 0.075) / 0.04));
      return Math.max(top, middle);
    };
    const drawStatic = (time) => {
      const w = canvas.width, h = canvas.height;
      const img = ctx.createImageData(w, h);
      const d = img.data;
      const t = time / 1000;
      for (let y = 0; y < h; y++) {
        const yy = (y / h) * 128;
        const band = 0.5 + 0.3 * Math.sin(yy * 0.19 + t * 7) + 0.2 * Math.sin(yy * 0.61 - t * 13);
        const alpha = staticMode === 'full' ? 255 : 255 * bandAlpha(y / h, t);
        if (!alpha) continue;
        for (let x = 0; x < w; x++) {
          const v = Math.random() * 255 * band;
          const i = (y * w + x) * 4;
          d[i] = v * 0.92; d[i + 1] = v * 0.97; d[i + 2] = v; d[i + 3] = alpha;
        }
      }
      ctx.putImageData(img, 0, 0);
    };
    const startStatic = () => {
      staticMode = 'full';
      canvas.style.opacity = '1';
      canvas.style.display = 'block';
      // fine grain: about one noise dot per two screen pixels at the tv's full size
      const screenW = parseFloat(bigTv.style.width) * 0.72;
      canvas.width = Math.max(240, Math.min(720, Math.round(screenW / 1.6)));
      canvas.height = Math.round(canvas.width * 0.8);
      cancelAnimationFrame(staticRaf);
      let last = 0;
      const loop = (time) => {
        if (time - last > 45) { drawStatic(time); last = time; }
        staticRaf = requestAnimationFrame(loop);
      };
      drawStatic(performance.now());
      staticRaf = requestAnimationFrame(loop);
    };
    const stopStatic = () => {
      const gsap = window.gsap;
      const done = () => { cancelAnimationFrame(staticRaf); canvas.style.display = 'none'; };
      if (gsap && !reducedMotion) gsap.to(canvas, { opacity: 0, duration: 0.45, ease: 'power1.out', onComplete: done });
      else done();
    };

    // the whole tv stays in view, a bit smaller than the window
    const targetBox = () => {
      const vw = window.innerWidth, vh = window.innerHeight;
      const width = Math.min(vw * 0.94, (vh * 0.84) / TV_RATIO, 1000);
      const height = width * TV_RATIO;
      return { width, x: (vw - width) / 2, y: (vh - height) / 2 };
    };

    function open() {
      if (state !== 'closed') return;
      state = 'opening';
      const gsap = window.gsap;
      loadBigImg();
      const from = smallTv.getBoundingClientRect();
      const box = targetBox();
      bigTv.style.width = box.width + 'px';
      theater.style.display = 'block';
      document.documentElement.style.overflow = 'hidden';
      if (lenis) lenis.stop();
      smallTv.style.visibility = 'hidden';
      startStatic();
      frame.setAttribute('src', opener.getAttribute('data-tv-theater-open') + '?autoplay=1&rel=0&controls=0&playsinline=1&enablejsapi=1&disablekb=1&iv_load_policy=3');
      const session = ++openCount;
      const startedAt = performance.now();
      let zoomed = false, loaded = false, revealed = false, playing = false, playingAt = 0;
      // full noise as the intro, for a moment even when the video is quick
      const INTRO_MS = 1400;
      // YouTube shows the video title and a pause icon for the first seconds of
      // playback and offers no way to turn that off. Instead of hiding the whole
      // picture that long, only two strips of noise stay over those spots.
      const OVERLAY_MS = 4300;
      const reveal = () => {
        if (session !== openCount || revealed || !zoomed || !loaded || state !== 'open') return;
        revealed = true;
        const now = performance.now();
        const showPicture = Math.max(0, INTRO_MS - (now - startedAt));
        const clearAll = playing ? Math.max(showPicture + 400, OVERLAY_MS - (now - playingAt)) : showPicture;
        setTimeout(() => { if (session === openCount && state === 'open' && playing) staticMode = 'bands'; }, showPicture);
        setTimeout(() => { if (session === openCount && state === 'open') stopStatic(); }, clearAll);
      };
      onPlaying = () => {
        onPlaying = null;
        playing = true;
        playingAt = performance.now();
        loaded = true;
        reveal();
      };
      // some browsers refuse to start a video with sound by themselves. If nothing
      // is playing shortly after the player has loaded, lift the noise and let the
      // visitor press YouTube's own play button.
      const giveUpWaiting = () => {
        if (session !== openCount || playing) return;
        frame.style.pointerEvents = 'auto';
        loaded = true;
        reveal();
      };
      frame.addEventListener('load', () => setTimeout(giveUpWaiting, 3000), { once: true });
      setTimeout(giveUpWaiting, 7000);
      const finish = () => { state = 'open'; zoomed = true; closeBtn.focus({ preventScroll: true }); reveal(); };
      if (gsap && !reducedMotion) {
        gsap.set(bigTv, { x: from.left, y: from.top, scale: from.width / box.width });
        gsap.to(bigTv, { x: box.x, y: box.y, scale: 1, duration: 0.95, ease: 'power3.inOut', onComplete: finish });
        gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.6, ease: 'power1.out' });
        gsap.fromTo(closeBtn, { opacity: 0 }, { opacity: 1, duration: 0.3, delay: 0.7 });
      } else {
        bigTv.style.transform = 'translate(' + box.x + 'px,' + box.y + 'px)';
        backdrop.style.opacity = '1';
        finish();
      }
    }

    function close() {
      if (state !== 'open') return;
      state = 'closing';
      const gsap = window.gsap;
      frame.setAttribute('src', '');
      frame.style.pointerEvents = 'none';
      startStatic();
      const done = () => {
        cancelAnimationFrame(staticRaf);
        theater.style.display = 'none';
        smallTv.style.visibility = '';
        document.documentElement.style.overflow = '';
        if (lenis) lenis.start();
        state = 'closed';
        opener.focus({ preventScroll: true });
      };
      if (gsap && !reducedMotion) {
        const to = smallTv.getBoundingClientRect();
        const width = parseFloat(bigTv.style.width);
        gsap.to(bigTv, { x: to.left, y: to.top, scale: to.width / width, duration: 0.75, ease: 'power3.inOut', onComplete: done });
        gsap.to(backdrop, { opacity: 0, duration: 0.5, delay: 0.2 });
        gsap.to(closeBtn, { opacity: 0, duration: 0.2 });
      } else {
        done();
      }
    }

    window.addEventListener('message', (e) => {
      if (state === 'closed' || e.source !== frame.contentWindow) return;
      let data = e.data;
      try { if (typeof data === 'string') data = JSON.parse(data); } catch (err) { return; }
      const playerState = data && data.event === 'onStateChange' ? data.info : data && data.event === 'infoDelivery' && data.info ? data.info.playerState : undefined;
      if (playerState === 1 && onPlaying) onPlaying();
      if (playerState === 0) close();
    });
    frame.addEventListener('load', () => {
      if (!frame.getAttribute('src')) return;
      try {
        frame.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*');
        frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'addEventListener', args: ['onStateChange'], id: 1, channel: 'widget' }), '*');
      } catch (err) {}
    });

    opener.addEventListener('click', open);
    closeBtn.addEventListener('click', close);
    backdrop.addEventListener('click', close);
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    window.addEventListener('resize', () => {
      if (state !== 'open') return;
      const box = targetBox();
      bigTv.style.width = box.width + 'px';
      if (window.gsap) window.gsap.set(bigTv, { x: box.x, y: box.y, scale: 1 });
    });
  })();

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
        window.ScrollTrigger.create({ trigger: el, start: 'top 110%', end: 'top 110%', onEnter: play, onLeaveBack: reset });
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

  /* ---------- tv bar: the title of the newest video slides by ---------- */
  (function () {
    const ticker = document.querySelector('[data-tv-bar-ticker]');
    if (!ticker || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const start = () => {
      // one repetition of the title, measured in the svg's own units
      const loop = ticker.getComputedTextLength() / 6;
      if (!loop) return;
      const from = Number(ticker.getAttribute('startOffset'));
      const anim = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
      anim.setAttribute('attributeName', 'startOffset');
      anim.setAttribute('from', String(from));
      anim.setAttribute('to', String(from - loop));
      anim.setAttribute('dur', (loop / 34).toFixed(2) + 's');
      anim.setAttribute('repeatCount', 'indefinite');
      ticker.appendChild(anim);
    };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
    else start();
  })();

  /* ---------- preloader ---------- */
  let startLetterIntro = null;
  let preloaderDone = false;

  // the preloader covers the whole page, so it must always go away: when it has
  // played, when the visitor has seen it before, and when a script or font it
  // waits for is slow or never arrives
  function finishPreloader() {
    if (preloaderDone) return;
    preloaderDone = true;
    const el = document.querySelector('[data-preloader]');
    if (el) el.remove();
    if (startLetterIntro) startLetterIntro();
  }

  function runPreloader() {
    if (preloaderDone) return;
    const el = document.querySelector('[data-preloader]');
    if (!el) { finishPreloader(); return; }
    el.dataset.started = '1';
    const gsap = window.gsap;
    const texts = Array.from(el.querySelectorAll('[data-preloader-text]'));
    try {
      const tl = gsap.timeline({
        onComplete: () => {
          preloaderDone = true;
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
        const split = new window.SplitText(t, { type: 'words, chars', aria: 'none' });
        gsap.set(t, { opacity: 1 });
        gsap.set(split.chars, { opacity: 0, yPercent: 120 });
        tl.to(split.chars, { opacity: 1, yPercent: 0, duration: 0.4, stagger: 0.02, ease: 'power2.out' });
        tl.to(split.chars, { opacity: 0, yPercent: -120, duration: 0.3, stagger: 0.015, ease: 'power2.in' }, '+=0.5');
        if (i < texts.length - 1) tl.set(t, { opacity: 0 });
      });
    } catch (e) {
      finishPreloader();
    }
  }

  function waitForGsapPreloader(tries) {
    tries = tries || 0;
    if (!document.querySelector('[data-preloader]')) { finishPreloader(); return; }
    if (window.gsap && window.SplitText) {
      // don't hold the blue screen for a slow web font
      const fonts = document.fonts && document.fonts.ready;
      const cap = new Promise((res) => setTimeout(res, 1200));
      (fonts ? Promise.race([fonts, cap]) : cap).then(() => {
        // after an in-site navigation this page sits behind the curtain until it
        // is revealed; start only then, so the preloader is actually seen
        let started = false;
        const start = () => { if (!started) { started = true; runPreloader(); } };
        const pt = window.__pageTransition;
        if (pt && pt.onRevealed) { pt.onRevealed(start); setTimeout(start, 4000); }
        else start();
      });
      return;
    }
    if (tries > 50) { finishPreloader(); return; }
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

    const screens = 0.6;
    wrap.style.height = (screens + 1) * 100 + 'vh';
    gsap.set(counter, { opacity: 1, y: 0 });

    const armSafety = () => {
      clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => {
        gsap.set(counter, { opacity: 1 });
        letters.forEach((el) => gsap.set(el, { y: restY(el), x: 0, rotate: Number(el.dataset.rot) || 0 }));
      }, 2800);
    };

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const preloaderActive = !preloaderDone && !!document.querySelector('[data-preloader]');

    // all letters fall by the SAME amount so their hand-tuned relative vertical
    // offsets (and thus the stacked/piled look) are preserved, rather than each
    // one bottom-aligning to the same line (which flattens the pile and can make
    // taller letters overlap shorter ones). The uniform drop is the smallest
    // amount any single letter needs, plus a bit extra to sit the whole pile lower.
    const perLetterNeed = (el) => Math.max(0, window.innerHeight - 120 - (el.offsetTop + (el.offsetHeight || 300)));
    const uniformDrop = Math.min(...letters.map(perLetterNeed)) + window.innerHeight * 0.4;
    const restY = () => uniformDrop;

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
          const fallDuration = 0.95;

          introTimeline.fromTo(
            el,
            { y: () => -(window.innerHeight * 0.85 + h()), x: 0, rotate: rot - 14, immediateRender: true },
            { y: rest, rotate: rot, duration: fallDuration, ease: 'power2.in' },
            t
          );
          introTimeline
            .to(el, { x: sway, y: rest - h() * 0.1, rotate: rot + sway / 5, duration: 0.16, ease: 'power2.out' }, t + fallDuration)
            .to(el, { x: sway * 0.4, y: rest, rotate: rot + sway / 12, duration: 0.15, ease: 'power2.in' }, t + fallDuration + 0.16)
            .to(el, { x: 0, rotate: rot, duration: 0.22, ease: 'power2.out' }, t + fallDuration + 0.31);
        });
      } catch (e) {
        letters.forEach((el) => gsap.set(el, { y: restY(el), x: 0, rotate: Number(el.dataset.rot) || 0 }));
        gsap.set(counter, { y: 0, opacity: 1 });
      }
    };

    const releaseLetters = () => { armSafety(); runLetterIntro(); };
    const waitForReveal = (fn) => {
      let called = false;
      const runOnce = () => {
        if (called) return;
        called = true;
        fn();
      };
      const pt = window.__pageTransition;
      // on a plain page load (not an in-app curtain navigation) the reveal
      // callback may simply never fire, so always arm a fallback timer too
      if (pt && pt.onRevealed) pt.onRevealed(runOnce);
      setTimeout(runOnce, pt && pt.onRevealed ? 700 : 0);
    };
    if (preloaderActive) {
      startLetterIntro = () => waitForReveal(releaseLetters);
    } else {
      waitForReveal(releaseLetters);
    }

    const tvVideo = document.querySelector('[data-tv-video]');
    if (tvVideo) {
      // the clip is decoration: fetch it only once the page itself has loaded
      const tryPlayTvVideo = () => {
        if (!tvVideo.getAttribute('src')) return;
        tvVideo.play().catch(() => {});
      };
      const attachTvVideo = () => {
        if (tvVideo.getAttribute('src')) return;
        tvVideo.src = tvVideo.dataset.src;
        tryPlayTvVideo();
      };
      if (document.readyState === 'complete') setTimeout(attachTvVideo, 300);
      else window.addEventListener('load', () => setTimeout(attachTvVideo, 300), { once: true });
      waitForReveal(tryPlayTvVideo);
      tvVideo.addEventListener('loadedmetadata', tryPlayTvVideo);
      tvVideo.addEventListener('canplay', tryPlayTvVideo);
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden && tvVideo.paused) tryPlayTvVideo();
      });
      // recover from a stuck/broken load (seen in the wild as "video doesn't always load"):
      // if it errors out or stops making progress for a while, force a fresh load + play
      tvVideo.addEventListener('error', () => { tvVideo.load(); tryPlayTvVideo(); });
      let lastCt = -1;
      let stallTicks = 0;
      setInterval(() => {
        if (document.hidden) return;
        if (tvVideo.paused) { tryPlayTvVideo(); return; }
        if (tvVideo.currentTime === lastCt) {
          stallTicks++;
          if (stallTicks >= 3) { stallTicks = 0; tvVideo.load(); tryPlayTvVideo(); }
        } else {
          stallTicks = 0;
          lastCt = tvVideo.currentTime;
        }
      }, 2000);
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
    const isMobileLayout = window.matchMedia('(max-width: 980px)').matches;

    // the counter is free to drift down (even past the dark section) — the TV
    // is positioned independently below so it always ends up centered
    const counterStartRect = counter.getBoundingClientRect();
    const counterTargetY = window.innerHeight - counterStartRect.top + (isMobileLayout ? window.innerHeight * 0.35 : 56);
    tl.to(counter, { y: counterTargetY, ease: 'none' }, 0);
    const tvWrap = document.querySelector('[data-tv-wrap]');
    const glassBox = document.querySelector('[data-counter-glass]');
    if (tvWrap) {
      const tvRectStart = tvWrap.getBoundingClientRect();
      // the TV's bottom edge stays fixed while it scales (bottom-anchored
      // transform-origin below), so that's the reference point for centering
      const tvBottomFixed = tvRectStart.bottom;
      let finalTvHeight = tvRectStart.height;
      let targetScale = 1;
      let targetX = 0;

      if (isMobileLayout) {
        // mobile: grows centered, up to the site's content width
        gsap.set(tvWrap, { xPercent: -50, transformOrigin: '50% 100%' });
        const gutter = window.innerWidth * 0.12;
        const targetWidth = Math.min(1240, window.innerWidth - gutter);
        targetScale = tvRectStart.width > 0 ? targetWidth / tvRectStart.width : 1;
        finalTvHeight = tvRectStart.height * targetScale;
      } else if (glassBox) {
        // desktop: grows a bit and slides toward the middle of the counter box
        gsap.set(tvWrap, { transformOrigin: '100% 100%' });
        const boxRect = glassBox.getBoundingClientRect();
        targetScale = 1.8;
        finalTvHeight = tvRectStart.height * targetScale;
        const endWidth = tvRectStart.width * targetScale;
        const endLeft = tvRectStart.right - endWidth;
        const endCenterX = endLeft + endWidth / 2;
        const targetCenterX = boxRect.left + boxRect.width / 2;
        targetX = targetCenterX - endCenterX;
      }

      // tvWrap inherits the counter's own y-movement too (it's a child of it),
      // so that has to be cancelled out before adding this tween's own offset
      const finalCenterBeforeOwnY = tvBottomFixed - finalTvHeight / 2 + counterTargetY;
      const targetY = window.innerHeight / 2 - finalCenterBeforeOwnY;
      tl.to(tvWrap, {
        scale: targetScale, x: targetX, y: targetY, duration: 0.8, ease: 'none',
        // the play button keeps its own size while the tv grows
        onUpdate: () => tvWrap.style.setProperty('--tv-inv', String(1 / (Number(gsap.getProperty(tvWrap, 'scale')) || 1))),
      }, 0);
    }

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
    if (gradient) tl.fromTo(gradient, { yPercent: -6 }, { yPercent: -105, duration: 0.4, ease: 'none' }, 0);

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
