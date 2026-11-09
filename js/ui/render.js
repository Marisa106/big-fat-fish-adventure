/* 棋盘与实体渲染、事件动画回放 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const Dom = BQ.Dom;
  const h = Dom.h;
  const CONFIG = BQ.Config.CONFIG;
  const TILE_PCT = 100 / 9;

  let boardEl = null;
  let fxEl = null;
  let frameEl = null;
  let bannerEl = null;
  let tiles = [];
  let entityEls = new Map();
  let activeTimeouts = [];

  function sleep(ms) {
    return new Promise(function (resolve) {
      const id = setTimeout(resolve, ms);
      activeTimeouts.push(id);
    });
  }

  function positionFor(x, y) {
    return { left: x * TILE_PCT + '%', top: y * TILE_PCT + '%' };
  }

  function portalAt(state, x, y) {
    return state.board.portals.find(function (p) {
      return p.x === x && p.y === y;
    }) || null;
  }

  /* 传送门地面贴花：铺在实体层下面，不挡点击，也不影响寻路 */
  function syncPortals(state) {
    if (!fxEl) return;
    Dom.$$('.portal-decal', fxEl).forEach(function (el) {
      el.remove();
    });
    const size = state.board.size || 9;
    const step = 100 / size;
    /* 传送门贴花视觉上正好占一个格子，中心对齐格子中心 */
    const decalTiles = 1.15;
    state.board.portals.forEach(function (p) {
      if (!p.img) return;
      const cx = p.x + 0.5;
      const cy = p.y + 0.5;
      const el = h('div', {
        class: 'portal-decal',
        title: p.name ? p.name : '传送门',
        style:
          'left:' + (cx * step).toFixed(4) + '%;' +
          'top:' + (cy * step).toFixed(4) + '%;' +
          'width:' + (decalTiles * step).toFixed(4) + '%;' +
          'height:' + (decalTiles * step).toFixed(4) + '%;'
      }, [
        h('img', { class: 'portal-img', src: p.img, alt: p.name ? p.name : '传送门' })
      ]);
      el.dataset.portal = p.id || String(p.x) + ',' + String(p.y);
      fxEl.appendChild(el);
    });
  }

  function preloadArt(state) {
    const urls = [];
    Object.keys(CONFIG.monsters).forEach(function (key) {
      if (CONFIG.monsters[key].img) urls.push(CONFIG.monsters[key].img);
    });
    CONFIG.bosses.forEach(function (boss) {
      if (boss.img) urls.push(boss.img);
    });
    state.board.portals.forEach(function (p) {
      if (p.img) urls.push(p.img);
    });
    (CONFIG.board.grassArt || []).forEach(function (art) {
      if (art.img) urls.push(art.img);
    });
    (CONFIG.board.treeArt || []).forEach(function (art) {
      if (art.img) urls.push(art.img);
    });
    urls.forEach(function (src) {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
    });
  }

  function init(state) {
    boardEl = Dom.$('#board');
    fxEl = Dom.$('#board-fx');
    frameEl = Dom.$('#board-frame');
    bannerEl = Dom.$('#stage-banner');
    Dom.clear(boardEl);
    Dom.clear(fxEl);
    entityEls = new Map();
    tiles = [];
    activeTimeouts.forEach(function (id) {
      clearTimeout(id);
    });
    activeTimeouts = [];

    const size = state.board.size;
    /* 本局随机到的植被素材；没有配图时退回 emoji 图标 */
    const grass = state.decor && state.decor.grass;
    const tree = state.decor && state.decor.tree;
    /* 障碍格一半长草、一半长树，按坐标排序交替分配，保证每局两种都有 */
    const obstacleKeys = Array.from(state.board.blocked).sort();
    for (let y = 0; y < size; y += 1) {
      const row = [];
      for (let x = 0; x < size; x += 1) {
        const alt = (x + y) % 2 === 1;
        const obstacle = state.board.blocked.has(x + ',' + y);
        const portal = portalAt(state, x, y);
        const classes = ['tile'];
        if (alt) classes.push('alt');
        if (obstacle) classes.push('obstacle');
        if (portal) classes.push('portal');
        const tile = h('div', {
          class: classes.join(' '),
          role: 'gridcell',
          'aria-label':
            '第 ' + (x + 1) + ' 列 第 ' + (y + 1) + ' 行' +
            (obstacle ? ' 遗迹障碍' : portal ? ' 传送门·' + (portal.name || '') : ''),
          dataset: { x: String(x), y: String(y) }
        });
        if (obstacle) {
          const isGrass = obstacleKeys.indexOf(x + ',' + y) % 2 === 1;
          if (isGrass && grass && grass.img) {
            /* 逐格错开一点大小，避免同一张图复制粘贴的重复感 */
            const scale = 0.74 + ((x * 7 + y * 13) % 5) * 0.035;
            tile.dataset.grass = grass.id || '';
            tile.appendChild(h('img', {
              class: 'tile-mark tile-grass',
              src: grass.img,
              alt: '',
              draggable: false,
              style: '--grass-scale:' + scale.toFixed(2)
            }));
          } else if (!isGrass && tree && tree.img) {
            /* 树冠铺满格子，同样逐格错开一点大小 */
            const scale = 0.90 + ((x * 11 + y * 5) % 4) * 0.03;
            tile.dataset.tree = tree.id || '';
            tile.appendChild(h('img', {
              class: 'tile-mark tile-tree-art',
              src: tree.img,
              alt: '',
              draggable: false,
              style: '--tree-scale:' + scale.toFixed(2)
            }));
          } else {
            tile.appendChild(h('span', { class: 'tile-mark tile-tree', text: '🌳' }));
          }
        } else if (portal) {
          tile.title = portal.name || '传送门';
        }
        boardEl.appendChild(tile);
        row.push(tile);
      }
      tiles.push(row);
    }
    syncPortals(state);
    preloadArt(state);
    ensurePlayerEntity(state);
  }

  function baseClasses(x, y, state) {
    const classes = ['tile'];
    if ((x + y) % 2 === 1) classes.push('alt');
    if (state.board.blocked.has(x + ',' + y)) classes.push('obstacle');
    if (state.board.portals.some(function (p) { return p.x === x && p.y === y; })) classes.push('portal');
    return classes;
  }

  function draw(state, opts) {
    if (!boardEl) return;
    const options = opts || {};
    const reachable = options.reachable || null;
    const attack = options.attack || null;
    const preview = options.preview || null;
    const size = state.board.size;
    const telegraph = new Set();
    if (state.telegraph && Array.isArray(state.telegraph.tiles)) {
      state.telegraph.tiles.forEach(function (t) {
        telegraph.add(t.x + ',' + t.y);
      });
    }
    const runeKey = state.rune ? state.rune.x + ',' + state.rune.y : null;

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const tile = tiles[y][x];
        const key = x + ',' + y;
        const classes = baseClasses(x, y, state);
        if (reachable && reachable.has(key)) classes.push('reachable');
        if (attack && attack.has(key)) classes.push('attackable');
        if (telegraph.has(key)) classes.push('telegraph');
        if (preview && preview.has(key)) classes.push('preview');
        if (runeKey === key) classes.push('rune');
        tile.className = classes.join(' ');
      }
    }

    syncPlayer(state);
    syncMonsters(state);
    syncRune(state);
  }

  function ensurePlayerEntity(state) {
    let el = entityEls.get('player');
    const cls = CONFIG.classes[state.classId];
    if (!el) {
      const sprite = h('div', { class: 'entity-sprite' });
      if (cls.sprite) {
        BQ.Sprite.mount(sprite, cls.sprite);
      } else {
        sprite.textContent = cls.fish || '🐳';
      }
      sprite.title = cls.name;
      el = h('div', { class: 'entity entity-player', dataset: { id: 'player' } }, [
        h('span', { class: 'entity-ground' }),
        sprite,
        h('span', { class: 'entity-badge', text: state.classId === 'mage' ? '🔮' : '🛡️' }),
        h('span', { class: 'entity-status', text: '😵' }),
        h('div', { class: 'entity-hp' }, [h('i', { style: 'width:100%' })])
      ]);
      el.classList.toggle('has-art', !!cls.sprite);
      el.dataset.hp = String(state.player.hp);
      el.dataset.maxHp = String(state.player.stats.maxHp);
      fxEl.appendChild(el);
      entityEls.set('player', el);
    }
    const sprite = el.querySelector('.entity-sprite');
    if (sprite) {
      if (cls.sprite) {
        if (!sprite.classList.contains('sprite-art')) BQ.Sprite.mount(sprite, cls.sprite);
      } else {
        sprite.textContent = cls.fish || '🐳';
      }
      sprite.title = cls.name;
    }
    el.classList.toggle('has-art', !!cls.sprite);
    el.dataset.hp = String(state.player.hp);
    el.dataset.maxHp = String(state.player.stats.maxHp);
  }

  function applyPosition(el, x, y) {
    const pos = positionFor(x, y);
    el.style.left = pos.left;
    el.style.top = pos.top;
  }

  function syncPlayer(state) {
    ensurePlayerEntity(state);
    const el = entityEls.get('player');
    applyPosition(el, state.player.pos.x, state.player.pos.y);
    const fill = el.querySelector('.entity-hp > i');
    if (fill) {
      const pct = Math.max(0, Math.min(1, state.player.hp / state.player.stats.maxHp));
      fill.style.width = (pct * 100).toFixed(1) + '%';
    }
    el.classList.toggle('dead', !!state.player.dead);
    el.classList.toggle('stunned', (state.player.stun || 0) > 0);
  }

  function createMonsterEntity(monster) {
    let sprite = null;
    if (monster.img) {
      sprite = h('div', { class: 'entity-sprite' }, [
        h('img', { class: 'monster-img', src: monster.img, alt: monster.name || '' })
      ]);
    } else {
      sprite = h('div', { class: 'entity-sprite', text: monster.emoji });
    }
    const el = h('div', {
      class: 'entity entity-monster' + (monster.isBoss ? ' entity-boss' : ''),
      dataset: { id: String(monster.id) }
    }, [
      sprite,
      h('div', { class: 'entity-hp' }, [h('i', { style: 'width:100%' })])
    ]);
    el.classList.toggle('has-img', !!monster.img);
    if (monster.name) el.title = monster.name;
    if (monster.voice) {
      el.dataset.sfxBase = String(monster.voice.base || 320);
      el.dataset.sfxType = String(monster.voice.type || 'square');
    }
    el.dataset.hp = String(monster.hp);
    el.dataset.maxHp = String(monster.maxHp);
    applyPosition(el, monster.pos.x, monster.pos.y);
    fxEl.appendChild(el);
    entityEls.set(String(monster.id), el);
    return el;
  }

  function voiceFor(id) {
    const el = entityEls.get(String(id));
    if (!el || !el.dataset.sfxBase) return null;
    return { base: Number(el.dataset.sfxBase), type: el.dataset.sfxType || 'square' };
  }

  function syncMonsters(state) {
    const alive = new Set();
    state.monsters.forEach(function (monster) {
      if (monster.dead) return;
      const id = String(monster.id);
      alive.add(id);
      let el = entityEls.get(id);
      if (!el) {
        el = createMonsterEntity(monster);
        el.classList.add('spawn');
        setTimeout(function () {
          el.classList.remove('spawn');
        }, 340);
      }
      el.classList.toggle('entity-boss', !!monster.isBoss);
      el.dataset.hp = String(monster.hp);
      el.dataset.maxHp = String(monster.maxHp);
      applyPosition(el, monster.pos.x, monster.pos.y);
      const fill = el.querySelector('.entity-hp > i');
      if (fill) {
        const pct = Math.max(0, Math.min(1, monster.hp / monster.maxHp));
        fill.style.width = (pct * 100).toFixed(1) + '%';
      }
    });

    entityEls.forEach(function (el, id) {
      if (id === 'player' || id === 'rune') return;
      if (alive.has(id)) return;
      entityEls.delete(id);
      el.classList.add('dead');
      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 320);
    });
  }

  function syncRune(state) {
    const existing = entityEls.get('rune');
    if (state.rune) {
      let el = existing;
      if (!el) {
        el = h('div', { class: 'entity entity-rune', dataset: { id: 'rune' } }, [
          h('div', { class: 'entity-sprite', text: '🔷' })
        ]);
        fxEl.appendChild(el);
        entityEls.set('rune', el);
      }
      applyPosition(el, state.rune.x, state.rune.y);
      el.style.width = TILE_PCT + '%';
      el.style.height = TILE_PCT + '%';
      el.style.opacity = '1';
    } else if (existing) {
      entityEls.delete('rune');
      existing.parentNode.removeChild(existing);
    }
  }

  function bumpHp(id, delta) {
    const el = entityEls.get(String(id));
    if (!el) return;
    const max = Number(el.dataset.maxHp) || 1;
    let hp = Number(el.dataset.hp) || 0;
    hp = Math.max(0, Math.min(max, hp + delta));
    el.dataset.hp = String(hp);
    const fill = el.querySelector('.entity-hp > i');
    if (fill) fill.style.width = ((hp / max) * 100).toFixed(1) + '%';
  }

  function floatAt(x, y, text, cls) {
    if (!fxEl) return;
    const el = h('span', {
      class: 'float ' + (cls || ''),
      text: text,
      style:
        'left:' + ((x + 0.5) * TILE_PCT + (Math.random() * 8 - 4)) + '%;' +
        'top:' + ((y + 0.42) * TILE_PCT) + '%;'
    });
    fxEl.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 1000);
  }

  function shakeBoard() {
    if (!frameEl) return;
    frameEl.classList.remove('board-shake');
    void frameEl.offsetWidth;
    frameEl.classList.add('board-shake');
    setTimeout(function () {
      frameEl.classList.remove('board-shake');
    }, 340);
  }

  async function playEvents(events, state) {
    for (let i = 0; i < events.length; i += 1) {
      const ev = events[i];
      await playEvent(ev, state);
    }
    draw(state);
  }

  async function playEvent(ev, state) {
    switch (ev.type) {
      case 'player-move': {
        const el = entityEls.get('player');
        if (!el) return;
        const path = ev.path || [];
        for (let i = 0; i < path.length; i += 1) {
          applyPosition(el, path[i].x, path[i].y);
          BQ.Audio.play('move');
          await sleep(85);
        }
        await sleep(40);
        return;
      }
      case 'monster-move': {
        const el = entityEls.get(String(ev.id));
        if (!el) return;
        applyPosition(el, ev.to.x, ev.to.y);
        BQ.Audio.play('monsterMove', { voice: voiceFor(ev.id) });
        await sleep(170);
        return;
      }
      case 'attack': {
        let impact = Promise.resolve();
        const cls = CONFIG.classes[state.classId];
        if (ev.source === 'player' && cls && cls.sprite) {
          const playerEl = entityEls.get('player');
          const spriteEl = playerEl && playerEl.querySelector('.entity-sprite');
          if (spriteEl && BQ.Sprite) {
            impact = BQ.Sprite.playAttack(spriteEl, cls.sprite);
          }
        }
        await impact;
        const targetId = ev.targetId;
        if (targetId === 'player') {
          const el = entityEls.get('player');
          if (el) {
            el.classList.add('flash');
            setTimeout(function () { el.classList.remove('flash'); }, 220);
          }
        } else {
          const el = entityEls.get(String(targetId));
          if (el) {
            el.classList.add('flash');
            setTimeout(function () { el.classList.remove('flash'); }, 220);
          }
        }
        if (ev.source === 'player') {
          BQ.Audio.play('attack');
        } else {
          BQ.Audio.play('monsterAttack', { voice: voiceFor(ev.source) });
        }
        await sleep(110);
        return;
      }
      case 'damage': {
        const pos = ev.pos || { x: 0, y: 0 };
        if (ev.targetId === 'player') {
          floatAt(pos.x, pos.y, '-' + ev.amount, 'player-dmg');
          shakeBoard();
          BQ.Audio.play('hit');
          await sleep(180);
        } else {
          bumpHp(ev.targetId, -ev.amount);
          floatAt(pos.x, pos.y, (ev.crit ? '暴击 ' : '') + '-' + ev.amount, ev.crit ? 'crit' : 'dmg');
          const el = entityEls.get(String(ev.targetId));
          if (el) {
            el.classList.add('hit');
            setTimeout(function () { el.classList.remove('hit'); }, 300);
          }
          if (!ev.splash && !ev.thorns) BQ.Audio.play('hit');
          await sleep(120);
        }
        return;
      }
      case 'heal': {
        const pos = ev.pos || state.player.pos;
        floatAt(pos.x, pos.y, '+' + ev.amount, 'heal');
        BQ.Audio.play('heal');
        await sleep(150);
        return;
      }
      case 'rest': {
        const pos = ev.pos || state.player.pos;
        floatAt(pos.x, pos.y, '体力 +' + ev.amount, 'heal');
        BQ.Audio.play('heal');
        await sleep(160);
        return;
      }
      case 'kill': {
        const voice = ev.voice || voiceFor(ev.id);
        const el = entityEls.get(String(ev.id));
        if (el) {
          el.classList.add('dead');
          setTimeout(function () {
            if (el.parentNode) el.parentNode.removeChild(el);
          }, 320);
          entityEls.delete(String(ev.id));
        }
        if (ev.pos) {
          floatAt(ev.pos.x, ev.pos.y, '+' + ev.tokens, 'coin');
        }
        BQ.Audio.play('monsterDeath', { voice: voice });
        if (ev.isBoss) {
          BQ.Audio.play('boss');
        } else {
          setTimeout(function () { BQ.Audio.play('coin'); }, 190);
        }
        await sleep(240);
        return;
      }
      case 'spawn': {
        let el = entityEls.get(String(ev.id));
        if (!el) {
          el = createMonsterEntity({
            id: ev.id,
            name: ev.name,
            emoji: ev.emoji,
            img: ev.img,
            voice: ev.voice,
            hp: ev.hp || 1,
            maxHp: ev.maxHp || ev.hp || 1,
            pos: ev.pos,
            isBoss: !!ev.isBoss
          });
        }
        el.classList.add('spawn');
        setTimeout(function () { el.classList.remove('spawn'); }, 340);
        BQ.Audio.play('monsterSpawn', { voice: ev.voice, boss: !!ev.isBoss });
        await sleep(110);
        return;
      }
      case 'freeze': {
        const el = entityEls.get(String(ev.id));
        if (el) {
          el.classList.add('flash');
          setTimeout(function () { el.classList.remove('flash'); }, 240);
        }
        if (ev.pos) floatAt(ev.pos.x, ev.pos.y, '冰封', 'info');
        BQ.Audio.play('freeze');
        await sleep(110);
        return;
      }
      case 'freeze-skip': {
        if (ev.pos) floatAt(ev.pos.x, ev.pos.y, '冰封中', 'info');
        await sleep(90);
        return;
      }
      case 'boss-special': {
        const tiles = ev.tiles || [];
        for (let i = 0; i < tiles.length; i += 1) {
          const t = tiles[i];
          const frame = frameEl;
          if (!frame) continue;
          const tileEl = frame.querySelector('#board .tile[data-x="' + t.x + '"][data-y="' + t.y + '"]');
          if (tileEl) {
            tileEl.classList.add('telegraph');
            setTimeout(function () { tileEl.classList.remove('telegraph'); }, 500);
          }
        }
        if (ev.pos) floatAt(ev.pos.x, ev.pos.y, ev.name + (ev.control ? ' · 控制' : ''), 'info');
        shakeBoard();
        BQ.Audio.play('monsterAttack', { voice: voiceFor(ev.bossId) });
        await sleep(340);
        return;
      }
      case 'player-stun': {
        const pos = ev.pos || state.player.pos;
        floatAt(pos.x, pos.y, '被控制！', 'crit');
        shakeBoard();
        BQ.Audio.play('stun');
        await sleep(320);
        return;
      }
      case 'stun-skip': {
        const pos = ev.pos || state.player.pos;
        floatAt(pos.x, pos.y, '挣脱控制', 'info');
        BQ.Audio.play('stunBreak');
        await sleep(220);
        return;
      }
      case 'boss-phase': {
        shakeBoard();
        if (ev.pos) floatAt(ev.pos.x, ev.pos.y, ev.label || '阶段变化', 'crit');
        BQ.Audio.play('phase');
        await sleep(380);
        return;
      }
      case 'revive': {
        if (ev.pos) floatAt(ev.pos.x, ev.pos.y, '不死之身！+' + ev.amount, 'heal');
        BQ.Audio.play('chime');
        await sleep(380);
        return;
      }
      case 'rune-drop': {
        if (ev.pos) floatAt(ev.pos.x, ev.pos.y, '传送符文出现！', 'crit');
        BQ.Audio.play('chime');
        await sleep(320);
        return;
      }
      default:
        return;
    }
  }

  function showBanner(main, sub, duration) {
    if (!bannerEl) return Promise.resolve();
    bannerEl.innerHTML = '';
    bannerEl.appendChild(h('div', { class: 'banner-main', text: main }));
    if (sub) bannerEl.appendChild(h('div', { class: 'banner-sub', text: sub }));
    bannerEl.classList.remove('hidden');
    void bannerEl.offsetWidth;
    const hold = duration == null ? 2000 : duration;
    return new Promise(function (resolve) {
      setTimeout(function () {
        bannerEl.classList.add('hidden');
        resolve();
      }, hold);
    });
  }

  function tileCenter(x, y) {
    return { x: (x + 0.5) * TILE_PCT, y: (y + 0.5) * TILE_PCT };
  }

  function clearEffects() {
    if (!fxEl) return;
    Dom.$$('.float, .entity-rune', fxEl).forEach(function (el) {
      el.remove();
    });
    entityEls.delete('rune');
    activeTimeouts.forEach(function (id) {
      clearTimeout(id);
    });
    activeTimeouts = [];
  }

  BQ.Render = {
    init: init,
    draw: draw,
    playEvents: playEvents,
    showBanner: showBanner,
    floatAt: floatAt,
    shakeBoard: shakeBoard,
    clearEffects: clearEffects,
    tileCenter: tileCenter,
    getEntity: function (id) {
      return entityEls.get(String(id));
    }
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
