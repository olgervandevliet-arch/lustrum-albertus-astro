/* Curved wipe page transition — SPA-achtig, zonder documentwissel.
   Werkwijze (werkt in alle browsers):
   - De bestemming wordt volledig geladen in een verborgen stage-frame (eigen document, dus alle
     scripts/fonts draaien normaal) terwijl de veeg omhoog loopt.
   - Als de veeg dekt EN de pagina klaar is, wordt het frame zichtbaar en de URL bijgewerkt.
     Er wordt dus nooit een document afgebroken → geen flits, geen zichtbare herlaadstap.
   - Klikken binnen een stage-frame worden naar dit venster doorgegeven. */
(() => {
  if (window.__pageTransition) return;

  const STAGE = 'pt-stage';
  const isStage = window.name === STAGE;

  const COLOR = '#BFF7F7';
  const TEXT = '#41569F';
  const FLAG = 'pt-entering';
  const DUR_OUT = 760;
  const DUR_IN = 860;
  const BAND = 130;
  const BULGE = 22;

  const front = (p) => 122 - p * 127;
  const bulge = (p) => {
    const f = p - Math.floor(p);
    const swell = Math.sin(Math.PI * Math.pow(f, 0.75));
    const spring = 1 + 0.22 * Math.sin(Math.PI * 2.4 * f) * (1 - f);
    return BULGE * swell * spring;
  };
  const easeInOut = (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2);
  const easeOut = (t) => 1 - Math.pow(1 - t, 4);
  const easeIn = (t) => t * t * t;
  // bouncy varianten voor de letter-stagger: lichte overshoot bij binnenkomst, lichte "aanloop"
  // terug bij vertrek — zelfde tijdvensters, alleen een levendiger curve
  const BACK_C1 = 1.70158, BACK_C3 = BACK_C1 + 1;
  const easeOutBack = (t) => 1 + BACK_C3 * Math.pow(t - 1, 3) + BACK_C1 * Math.pow(t - 1, 2);
  const easeInBack = (t) => BACK_C3 * t * t * t - BACK_C1 * t * t;

  const isInternal = (a) => {
    if (!a) return false;
    const href = a.getAttribute('href') || '';
    if (!href || href[0] === '#' || /^(mailto:|tel:)/i.test(href)) return false;
    if (a.target && a.target !== '' && a.target !== '_self') return false;
    if (/^https?:\/\//i.test(href)) {
      try { if (new URL(href).origin !== location.origin) return false; } catch (e) { return false; }
    }
    // zowel de schone routes (/faq) als de rauwe bestandsnamen (FAQ.dc.html, voor het geval die
    // ergens direct gebruikt worden) tellen als interne pagina
    return href === '/' || /^\/[a-z0-9-]+\/?($|[?#])/i.test(href) || /\.dc\.html($|[?#])/.test(href);
  };

  /* ---------- stage-modus: alleen doorgeven aan het bovenliggende venster ---------- */
  if (isStage) {
    const relay = (dest) => {
      try {
        if (parent && parent !== window && parent.__pageTransition) {
          parent.__pageTransition.go(dest);
          return true;
        }
      } catch (e) {}
      return false;
    };
    document.addEventListener('click', (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target && e.target.closest && e.target.closest('a');
      if (!isInternal(a)) return;
      e.preventDefault();
      if (!relay(a.getAttribute('href'))) window.location.href = a.getAttribute('href');
    }, true);
    try { document.documentElement.style.background = '#4557A4'; } catch (e) {}

    // de host stuurt een bericht zodra het gordijn deze pagina volledig heeft onthuld — pas dan
    // mogen intro-animaties (zoals vallende letters) starten; anders spelen ze af terwijl dit
    // iframe nog verborgen is en zijn ze allang klaar tegen de tijd dat het gordijn opent
    let revealed = false;
    const revealCbs = [];
    window.addEventListener('message', (e) => {
      if (e.data === 'pt:revealed' && e.source === window.parent) {
        revealed = true;
        revealCbs.splice(0).forEach((cb) => cb());
      }
    });
    window.__pageTransition = {
      go: (d) => { if (!relay(d)) window.location.href = d; },
      onRevealed: (cb) => { if (revealed) cb(); else revealCbs.push(cb); },
    };
    return;
  }

  /* ---------- hostmodus ---------- */
  let svg, path, mark, markLetters = [], busy = false;
  let stage = null;          // huidig zichtbaar stage-frame
  let ownContentHidden = false;
  let earlyCover = null;

  let entering = false;
  try {
    entering = sessionStorage.getItem(FLAG) === '1';
    sessionStorage.removeItem(FLAG);
  } catch (e) {}

  // eerste paint nooit wit/zwart
  try {
    const de = document.documentElement;
    de.style.background = entering ? COLOR : '#4557A4';
    de.style.colorScheme = 'light';
    if (entering) {
      earlyCover = document.createElement('div');
      earlyCover.setAttribute('aria-hidden', 'true');
      earlyCover.style.cssText = 'position:fixed;inset:0;z-index:399;background:' + COLOR + ';pointer-events:none;';
      de.appendChild(earlyCover);
    }
  } catch (e) {}

  const bandPath = (p) => {
    const top = front(p);
    const bottom = top + BAND;
    const b = -bulge(p);
    const t = top + b, tc = top + b * 0.6;
    const e = bottom + b, c = bottom + b * 0.6;
    return `M0,${top} C 18,${tc} 34,${t} 50,${t} C 66,${t} 82,${tc} 100,${top} L100,${bottom} C 82,${c} 66,${e} 50,${e} C 34,${e} 18,${c} 0,${bottom} Z`;
  };

  // dezelfde band-vorm, maar in echte pixels t.o.v. het venster — nodig om als CSS clip-path op de
  // (niet-uitgerekte) tekstlaag te zetten, zodat tekst en achtergrond exact dezelfde maskeervorm delen
  // en nooit meer los van elkaar kunnen lopen
  const bandPathPx = (p) => {
    const w = window.innerWidth, h = window.innerHeight;
    const top = (front(p) / 100) * h;
    const bottom = top + (BAND / 100) * h;
    const b = -(bulge(p) / 100) * h;
    const t = top + b, tc = top + b * 0.6;
    const e = bottom + b, c = bottom + b * 0.6;
    const X = (pct) => (pct / 100) * w;
    return `M${X(0)},${top} C ${X(18)},${tc} ${X(34)},${t} ${X(50)},${t} C ${X(66)},${t} ${X(82)},${tc} ${X(100)},${top} L${X(100)},${bottom} C ${X(82)},${c} ${X(66)},${e} ${X(50)},${e} C ${X(34)},${e} ${X(18)},${c} ${X(0)},${bottom} Z`;
  };

  const build = () => {
    if (svg) return;
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:400;pointer-events:none;';
    path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('fill', COLOR);
    path.setAttribute('d', bandPath(0));
    svg.appendChild(path);
    document.documentElement.appendChild(svg);

    mark = document.createElement('div');
    mark.setAttribute('aria-hidden', 'true');
    // de zichtbaarheidsgrens van de tekst komt puur uit de clip-path hieronder (zelfde vorm als de
    // achtergrond, dus nooit uit de pas); de losse letters krijgen daarbinnen nog hun eigen
    // gestaggerde intro-beweging, puur decoratief, die kan dus nooit meer verkeerd registreren
    mark.style.cssText =
      'position:fixed;inset:0;z-index:401;display:flex;align-items:center;justify-content:center;' +
      'gap:0.02em;pointer-events:none;font-family:"Inter Tight",system-ui,sans-serif;font-weight:800;' +
      'font-size:clamp(56px,9vw,140px);letter-spacing:-0.01em;color:' + TEXT + ';line-height:1;';
    markLetters = ['X', 'X', 'V', 'I'].map((ch) => {
      const wrap = document.createElement('span');
      wrap.style.cssText = 'display:block;overflow:hidden;';
      const inner = document.createElement('span');
      inner.textContent = ch;
      inner.style.cssText = 'display:block;transform:translate3d(0,120%,0);will-change:transform;backface-visibility:hidden;';
      wrap.appendChild(inner);
      mark.appendChild(wrap);
      return inner;
    });
    document.documentElement.appendChild(mark);
  };

  // stagger: puur decoratieve intro-beweging per letter, onafhankelijk van de mask hieronder —
  // registreert dus nooit verkeerd t.o.v. de achtergrond, want de zichtbaarheidsgrens komt alleen
  // uit de clip-path
  const staggerLetters = (t, dir) => {
    const step = 0.13;
    const span = Math.max(0.2, 1 - (markLetters.length - 1) * step);
    markLetters.forEach((el, i) => {
      const local = Math.max(0, Math.min(1, (t - i * step) / span));
      const eased = dir === 1 ? easeOut(local) : easeIn(local);
      el.style.transform = 'translate3d(0,' + (dir === 1 ? 120 * (1 - eased) : -120 * eased) + '%,0)';
    });
  };

  // tekst en achtergrond delen letterlijk dezelfde vorm voor de zichtbaarheidsgrens: de mask komt
  // altijd exact overeen met de achtergrondband, dus die kan nooit uit de pas lopen — de stagger
  // hierboven is losse decoratie daarbinnen
  const apply = (p) => {
    if (path) path.setAttribute('d', bandPath(p));
    if (mark) {
      const d = bandPathPx(p);
      mark.style.clipPath = "path('" + d + "')";
      mark.style.webkitClipPath = "path('" + d + "')";
    }
  };

  const animate = ({ duration, ease, onFrame, onDone }) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      onFrame(ease(t), t);
      if (t < 1) requestAnimationFrame(step);
      else if (onDone) onDone();
    };
    requestAnimationFrame(step);
  };

  const hideOwnContent = () => {
    if (ownContentHidden) return;
    ownContentHidden = true;
    Array.from(document.body.children).forEach((el) => {
      if (el === svg || el === mark || el === stage) return;
      el.style.display = 'none';
    });
    document.body.style.overflow = 'hidden';
  };

  // laadt de bestemming volledig in een eigen document, verborgen naast de huidige pagina
  const makeStage = (href) => new Promise((resolve) => {
    let settled = false;
    const f = document.createElement('iframe');
    f.name = STAGE;
    f.setAttribute('title', 'pagina');
    f.style.cssText =
      'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:1;' +
      'visibility:hidden;background:#4557A4;';
    const done = (ok) => { if (!settled) { settled = true; resolve(ok ? f : null); } };
    const cap = setTimeout(() => done(true), 3000);
    f.addEventListener('load', () => { clearTimeout(cap); done(true); }, { once: true });
    f.addEventListener('error', () => { clearTimeout(cap); done(false); }, { once: true });
    f.src = href;
    document.body.appendChild(f);
  });

  const go = (dest) => {
    if (!dest || busy) return;
    busy = true;
    build();
    svg.style.pointerEvents = 'auto';
    const staging = makeStage(dest);

    animate({
      duration: DUR_OUT, ease: easeInOut,
      onFrame: (v, t) => {
        apply(v);
        staggerLetters(Math.max(0, Math.min(1, (t - 0.5) / 0.32)), 1);
      },
      onDone: () => {
        apply(1);
        staggerLetters(1, 1);
        void document.documentElement.offsetHeight;
        staging.then((frame) => {
          if (!frame) { window.location.href = dest; return; }
          // wissel achter het stilstaande gordijn: oude weergave weg, nieuwe erin
          const old = stage;
          stage = frame;
          frame.style.visibility = 'visible';
          hideOwnContent();
          if (old && old !== frame) old.remove();
          try { history.pushState({ pt: dest }, '', dest); } catch (e) {}
          requestAnimationFrame(() => requestAnimationFrame(() => revealOut()));
        });
      },
    });
  };

  const revealOut = () => {
    // de letters zijn tijdens go() al binnengekomen (opkomend van onder) — hier alleen nog laten
    // uitgaan naar boven, niet nog eens laten binnenkomen (dat gaf een dubbele animatie)
    animate({
      duration: DUR_IN, ease: easeInOut,
      onFrame: (v, t) => {
        apply(1 + v);
        staggerLetters(Math.min(1, t / 0.45), -1);
      },
      onDone: () => {
        svg.style.pointerEvents = 'none';
        apply(0);
        busy = false;
        // laat de nieuwe pagina weten dat het gordijn nu echt weg is, zodat intro-animaties
        // daar (bv. vallende letters op Home) nu pas mogen starten
        if (stage && stage.contentWindow) {
          try { stage.contentWindow.postMessage('pt:revealed', '*'); } catch (e) {}
        }
      },
    });
  };

  // eerste keer binnenkomen na een echte navigatie (fallback-pad)
  const revealOnLoad = () => {
    build();
    svg.style.pointerEvents = 'auto';
    apply(1);
    staggerLetters(0, 1);
    if (earlyCover) {
      void document.documentElement.offsetHeight;
      earlyCover.remove();
      earlyCover = null;
    }
    const page = document.querySelector('#top') || document.body.firstElementChild;
    if (page) {
      page.style.willChange = 'transform';
      page.style.transform = 'translate3d(0,90px,0)';
    }
    animate({
      duration: DUR_IN, ease: easeInOut,
      onFrame: (v, t) => {
        apply(1 + v);
        if (t < 0.3) staggerLetters(t / 0.3, 1);
        else staggerLetters(Math.min(1, (t - 0.3) / 0.4), -1);
        if (page) page.style.transform = `translate3d(0,${90 * (1 - easeOut(t))}px,0)`;
      },
      onDone: () => {
        svg.style.pointerEvents = 'none';
        if (mark) mark.style.display = 'none';
        if (page) { page.style.transform = ''; page.style.willChange = ''; }
      },
    });
  };

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target && e.target.closest && e.target.closest('a');
    if (!isInternal(a)) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  }, true);

  window.addEventListener('popstate', () => { window.location.reload(); });

  const boot = () => {
    if (!entering) {
      if (earlyCover) { earlyCover.remove(); earlyCover = null; }
      return;
    }
    const fonts = document.fonts && document.fonts.ready ? document.fonts.ready : null;
    const guard = new Promise((res) => setTimeout(res, 120));
    (fonts ? Promise.race([fonts, guard]) : guard).then(() => {
      build();
      if (mark) void mark.offsetHeight;
      requestAnimationFrame(revealOnLoad);
    });
  };

  let booted = false;
  const bootOnce = () => { if (!booted) { booted = true; boot(); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bootOnce, { once: true });
  else bootOnce();

  // op het topvenster is er nooit een verborgen wachttijd te overbruggen (dat speelt alleen in het
  // stage-iframe hierboven), dus hier meteen vuren
  window.__pageTransition = { go, onRevealed: (cb) => cb() };
})();
