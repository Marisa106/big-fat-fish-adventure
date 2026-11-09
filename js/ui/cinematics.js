/* 演出：Boss 出场动画、传送符文光束、结局 CG 成片、回家吃饭 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const Dom = BQ.Dom;
  const h = Dom.h;

  const INTRO_COLORS = {
    gargoyle: ['#c9d6b0', '#8fae7d', '#6f8b5f'],
    treant: ['#c9a8ff', '#a37dff', '#6d4fd0'],
    beast: ['#ffb08f', '#e0705f', '#8f3a30'],
    ricecooker: ['#bfefff', '#8fd4ff', '#ffffff']
  };

  function reducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function wait(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function makeRoot(className) {
    const rootEl = Dom.$('#cine-root');
    Dom.clear(rootEl);
    rootEl.className = 'cine-root ' + (className || '');
    rootEl.classList.remove('hidden');
    return rootEl;
  }

  function finishCine(rootEl) {
    if (!rootEl) return;
    rootEl.classList.add('hidden');
    Dom.clear(rootEl);
    rootEl.className = 'cine-root hidden';
  }

  function devFreeze(rootEl) {
    if (!root.location) return false;
    let frame = null;
    try {
      frame = new URLSearchParams(root.location.search).get('cineframe');
    } catch (err) {
      return false;
    }
    if (!frame) return false;
    const ms = Math.max(0, Number(frame) || 0);
    const apply = function () {
      if (!rootEl.getAnimations) return;
      try {
        rootEl.getAnimations({ subtree: true }).forEach(function (animation) {
          animation.currentTime = ms;
          animation.pause();
        });
      } catch (err) {
        /* 忽略 */
      }
    };
    root.requestAnimationFrame(function () {
      root.requestAnimationFrame(apply);
    });
    return true;
  }

  function withSkip(rootEl, onFinish, duration) {
    const reduced = reducedMotion();
    const ms = reduced ? Math.min(700, duration) : duration;
    const frozen = devFreeze(rootEl);
    let done = false;
    const skip = h('button', { class: 'btn cine-skip', type: 'button', text: '跳过演出 ▸' });
    rootEl.appendChild(skip);

    const timer = frozen ? null : setTimeout(finish, ms);
    const onKey = function (event) {
      if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault();
        finish();
      }
    };
    document.addEventListener('keydown', onKey);
    skip.addEventListener('click', finish);

    function finish() {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      onFinish();
    }
  }

  function bossIntro(def) {
    return new Promise(function (resolve) {
      if (!def) {
        resolve();
        return;
      }
      const rootEl = makeRoot('cine-boss cine-' + def.intro + ' cine-letterbox');
      const colors = INTRO_COLORS[def.intro] || INTRO_COLORS.gargoyle;
      const particles = h('div', { class: 'cine-particles' });
      const count = reducedMotion() ? 0 : 22;
      for (let i = 0; i < count; i += 1) {
        const color = colors[i % colors.length];
        const rot = Math.floor(Math.random() * 360);
        const dist = 60 + Math.random() * 260;
        const delay = (Math.random() * 0.5).toFixed(2);
        const top = 30 + Math.random() * 40;
        particles.appendChild(
          h('span', {
            class: 'cine-particle',
            style:
              '--p-color:' + color + ';--p-rot:' + rot + 'deg;--p-dist:' + dist + 'px;--p-delay:' + delay + 's;' +
              'top:' + top + '%;'
          })
        );
      }

      rootEl.appendChild(particles);
      rootEl.appendChild(
        h('div', { class: 'cine-stage' }, [
          h('div', { class: 'cine-boss-wrap' }, [
            def.img
              ? h('img', { class: 'cine-boss-img', src: def.img, alt: def.name })
              : h('div', { class: 'cine-boss-emoji', text: def.emoji }),
            h('div', { class: 'cine-name', text: def.name }),
            h('div', { class: 'cine-sub', text: def.introLine || '' }),
            h('div', { class: 'cine-sub', style: 'opacity:.6;font-size:12px;margin-top:10px', text: def.title || '' })
          ])
        ])
      );
      if (!reducedMotion()) {
        rootEl.appendChild(h('div', { class: 'cine-flash' }));
      }
      BQ.Audio.play('boss');

      withSkip(rootEl, function () {
        finishCine(rootEl);
        resolve();
      }, 2600);
    });
  }

  function beam() {
    return new Promise(function (resolve) {
      const rootEl = makeRoot('cine-beam');
      rootEl.appendChild(
        h('div', { class: 'cine-stage beam-stage' }, [
          h('div', { class: 'beam-column' }),
          h('div', { class: 'beam-ring' }),
          h('div', { class: 'beam-ring r2' }),
          h('div', { class: 'beam-ring r3' }),
          h('div', { class: 'rune-float', text: '🔷' }),
          h('div', { class: 'beam-text', text: '传送符文启动了……' }),
          h('div', { class: 'screen-white' })
        ])
      );
      BQ.Audio.play('beam');
      withSkip(rootEl, function () {
        finishCine(rootEl);
        resolve();
      }, 3000);
    });
  }

  function home() {
    return new Promise(function (resolve) {
      const rootEl = makeRoot('cine-home');
      const stage = h('div', { class: 'home-stage' }, [
        h('div', { class: 'home-glow' }),
        h('div', { class: 'home-window' }),
        h('div', { class: 'home-table' }, [
          h('div', { class: 'home-bowl' }, [
            h('span', { text: '🍚' }),
            h('span', { class: 'home-steam' }),
            h('span', { class: 'home-steam s2' }),
            h('span', { class: 'home-steam s3' })
          ])
        ]),
        h('div', { class: 'home-fish', text: '🐟' }),
        h('div', { class: 'home-heart', text: '💛' }),
        h('div', { class: 'home-heart h2', text: '💛' }),
        h('div', { class: 'home-heart h3', text: '💛' }),
        h('div', { class: 'home-lines' }, [
          h('p', { text: '终于回家了……' }),
          h('p', { text: '开饭啦～' }),
          h('p', { text: '大肥鱼幸福地吃了一大碗米饭。', style: 'font-size:clamp(13px,1.8vw,18px);opacity:.85' })
        ])
      ]);
      rootEl.appendChild(stage);
      BQ.Audio.play('chime');
      withSkip(rootEl, function () {
        finishCine(rootEl);
        resolve();
      }, 4600);
    });
  }

  /*
   * 播放结局剧照（16:9 立绘 + 模糊背景填充）。返回 Promise<boolean>：
   * true = 正常展示或被跳过；false = 图片加载失败，调用方可以回退到旧演出。
   */
  function stillEnding(options) {
    const config = options || {};
    return new Promise(function (resolve) {
      if (!config.src) {
        resolve(false);
        return;
      }
      let rootEl = null;
      let done = false;
      let timer = null;
      let ticker = null;
      let bar = null;
      const duration = reducedMotion() ? 1600 : 5200;

      function cleanup() {
        document.removeEventListener('keydown', onKey);
        if (timer) clearTimeout(timer);
        if (ticker) clearInterval(ticker);
        timer = null;
        ticker = null;
      }

      function finish(played) {
        if (done) return;
        done = true;
        cleanup();
        if (rootEl) finishCine(rootEl);
        resolve(played !== false);
      }

      function onKey(event) {
        if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          finish(true);
        }
      }

      function render() {
        if (done) return;
        rootEl = makeRoot('cine-still');
        const stage = h('div', { class: 'still-stage' });
        const backdrop = h('div', { class: 'still-backdrop' });
        backdrop.style.backgroundImage = 'url("' + config.src + '")';
        stage.appendChild(backdrop);
        stage.appendChild(h('img', {
          class: 'still-img',
          src: config.src,
          alt: config.alt || config.tag || '结局 CG'
        }));
        if (config.tag) {
          stage.appendChild(
            h('div', { class: 'still-tag' }, [
              h('span', { class: 'still-tag-kicker', text: '结局' }),
              h('span', { class: 'still-tag-title', text: config.tag })
            ])
          );
        }
        stage.addEventListener('click', function () { finish(true); });
        rootEl.appendChild(stage);

        bar = h('i');
        rootEl.appendChild(h('div', { class: 'video-ending-progress' }, [bar]));
        const skip = h('button', { class: 'btn cine-skip', type: 'button', text: '跳过 CG ▸' });
        skip.addEventListener('click', function (event) {
          event.stopPropagation();
          finish(true);
        });
        rootEl.appendChild(skip);
        document.addEventListener('keydown', onKey);
        if (BQ.Audio) BQ.Audio.play('chime');

        const started = Date.now();
        ticker = setInterval(function () {
          if (done || !bar) return;
          const pct = Math.min(1, (Date.now() - started) / duration);
          bar.style.width = (pct * 100).toFixed(2) + '%';
        }, 100);
        timer = setTimeout(function () { finish(true); }, duration);
      }

      const preload = new Image();
      preload.onload = render;
      preload.onerror = function () { finish(false); };
      preload.src = config.src;
    });
  }

  function riceVideoSrc() {
    try {
      return (BQ.Config && BQ.Config.CONFIG.cinematics && BQ.Config.CONFIG.cinematics.riceEndingVideo) ||
        'assets/endings/rice-ending.mp4';
    } catch (err) {
      return 'assets/endings/rice-ending.mp4';
    }
  }

  /*
   * 播放结局 CG 成片。返回 Promise<boolean>：
   * true = 正常播完或被跳过；false = 视频无法播放，调用方可以回退到旧演出。
   */
  function videoEnding(options) {
    const config = options || {};
    return new Promise(function (resolve) {
      const rootEl = makeRoot('cine-video-ending');
      const stage = h('div', { class: 'video-stage' });
      const video = h('video', {
        class: 'ending-video',
        preload: 'auto',
        playsInline: true,
        controls: false
      });
      video.setAttribute('playsinline', '');
      video.setAttribute('webkit-playsinline', '');
      video.setAttribute('aria-label', config.label || '结局 CG');
      video.src = config.src || riceVideoSrc();
      if (config.poster) video.poster = config.poster;
      stage.appendChild(video);
      rootEl.appendChild(stage);

      const bar = h('i');
      rootEl.appendChild(h('div', { class: 'video-ending-progress' }, [bar]));
      const skip = h('button', { class: 'btn cine-skip', type: 'button', text: '跳过 CG ▸' });
      const playBtn = h('button', {
        class: 'btn btn-primary video-ending-play hidden',
        type: 'button',
        text: '▶ 播放结局 CG'
      });
      rootEl.appendChild(skip);
      rootEl.appendChild(playBtn);
      if (BQ.Audio) BQ.Audio.play('chime');
      if (BQ.Bgm) BQ.Bgm.suspend();

      let done = false;
      let watchdog = null;

      function armWatchdog(ms) {
        if (watchdog) clearTimeout(watchdog);
        watchdog = setTimeout(function () {
          /* 卡住时只要已经解码出画面就放行，避免把玩家困在黑屏里 */
          finish(video.readyState >= 2);
        }, ms);
      }

      function cleanup() {
        document.removeEventListener('keydown', onKey);
        if (watchdog) clearTimeout(watchdog);
        watchdog = null;
        try {
          video.pause();
        } catch (err) {
          /* 忽略 */
        }
        try {
          video.removeAttribute('src');
          video.load();
        } catch (err) {
          /* 忽略 */
        }
      }

      function finish(ok) {
        if (done) return;
        done = true;
        cleanup();
        finishCine(rootEl);
        if (BQ.Bgm) BQ.Bgm.resume();
        resolve(ok !== false);
      }

      function onKey(event) {
        if (event.key === ' ' || event.key === 'Enter' || event.key === 'Escape') {
          event.preventDefault();
          finish(true);
        }
      }

      function autoplay() {
        let attempt = null;
        try {
          attempt = video.play();
        } catch (err) {
          showPlayButton();
          return;
        }
        if (!attempt || !attempt.catch) return;
        attempt.catch(function () {
          if (done) return;
          if (!video.muted) {
            /* 浏览器拦截有声自动播放时先静音播，画面不能丢 */
            video.muted = true;
            autoplay();
            return;
          }
          showPlayButton();
        });
      }

      function showPlayButton() {
        if (done) return;
        playBtn.classList.remove('hidden');
        try {
          playBtn.focus();
        } catch (err) {
          /* 忽略 */
        }
        playBtn.addEventListener('click', function () {
          playBtn.classList.add('hidden');
          autoplay();
        }, { once: true });
      }

      skip.addEventListener('click', function () { finish(true); });
      document.addEventListener('keydown', onKey);
      video.addEventListener('ended', function () { finish(true); });
      video.addEventListener('error', function () { finish(false); });
      video.addEventListener('loadedmetadata', function () {
        const seconds = isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
        armWatchdog(Math.max(15000, seconds * 1000 + 12000));
      });
      video.addEventListener('timeupdate', function () {
        if (!isFinite(video.duration) || video.duration <= 0) return;
        const pct = Math.min(100, (video.currentTime / video.duration) * 100);
        bar.style.width = pct.toFixed(2) + '%';
      });

      video.muted = !!(BQ.Audio && typeof BQ.Audio.isMuted === 'function' && BQ.Audio.isMuted());
      armWatchdog(20000);
      autoplay();
    });
  }

  /* 吃饭结局：优先播放成片 CG；视频不可用时退回剧照，最后才回退到原来的光束 + 回家演出 */
  function riceEnding() {
    const media = BQ.Endings && typeof BQ.Endings.mediaOf === 'function' ? BQ.Endings.mediaOf('rice') : null;
    const still = media && media.still;
    return videoEnding({
      label: '吃饭结局 CG',
      src: (media && media.video) || riceVideoSrc(),
      poster: still
    }).then(function (played) {
      if (played) return true;
      return stillEnding({ src: still, tag: '开饭啦' }).then(function (shown) {
        if (shown) return true;
        return beam()
          .then(function () { return home(); })
          .then(function () { return true; });
      });
    });
  }

  BQ.Cinematics = {
    bossIntro: bossIntro,
    beam: beam,
    home: home,
    stillEnding: stillEnding,
    videoEnding: videoEnding,
    riceEnding: riceEnding
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
