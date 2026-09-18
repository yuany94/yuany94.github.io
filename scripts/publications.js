(() => {
  const section = document.getElementById('publications');
  if (!section) return;

  const groups = [...section.querySelectorAll('.publication-group')];
  const summaries = groups.map(group => group.querySelector('summary'));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const animations = new Set();
  let current = groups.find(group => group.open) || null;
  let previousTops = [];
  let previousScroll = window.scrollY;
  let queuedFrame = false;
  let transition = null;
  let nextIntent = null;
  let pending = null;
  let pendingTimer;
  let settledUntil = 0;
  let settleTimer;
  let deferredDirection = 0;
  let touchY;

  function rememberPosition() {
    previousScroll = window.scrollY;
    previousTops = summaries.map(summary => summary.getBoundingClientRect().top);
  }

  function clearPending() {
    clearTimeout(pendingTimer);
    pending = null;
  }

  function readingWithKeyboard() {
    const focus = document.activeElement;
    return current && current.contains(focus) && focus !== current.querySelector('summary') && focus.matches(':focus-visible');
  }

  async function animateGroup(group, expand, intent) {
    if (group.open === expand) return;
    if (!intent.animate || reducedMotion.matches || !group.animate) {
      group.open = expand;
      return;
    }

    const summary = group.querySelector('summary');
    const papers = group.querySelector('.publication-papers');
    const from = group.getBoundingClientRect().height;
    if (expand) group.open = true;
    const border = parseFloat(getComputedStyle(group).borderTopWidth) || 0;
    const to = expand ? group.getBoundingClientRect().height : summary.getBoundingClientRect().height + border;
    const duration = expand ? 260 : 160;
    group.classList.add('is-animating');
    group.classList.toggle('is-closing', !expand);

    const size = group.animate([{ height: `${from}px` }, { height: `${to}px` }], {
      duration, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'both'
    });
    const fade = papers.animate([{ opacity: expand ? 0.25 : 1 }, { opacity: expand ? 1 : 0 }], {
      duration, easing: 'ease-out', fill: 'both'
    });
    animations.add(size);
    animations.add(fade);
    await Promise.all([size.finished, fade.finished]).catch(() => {});
    if (!expand) group.open = false;
    size.cancel();
    fade.cancel();
    animations.delete(size);
    animations.delete(fade);
    group.classList.remove('is-animating', 'is-closing');
  }

  async function changeGroup(intent) {
    clearPending();
    if (transition) {
      // Finish the current short transition, then honor the latest interaction.
      nextIntent = intent;
      if (!intent.animate) settleMotion();
      return;
    }
    transition = intent;
    deferredDirection = 0;
    clearTimeout(settleTimer);
    current = intent.group;
    const anchor = intent.group.querySelector('summary');
    let anchorDocumentTop = anchor.getBoundingClientRect().top + window.scrollY;
    let anchorFrame;
    let tracking = true;

    // Reserve the section's space while the old panel closes, so the browser
    // doesn't clamp the scrollbar before the replacement panel can open.
    section.style.minHeight = `${section.getBoundingClientRect().height}px`;
    function correctAnchor() {
      const nextTop = anchor.getBoundingClientRect().top + window.scrollY;
      const shift = nextTop - anchorDocumentTop;
      if (intent.preserve && Math.abs(shift) > 0.5) {
        // Correct layout movement only; wheel/touch scrolling remains intact.
        window.scrollBy({ top: shift, behavior: 'instant' });
      }
      anchorDocumentTop = nextTop;
    }
    function trackAnchor() {
      if (!tracking) return;
      correctAnchor();
      anchorFrame = requestAnimationFrame(trackAnchor);
    }
    anchorFrame = requestAnimationFrame(trackAnchor);

    try {
      if (intent.open) {
        // Sequential animation preserves the one-open-category rule throughout.
        await Promise.all(groups.filter(group => group !== intent.group && group.open)
          .map(group => animateGroup(group, false, intent)));
        correctAnchor();
        await animateGroup(intent.group, true, intent);
      } else {
        await animateGroup(intent.group, false, intent);
      }
    } finally {
      section.style.minHeight = '';
      correctAnchor();
      tracking = false;
      cancelAnimationFrame(anchorFrame);
      transition = null;
      settledUntil = performance.now() + 180;
      rememberPosition();
      const next = nextIntent;
      nextIntent = null;
      if (next) changeGroup(next);
      else {
        intent.after?.();
        settleTimer = setTimeout(catchUpAfterMotion, 180);
      }
    }
  }

  function requestAutomatic(group, direction) {
    if (pending?.group === group) return;
    clearPending();
    pending = { group, direction };
    pendingTimer = setTimeout(() => {
      const choice = pending;
      pending = null;
      if (!choice || transition || readingWithKeyboard()) return;
      const rect = choice.group.querySelector('summary').getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      changeGroup({ group: choice.group, open: true, animate: true, preserve: true });
    }, 110);
  }

  function catchUpAfterMotion() {
    const direction = deferredDirection;
    deferredDirection = 0;
    if (!direction || transition || !current || readingWithKeyboard()) return;
    const index = groups.indexOf(current);
    const rects = summaries.map(summary => summary.getBoundingClientRect());
    const line = Math.min(220, window.innerHeight * 0.3);
    let candidate = -1;
    if (direction > 0) {
      for (let i = index + 1; i < groups.length; i++) {
        if (rects[i].top <= line && rects[i].bottom > 0) candidate = i;
      }
      const atBottom = window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 3;
      if (candidate === -1 && atBottom && rects[index + 1]?.top < window.innerHeight - 40) candidate = index + 1;
    } else {
      for (let i = index - 1; i >= 0; i--) {
        if (rects[i].top >= line + 64 && rects[i].top < window.innerHeight) candidate = i;
      }
    }
    if (candidate !== -1) requestAutomatic(groups[candidate], direction);
    rememberPosition();
  }

  function followScroll() {
    queuedFrame = false;
    const scroll = window.scrollY;
    const direction = Math.sign(scroll - previousScroll);
    if (transition || performance.now() < settledUntil) {
      rememberPosition();
      return;
    }
    if (direction && pending?.direction && direction !== pending.direction) clearPending();
    const rects = summaries.map(summary => summary.getBoundingClientRect());
    const line = Math.min(220, window.innerHeight * 0.3);

    if (!current) {
      const arriving = rects.findIndex(rect => rect.bottom > 0 && rect.top <= Math.min(500, window.innerHeight * 0.65));
      if (arriving !== -1) requestAutomatic(groups[arriving], direction);
    } else if (direction && !readingWithKeyboard()) {
      const index = groups.indexOf(current);
      let candidate = -1;
      if (direction > 0) {
        for (let i = index + 1; i < groups.length; i++) {
          if (previousTops[i] > line && rects[i].top <= line) candidate = i;
        }
        const atBottom = scroll + window.innerHeight >= document.documentElement.scrollHeight - 3;
        if (candidate === -1 && atBottom && rects[index + 1]?.top < window.innerHeight - 40) candidate = index + 1;
      } else {
        // A separate return threshold prevents tiny reversals from switching back.
        const returnLine = line + 64;
        for (let i = index - 1; i >= 0; i--) {
          if (previousTops[i] < returnLine && rects[i].top >= returnLine && rects[i].top < window.innerHeight) candidate = i;
        }
      }
      if (candidate !== -1) requestAutomatic(groups[candidate], direction);
    }
    rememberPosition();
  }

  function scheduleScroll() {
    if (!queuedFrame) {
      queuedFrame = true;
      requestAnimationFrame(followScroll);
    }
  }

  function settleMotion() {
    clearPending();
    clearTimeout(settleTimer);
    deferredDirection = 0;
    if (transition) transition.animate = false;
    animations.forEach(animation => { try { animation.finish(); } catch (_) {} });
    rememberPosition();
  }

  function noteScrollIntent(direction) {
    // Layout corrections and browser scrollbar clamping also emit scroll events.
    // Only real input should request a follow-up switch during an animation.
    if (direction && (transition || performance.now() < settledUntil)) deferredDirection = direction;
  }

  summaries.forEach((summary, index) => {
    summary.addEventListener('click', event => {
      event.preventDefault();
      const group = groups[index];
      const requested = nextIntent || transition;
      const open = requested ? requested.group !== group || !requested.open : !group.open;
      changeGroup({ group, open, animate: true, preserve: true });
    });
  });

  groups.forEach(group => {
    group.addEventListener('toggle', () => {
      // Synchronize browser-driven changes, such as Find in Page.
      if (!transition && group.open && current !== group) {
        clearPending();
        groups.forEach(other => { if (other !== group) other.open = false; });
        current = group;
        rememberPosition();
      }
    });
  });

  function openHashTarget() {
    const target = groups.find(group => `#${group.id}` === window.location.hash);
    if (target) {
      changeGroup({ group: target, open: true, animate: false, preserve: false,
        after: () => {
          target.querySelector('summary').scrollIntoView({ block: 'start', behavior: 'instant' });
          rememberPosition();
        }
      });
    } else if (window.location.hash === '#publications') {
      if (!(transition?.group === groups[0] && transition.open) && !groups[0].open) {
        changeGroup({ group: groups[0], open: true, animate: false, preserve: false });
      }
    }
  }

  document.querySelectorAll('a[href="#publications"]').forEach(link => {
    link.addEventListener('click', () => changeGroup({ group: groups[0], open: true, animate: true, preserve: false }));
  });
  window.addEventListener('hashchange', openHashTarget);
  window.addEventListener('wheel', event => noteScrollIntent(Math.sign(event.deltaY)), { passive: true });
  window.addEventListener('touchstart', event => { touchY = event.touches[0]?.clientY; }, { passive: true });
  window.addEventListener('touchmove', event => {
    const nextY = event.touches[0]?.clientY;
    if (touchY !== undefined && nextY !== undefined) noteScrollIntent(Math.sign(touchY - nextY));
    touchY = nextY;
  }, { passive: true });
  window.addEventListener('keydown', event => {
    if (event.target.closest('summary, button, input, textarea, select, [contenteditable]')) return;
    if (['ArrowDown', 'PageDown', 'End', ' '].includes(event.key)) noteScrollIntent(event.shiftKey ? -1 : 1);
    else if (['ArrowUp', 'PageUp', 'Home'].includes(event.key)) noteScrollIntent(-1);
  });
  window.addEventListener('scroll', scheduleScroll, { passive: true });
  window.addEventListener('resize', settleMotion);
  reducedMotion.addEventListener('change', settleMotion);
  rememberPosition();
  openHashTarget();
  scheduleScroll();
})();
