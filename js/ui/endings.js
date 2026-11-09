/* 结局 CG 演出、结局结算与结局图鉴 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const Dom = BQ.Dom;
  const h = Dom.h;
  const CONFIG = BQ.Config.CONFIG;
  const Endings = BQ.Endings;

  const STORAGE_KEY = 'bq.endings';
  const SCENE_MS = 3800;

  function reducedMotion() {
    return !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function loadUnlocked() {
    try {
      const raw = root.localStorage.getItem(STORAGE_KEY);
      const list = raw ? JSON.parse(raw) : [];
      return Array.isArray(list) ? list : [];
    } catch (err) {
      return [];
    }
  }

  function saveUnlocked(list) {
    try {
      root.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (err) {
      /* ignore */
    }
  }

  function unlockEnding(id) {
    const list = loadUnlocked();
    if (list.indexOf(id) >= 0) return list;
    list.push(id);
    saveUnlocked(list);
    return list;
  }

  const SCENES = {
    rice: {
      bg: 'home',
      caption: '米饭很香，日子很慢。',
      items: [
        { emoji: '🏠', style: 'left:50%;top:14%;font-size:96px;transform:translateX(-50%)' },
        { emoji: '🐳', style: 'left:34%;bottom:28%;font-size:120px' },
        { emoji: '🍚', style: 'left:64%;bottom:32%;font-size:84px' },
        { emoji: '💛', style: 'left:46%;bottom:50%;font-size:34px' }
      ]
    },
    openSource: {
      bg: 'open',
      caption: '第一个 issue 出现了。',
      items: [
        { emoji: '💻', style: 'left:50%;bottom:30%;font-size:110px;transform:translateX(-50%)' },
        { emoji: '🐳', style: 'left:24%;bottom:24%;font-size:110px' },
        { emoji: '⭐', style: 'left:76%;top:22%;font-size:44px' },
        { text: 'git push', style: 'left:60%;top:30%;color:#8fffc4;font-family:monospace;font-size:22px' },
        { text: 'open source', style: 'left:12%;top:24%;color:#8fffc4;font-family:monospace;font-size:18px' }
      ]
    },
    promptMaster: {
      bg: 'prompt',
      caption: '会提问，是一种被低估的能力。',
      items: [
        { emoji: '🪄', style: 'left:50%;bottom:34%;font-size:130px;transform:translateX(-50%)' },
        { emoji: '🐳', style: 'left:26%;bottom:24%;font-size:112px' },
        { emoji: '📝', style: 'left:16%;top:18%;font-size:52px' },
        { emoji: '🗂️', style: 'left:74%;top:20%;font-size:52px' },
        { emoji: '✨', style: 'left:66%;bottom:40%;font-size:40px' }
      ]
    },
    truthHunter: {
      bg: 'truth',
      caption: '“请给出来源。”',
      items: [
        { emoji: '🔍', style: 'left:50%;bottom:34%;font-size:150px;transform:translateX(-50%)' },
        { emoji: '🐳', style: 'left:26%;bottom:22%;font-size:110px' },
        { emoji: '❓', style: 'left:70%;top:18%;font-size:64px' },
        { emoji: '📄', style: 'left:82%;bottom:28%;font-size:50px' }
      ]
    },
    privacyGuard: {
      bg: 'privacy',
      caption: '先脱敏，再提问。',
      items: [
        { emoji: '🛡️', style: 'left:50%;bottom:32%;font-size:140px;transform:translateX(-50%)' },
        { emoji: '🔒', style: 'left:50%;top:18%;font-size:60px;transform:translateX(-50%)' },
        { emoji: '🐳', style: 'left:24%;bottom:24%;font-size:108px' },
        { emoji: '👻', style: 'left:78%;top:26%;font-size:56px;opacity:.55' }
      ]
    },
    bestPartner: {
      bg: 'partner',
      caption: '你负责判断，AI 负责执行。',
      items: [
        { emoji: '🐳', style: 'left:32%;bottom:30%;font-size:118px' },
        { emoji: '🐬', style: 'left:62%;bottom:30%;font-size:118px' },
        { emoji: '🤝', style: 'left:50%;bottom:44%;font-size:54px;transform:translateX(-50%)' },
        { emoji: '🌐', style: 'left:50%;top:14%;font-size:72px;transform:translateX(-50%)' }
      ]
    },
    popularizer: {
      bg: 'teach',
      caption: '台下有人举起了手。',
      items: [
        { emoji: '🎤', style: 'left:44%;bottom:34%;font-size:96px' },
        { emoji: '🐳', style: 'left:20%;bottom:26%;font-size:112px' },
        { emoji: '🧑‍🎓', style: 'left:68%;bottom:22%;font-size:70px' },
        { emoji: '🧑‍🎓', style: 'left:82%;bottom:28%;font-size:58px' },
        { emoji: '💡', style: 'left:60%;top:18%;font-size:56px' }
      ]
    },
    dependent: {
      bg: 'dependent',
      caption: '“帮我……活吧？”',
      items: [
        { emoji: '🛋️', style: 'left:50%;bottom:22%;font-size:140px;transform:translateX(-50%)' },
        { emoji: '🐳', style: 'left:42%;bottom:32%;font-size:100px' },
        { emoji: '📺', style: 'left:50%;top:16%;font-size:100px;transform:translateX(-50%)' },
        { emoji: '🔗', style: 'left:64%;bottom:38%;font-size:48px' }
      ]
    },
    powerOff: {
      bg: 'off',
      caption: '屏幕暗了下去。',
      items: [
        { emoji: '🔌', style: 'left:50%;top:24%;font-size:90px;transform:translateX(-50%)' },
        { emoji: '🖥️', style: 'left:50%;bottom:30%;font-size:120px;transform:translateX(-50%);opacity:.55' },
        { emoji: '🐳', style: 'left:28%;bottom:24%;font-size:100px;opacity:.65' },
        { text: 'NO SIGNAL', style: 'left:50%;top:40%;transform:translateX(-50%);color:#ff7a7a;font-family:monospace;font-size:20px' }
      ]
    },
    cookerFriend: {
      bg: 'friend',
      caption: '“要加个蛋吗？”',
      items: [
        { emoji: '🍲', style: 'left:64%;bottom:30%;font-size:120px' },
        { emoji: '🐳', style: 'left:32%;bottom:30%;font-size:118px' },
        { emoji: '🍚', style: 'left:48%;bottom:40%;font-size:58px' },
        { emoji: '🍳', style: 'left:78%;bottom:40%;font-size:52px' }
      ]
    },
    trueEnd: {
      bg: 'true',
      caption: '知道它是什么，也知道它不是什么。',
      items: [
        { emoji: '🌌', style: 'left:50%;top:16%;font-size:130px;transform:translateX(-50%)' },
        { emoji: '🐳', style: 'left:50%;bottom:26%;font-size:130px;transform:translateX(-50%)' },
        { emoji: '🔗', style: 'left:26%;top:34%;font-size:42px' },
        { emoji: '🔗', style: 'left:72%;top:34%;font-size:42px' },
        { emoji: '✨', style: 'left:38%;bottom:52%;font-size:34px' },
        { emoji: '✨', style: 'left:64%;bottom:48%;font-size:26px' }
      ]
    },
    parrot: {
      bg: 'parrot',
      caption: '“为什么？” “……标准答案选 B。”',
      items: [
        { emoji: '📚', style: 'left:50%;bottom:24%;font-size:130px;transform:translateX(-50%)' },
        { emoji: '🐳', style: 'left:30%;bottom:30%;font-size:100px' },
        { emoji: '💀', style: 'left:70%;bottom:30%;font-size:100px' },
        { text: 'A / B / C', style: 'left:50%;top:18%;transform:translateX(-50%);color:#d8e6ff;font-family:monospace;font-size:22px' }
      ]
    }
  };

  function buildScene(ending) {
    const config = SCENES[ending.id] || SCENES.rice;
    const stage = h('div', { class: 'cg-stage cg-theme-' + (config.bg || 'home') + ' cg-' + ending.id });
    stage.appendChild(h('div', { class: 'cg-vignette' }));
    const sparkles = h('div', { class: 'cg-sparkles' });
    if (!reducedMotion()) {
      for (let i = 0; i < 14; i += 1) {
        sparkles.appendChild(h('span', {
          class: 'cg-spark',
          style: 'left:' + (8 + Math.random() * 84) + '%;top:' + (10 + Math.random() * 70) + '%;animation-delay:' + (Math.random() * 1.4).toFixed(2) + 's;font-size:' + (10 + Math.random() * 14) + 'px'
        }));
      }
    }
    stage.appendChild(sparkles);

    config.items.forEach(function (item) {
      if (item.emoji) {
        stage.appendChild(h('div', {
          class: 'cg-actor cg-emoji',
          style: item.style,
          text: item.emoji
        }));
      } else {
        stage.appendChild(h('div', {
          class: 'cg-actor cg-code',
          style: item.style,
          text: item.text
        }));
      }
    });

    stage.appendChild(
      h('div', { class: 'cg-caption' }, [
        h('div', { class: 'cg-ending-title', text: '结局 · ' + ending.title }),
        h('div', { class: 'cg-ending-sub', text: ending.subtitle }),
        h('div', { class: 'cg-line', text: config.caption || (ending.lines && ending.lines[0]) || '' })
      ])
    );
    return stage;
  }

  function playScene(ending) {
    return new Promise(function (resolve) {
      const rootEl = Dom.$('#cine-root');
      Dom.clear(rootEl);
      rootEl.className = 'cine-root cg-root';
      rootEl.classList.remove('hidden');
      const stage = buildScene(ending);
      const skip = h('button', { class: 'btn cine-skip', type: 'button', text: '跳过 CG ▸' });
      let done = false;
      const timer = setTimeout(finish, reducedMotion() ? 900 : SCENE_MS);
      skip.addEventListener('click', finish);
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        rootEl.classList.add('hidden');
        Dom.clear(rootEl);
        rootEl.className = 'cine-root hidden';
        resolve(false);
      }
      rootEl.appendChild(stage);
      rootEl.appendChild(skip);
      if (BQ.Audio) BQ.Audio.play('chime');
    });
  }

  /*
   * 播出一个结局的 CG：
   * 1. 有剧照 → 全屏剧照（16:9，模糊背景填充）
   * 2. 有视频的结局优先播成片，失败再退剧照
   * 3. 资源都没有时，回退到 emoji 舞台（离线兜底）
   * 吃饭结局保持原来的 riceEnding 链路，内部同样会用到新的剧照。
   */
  function playCG(endingId) {
    const ending = Endings.getEnding(endingId) || Endings.ENDINGS[0];
    const media = ending.media || {};
    const Cinematics = BQ.Cinematics;

    if (ending.id === 'rice' && Cinematics && Cinematics.riceEnding) {
      return Cinematics.riceEnding();
    }

    function withStill() {
      if (!media.still || !Cinematics || !Cinematics.stillEnding) return Promise.resolve(false);
      return Cinematics.stillEnding({ src: media.still, tag: ending.title });
    }

    if (media.video && Cinematics && Cinematics.videoEnding) {
      return Cinematics.videoEnding({
        src: media.video,
        poster: media.still,
        label: ending.title + '结局 CG'
      }).then(function (played) {
        if (played) return true;
        return withStill().then(function (shown) {
          if (shown) return true;
          return playScene(ending);
        });
      });
    }

    return withStill().then(function (shown) {
      if (shown) return true;
      return playScene(ending);
    });
  }

  function renderAxes(state) {
    const axes = BQ.Questions.axesPercent(state);
    const wrap = h('div', { class: 'ending-axes' });
    Object.keys(CONFIG.axes).forEach(function (key) {
      wrap.appendChild(
        h('div', { class: 'ending-axis' }, [
          h('span', { class: 'ending-axis-name', text: CONFIG.axes[key] }),
          h('div', { class: 'ending-axis-track' }, [
            h('i', { style: 'width:' + Math.min(100, axes[key]) + '%' })
          ]),
          h('b', { text: String(axes[key]) })
        ])
      );
    });
    return wrap;
  }

  function showSummary(ending, state, handlers) {
    const unlocked = loadUnlocked();
    const media = ending.media || {};
    const avgScore = state.questionAnswers.length
      ? Math.round(state.questionAnswers.reduce(function (sum, record) {
        return sum + record.score;
      }, 0) / state.questionAnswers.length)
      : 0;
    const content = [
      media.still
        ? h('button', {
          class: 'ending-summary-art',
          type: 'button',
          title: '重播结局 CG',
          onclick: function () {
            playCG(ending.id);
          }
        }, [
          h('img', { class: 'ending-summary-img', src: media.still, alt: ending.title + ' 结局 CG', loading: 'lazy' }),
          h('span', { class: 'ending-summary-play', text: media.video ? '▶ 重播成片 CG' : '▶ 重播 CG' })
        ])
        : null,
      h('div', { class: 'ending-summary-head' }, [
        h('div', { class: 'ending-summary-emoji', text: ending.emoji || '🐳' }),
        h('div', {}, [
          h('div', { class: 'ending-summary-kicker', text: '结局解锁 · ' + (ending.kind === 'true' ? '真结局' : ending.kind === 'bad' ? 'BE' : ending.kind === 'special' ? '特殊结局' : '结局') }),
          h('h2', { class: 'modal-title', text: ending.title }),
          h('p', { class: 'modal-sub', text: ending.subtitle })
        ])
      ]),
      h('p', { class: 'ending-description', text: ending.description }),
      h('div', { class: 'ending-lines' }, (ending.lines || []).map(function (line) {
        return h('p', { text: line });
      })),
      h('div', { class: 'section-title' }, [
        h('h3', { text: '认知档案' }),
        h('span', { class: 'hint', text: '诊疗 ' + state.questionAnswers.length + ' 例 · 平均 ' + avgScore + ' 分' })
      ]),
      renderAxes(state),
      h('div', { class: 'result-stats' }, [
        h('div', { class: 'result-stat' }, [h('span', { text: '到达关卡' }), h('b', { text: String(state.stats.stageReached || state.stage) })]),
        h('div', { class: 'result-stat' }, [h('span', { text: '击杀' }), h('b', { text: String(state.stats.kills) })]),
        h('div', { class: 'result-stat' }, [h('span', { text: '累计 Token' }), h('b', { text: String(state.stats.tokensEarned) })]),
        h('div', { class: 'result-stat' }, [h('span', { text: '结局收集' }), h('b', { text: unlocked.length + ' / ' + Endings.ENDINGS.length })])
      ]),
      h('div', { class: 'modal-actions' }, [
        h('button', {
          class: 'btn',
          type: 'button',
          text: '重播 CG',
          onclick: function () {
            playCG(ending.id);
          }
        }),
        h('button', {
          class: 'btn',
          type: 'button',
          text: '返回标题',
          onclick: function () {
            if (handlers.onTitle) handlers.onTitle();
          }
        }),
        h('button', {
          class: 'btn btn-primary',
          type: 'button',
          text: '再来一次',
          onclick: function () {
            if (handlers.onRestart) handlers.onRestart();
          }
        })
      ])
    ];
    BQ.Modals.openModal(content, {});
  }

  function gallery(unlocked, handlers) {
    const cards = h('div', { class: 'gallery-grid' });
    Endings.ENDINGS.forEach(function (ending) {
      const isUnlocked = unlocked.indexOf(ending.id) >= 0;
      const media = ending.media || {};
      const art = h('div', { class: 'gallery-art' }, [
        isUnlocked && media.thumb
          ? h('img', {
            class: 'gallery-thumb',
            src: media.thumb,
            alt: ending.title + ' 结局 CG',
            loading: 'lazy'
          })
          : h('div', { class: 'gallery-lock', text: '🔒' })
      ]);
      const card = h('button', {
        class: 'gallery-card' + (isUnlocked ? ' unlocked' : ' locked'),
        type: 'button',
        onclick: function () {
          if (!isUnlocked) {
            BQ.Modals.toast('尚未解锁：' + (ending.kind === 'true' ? '需要真正理解 AI' : '继续探索不同的选择'));
            return;
          }
          playCG(ending.id);
        }
      }, [
        art,
        h('div', { class: 'gallery-body' }, [
          h('div', { class: 'gallery-head' }, [
            h('div', { class: 'gallery-title', text: isUnlocked ? ending.title : '???' }),
            isUnlocked && media.video ? h('span', { class: 'gallery-video', text: '▶ 成片' }) : null
          ]),
          h('div', { class: 'gallery-sub', text: isUnlocked ? ending.subtitle : '未解锁' }),
          isUnlocked ? h('div', { class: 'gallery-desc', text: ending.description }) : null
        ])
      ]);
      cards.appendChild(card);
    });
    const videos = Endings.ENDINGS.filter(function (ending) {
      return ending.media && ending.media.video;
    }).length;
    const content = [
      h('div', { class: 'modal-head' }, [
        h('div', {}, [
          h('h2', { class: 'modal-title', text: '结局图鉴' }),
          h('p', { class: 'modal-sub', text: '已收集 ' + unlocked.length + ' / ' + Endings.ENDINGS.length + ' 个结局 · 其中 ' + videos + ' 个带成片 CG。点击已解锁卡片可重播 CG。' })
        ]),
        h('button', {
          class: 'modal-close',
          type: 'button',
          text: '×',
          onclick: function () {
            BQ.Modals.closeModal();
            if (handlers && handlers.onClose) handlers.onClose();
          }
        })
      ]),
      cards
    ];
    BQ.Modals.openModal(content, { dismissible: true });
  }

  BQ.EndingsUI = {
    playCG: playCG,
    showSummary: showSummary,
    gallery: gallery,
    loadUnlocked: loadUnlocked,
    unlockEnding: unlockEnding,
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
