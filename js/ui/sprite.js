/* 立绘棋子与精灵图攻击动画（纯 DOM，无需引擎） */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const states = new WeakMap();

  function now() {
    return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  }

  function showIdle(el, def) {
    el.style.backgroundImage = 'url("' + def.idle + '")';
    el.style.backgroundSize = '100% 100%';
    el.style.backgroundPosition = '0% 0%';
    el.classList.remove('is-attacking');
  }

  function setFrame(el, def, index) {
    const cols = def.cols || 1;
    const rows = def.rows || 1;
    const col = index % cols;
    const row = Math.floor(index / cols);
    const x = cols > 1 ? (col / (cols - 1)) * 100 : 0;
    const y = rows > 1 ? (row / (rows - 1)) * 100 : 0;
    el.style.backgroundPosition = x.toFixed(4) + '% ' + y.toFixed(4) + '%';
  }

  function preload(def) {
    if (!def) return;
    [def.idle, def.sheet, def.icon].forEach(function (src) {
      if (!src) return;
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    });
  }

  function mount(el, def) {
    if (!el || !def) return;
    const aspect = (def.frameWidth || 300) / (def.frameHeight || 400);
    const widthTiles = (def.heightTiles || 3) * aspect;
    const footFraction = def.footFraction == null ? 0.88 : def.footFraction;
    const feetAt = def.feetAtTilePct == null ? 0.82 : def.feetAtTilePct;
    const topTiles = feetAt - footFraction * (def.heightTiles || 3);
    const bottomTiles = topTiles + (def.heightTiles || 3);

    el.classList.add('sprite-art');
    el.style.width = (widthTiles * 100).toFixed(2) + '%';
    el.style.height = ((def.heightTiles || 3) * 100).toFixed(2) + '%';
    el.style.bottom = ((1 - bottomTiles) * 100).toFixed(2) + '%';
    el.style.left = '50%';
    showIdle(el, def);
    preload(def);
    states.set(el, { def: def, raf: 0, impactTimer: 0, resolve: null, playing: false });
  }

  function cancel(el) {
    const st = states.get(el);
    if (!st) return;
    if (st.raf) {
      cancelAnimationFrame(st.raf);
      st.raf = 0;
    }
    if (st.impactTimer) {
      clearTimeout(st.impactTimer);
      st.impactTimer = 0;
    }
    st.playing = false;
    showIdle(el, st.def);
    if (st.resolve) {
      const resolve = st.resolve;
      st.resolve = null;
      resolve();
    }
  }

  /* 播放一次攻击动画；返回的 Promise 在“击中帧”兑现，收招在后台继续。 */
  function playAttack(el, def) {
    if (!el) return Promise.resolve();
    const st = states.get(el) || (mount(el, def), states.get(el));
    if (!st) return Promise.resolve();
    cancel(el);

    const speed = def.playbackSpeed || 1;
    const frameMs = 1000 / (def.fps * speed);
    const totalMs = def.frames * frameMs;
    const impactMs = Math.min(totalMs, (def.impactFrame || 0) * frameMs);

    el.style.backgroundImage = 'url("' + def.sheet + '")';
    el.style.backgroundSize = (def.cols * 100) + '% ' + (def.rows * 100) + '%';
    setFrame(el, def, 0);
    el.classList.add('is-attacking');
    st.playing = true;

    return new Promise(function (resolve) {
      let settled = false;
      function settle() {
        if (settled) return;
        settled = true;
        st.resolve = null;
        resolve();
      }

      st.resolve = settle;
      st.impactTimer = setTimeout(settle, impactMs);

      const start = now();
      function tick(timestamp) {
        if (!st.playing) return;
        const elapsed = Math.max(0, timestamp - start);
        const index = Math.min(def.frames - 1, Math.floor(elapsed / frameMs));
        setFrame(el, def, index);
        if (elapsed < totalMs - 1) {
          st.raf = requestAnimationFrame(tick);
        } else {
          end();
        }
      }

      function end() {
        if (!st.playing) return;
        st.playing = false;
        st.raf = 0;
        if (st.impactTimer) {
          clearTimeout(st.impactTimer);
          st.impactTimer = 0;
        }
        showIdle(el, st.def);
        settle();
      }

      st.raf = requestAnimationFrame(tick);
    });
  }

  BQ.Sprite = {
    mount: mount,
    preload: preload,
    playAttack: playAttack,
    cancel: cancel
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
