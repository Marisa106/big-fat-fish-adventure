/* 顶栏 / 侧栏 / 底栏 HUD */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const Dom = BQ.Dom;
  const h = Dom.h;
  const CONFIG = BQ.Config.CONFIG;
  const Questions = BQ.Questions;

  let handlers = {};
  let refs = {};
  let busy = false;
  let stunned = false;

  function mount(nextHandlers) {
    handlers = nextHandlers || {};
    mountTopbar();
    mountSidebar();
    mountDock();
    updateMuteLabel();
    updateMusicLabel();
  }

  function mountTopbar() {
    const bar = Dom.$('#topbar');
    Dom.clear(bar);
    bar.appendChild(
      h('div', { class: 'topbar-left' }, [
        h('div', { class: 'stage-chip' }, [
          h('span', { class: 'stage-label', id: 'stage-label', text: '第 1 / 40 关' }),
          h('span', { class: 'stage-sub', id: 'stage-sub', text: '认知森林' })
        ]),
        h('div', { class: 'question-chip', id: 'question-chip' }, [
          h('span', { text: 'AI 诊疗' }),
          h('b', { id: 'question-count', text: '0 / ' + Questions.CASES.length })
        ]),
        h('div', { class: 'boss-wrap hidden', id: 'boss-wrap' }, [
          h('div', { class: 'boss-row' }, [
            h('span', { class: 'boss-emoji', id: 'boss-emoji', text: '🍲' }),
            h('span', { class: 'boss-name', id: 'boss-name', text: '终焉电饭煲' }),
            h('span', { class: 'boss-hp-text', id: 'boss-hp-text', text: '0 / 0' })
          ]),
          h('div', { class: 'bar boss-bar' }, [h('i', { id: 'boss-fill', style: 'width:100%' })]),
          h('div', { class: 'boss-phase', id: 'boss-phase', text: '' })
        ])
      ])
    );
    refs.stageLabel = Dom.$('#stage-label');
    refs.stageSub = Dom.$('#stage-sub');
    refs.questionCount = Dom.$('#question-count');
    refs.bossWrap = Dom.$('#boss-wrap');
    refs.bossEmoji = Dom.$('#boss-emoji');
    refs.bossName = Dom.$('#boss-name');
    refs.bossHpText = Dom.$('#boss-hp-text');
    refs.bossFill = Dom.$('#boss-fill');
    refs.bossPhase = Dom.$('#boss-phase');

    const help = h('button', { class: 'icon-btn', id: 'btn-help', type: 'button', title: '玩法说明', text: '?' });
    help.addEventListener('click', function () {
      if (handlers.onHelp) handlers.onHelp();
    });
    const api = h('button', { class: 'icon-btn', id: 'btn-api-game', type: 'button', title: 'API 设置', text: '⚙' });
    api.addEventListener('click', function () {
      if (handlers.onApi) handlers.onApi();
    });
    const mute = h('button', { class: 'icon-btn', id: 'btn-mute', type: 'button', title: '音效开关', text: '🔊' });
    mute.addEventListener('click', function () {
      if (handlers.onMute) handlers.onMute();
      updateMuteLabel();
    });
    const music = h('button', { class: 'icon-btn', id: 'btn-music', type: 'button', title: '音乐开关', text: '🎵' });
    music.addEventListener('click', function () {
      if (handlers.onMusic) handlers.onMusic();
      updateMusicLabel();
    });
    const restart = h('button', { class: 'icon-btn', id: 'btn-restart', type: 'button', title: '重新开始', text: '↺' });
    restart.addEventListener('click', function () {
      if (handlers.onRestart) handlers.onRestart();
    });

    bar.appendChild(
      h('div', { class: 'topbar-right' }, [
        h('div', { class: 'token-chip', title: 'Token：认知森林里的蓝色代币' }, [
          h('span', { class: 'token-icon', text: 'T' }),
          h('span', { id: 'token-count', text: '0' })
        ]),
        help,
        api,
        music,
        mute,
        restart
      ])
    );
    refs.mute = mute;
    refs.music = music;
    refs.token = Dom.$('#token-count');
  }

  function mountSidebar() {
    const aside = Dom.$('#sidebar');
    Dom.clear(aside);
    aside.appendChild(
      h('div', { class: 'panel player-panel' }, [
        h('div', { class: 'player-head' }, [
          h('div', { class: 'player-avatar' }, [
            h('img', {
              class: 'avatar-img hidden',
              id: 'player-avatar-img',
              alt: ''
            }),
            h('span', { id: 'player-fish', text: '🐳' }),
            h('span', { class: 'avatar-class', id: 'player-class', text: '🛡️' })
          ]),
          h('div', {}, [
            h('div', { class: 'player-name', id: 'player-name', text: '战士·铁甲鱼' }),
            h('div', { class: 'player-tag', id: 'player-tag', text: '铁鳞护身，戟破全场' })
          ])
        ]),
        h('div', { class: 'hp-row' }, [
          h('span', { text: '生命' }),
          h('b', { id: 'hp-text', text: '120 / 120' })
        ]),
        h('div', { class: 'bar hp-bar', id: 'hp-bar' }, [h('i', { id: 'hp-fill', style: 'width:100%' })]),
        h('div', { class: 'ap-row' }, [
          h('span', { class: 'ap-label', text: '体力' }),
          h('div', { id: 'stamina-pips', class: 'ap-row', style: 'gap:5px;margin:0' }),
          h('span', { class: 'ap-num', id: 'stamina-num', text: '' })
        ]),
        h('div', { class: 'stun-chip hidden', id: 'stun-chip' }, [
          h('span', { text: '😵' }),
          h('span', { text: '被控制：下一个行动无效' })
        ]),
        h('div', { class: 'stat-grid', id: 'stat-grid' })
      ])
    );
    refs.hpText = Dom.$('#hp-text');
    refs.hpFill = Dom.$('#hp-fill');
    refs.hpBar = Dom.$('#hp-bar');
    refs.staminaPips = Dom.$('#stamina-pips');
    refs.staminaNum = Dom.$('#stamina-num');
    refs.statGrid = Dom.$('#stat-grid');
    refs.playerName = Dom.$('#player-name');
    refs.playerTag = Dom.$('#player-tag');
    refs.playerClass = Dom.$('#player-class');
    refs.playerFish = Dom.$('#player-fish');
    refs.avatarImg = Dom.$('#player-avatar-img');
    refs.stunChip = Dom.$('#stun-chip');

    aside.appendChild(
      h('div', { class: 'panel cognition-panel' }, [
        h('div', { class: 'panel-title' }, [
          h('span', { text: '认知档案' }),
          h('span', { class: 'hint', id: 'cognition-count', text: '0 题' })
        ]),
        h('div', { class: 'cognition-list', id: 'cognition-list' })
      ])
    );
    refs.cognitionList = Dom.$('#cognition-list');
    refs.cognitionCount = Dom.$('#cognition-count');

    aside.appendChild(h('div', { class: 'panel weapon-panel', id: 'weapon-panel' }));
    refs.weaponPanel = Dom.$('#weapon-panel');

    aside.appendChild(
      h('div', { class: 'panel log-panel' }, [
        h('div', { class: 'panel-title', text: '冒险日志' }),
        h('div', { class: 'log-list', id: 'log-list' })
      ])
    );
    refs.logList = Dom.$('#log-list');
  }

  function mountDock() {
    const dock = Dom.$('#dock');
    Dom.clear(dock);
    const skills = h('div', { class: 'dock-skills', id: 'dock-skills' });
    const rice = h('button', { class: 'btn rice-btn', id: 'btn-rice', type: 'button' }, [
      h('span', { text: '🍚 米饭' }),
      h('b', { id: 'rice-count', text: '×0' })
    ]);
    rice.addEventListener('click', function () {
      if (handlers.onRice) handlers.onRice();
    });
    const rest = h('button', { class: 'btn rest-btn', id: 'btn-rest', type: 'button' }, [
      h('span', { text: '😮‍💨 休息' }),
      h('kbd', { text: 'Space' })
    ]);
    rest.addEventListener('click', function () {
      if (handlers.onRest) handlers.onRest();
    });
    const struggle = h('button', { class: 'btn struggle-btn hidden', id: 'btn-struggle', type: 'button' }, [
      h('span', { text: '😵 挣扎' }),
      h('kbd', { text: 'Space' })
    ]);
    struggle.addEventListener('click', function () {
      if (handlers.onStruggle) handlers.onStruggle();
    });
    dock.appendChild(skills);
    dock.appendChild(
      h('div', { class: 'dock-actions' }, [
        h('span', { class: 'dock-hint', id: 'dock-hint', text: '击败全部怪物进入结算' }),
        struggle,
        rice,
        rest
      ])
    );
    refs.skills = skills;
    refs.rice = rice;
    refs.riceCount = Dom.$('#rice-count');
    refs.rest = rest;
    refs.struggle = struggle;
    refs.dock = dock;
    refs.dockHint = Dom.$('#dock-hint');
  }

  function updateMuteLabel() {
    const btn = refs.mute;
    if (!btn) return;
    const muted = BQ.Audio && BQ.Audio.isMuted();
    btn.textContent = muted ? '🔇' : '🔊';
    btn.title = muted ? '音效已关闭' : '音效已开启';
  }

  function updateMusicLabel() {
    const btn = refs.music;
    if (!btn) return;
    const muted = BQ.Bgm && BQ.Bgm.isMuted();
    btn.textContent = muted ? '🔇' : '🎵';
    btn.title = muted ? '音乐已关闭' : '音乐已开启';
  }

  function setBusy(next) {
    busy = !!next;
    if (refs.rest) refs.rest.disabled = busy || stunned;
    if (refs.rice) refs.rice.disabled = busy || stunned;
    if (refs.struggle) refs.struggle.disabled = busy;
    Dom.$$('.slot', refs.skills).forEach(function (el) {
      if (el.dataset.empty === '1') {
        el.disabled = true;
        return;
      }
      el.disabled = busy || stunned || el.dataset.disabled === '1';
    });
  }

  function setBossArt(boss) {
    const host = refs.bossEmoji;
    if (!boss.img) {
      host.classList.remove('has-img');
      delete host.dataset.img;
      host.textContent = boss.emoji;
      return;
    }
    if (host.dataset.img !== boss.img) {
      host.textContent = '';
      host.appendChild(h('img', { class: 'boss-img', src: boss.img, alt: '' }));
      host.dataset.img = boss.img;
    }
    host.classList.add('has-img');
  }

  function update(state) {
    if (!state) return;
    const player = state.player;
    const stats = player.stats;
    const boss = state.monsters.find(function (m) {
      return m.isBoss && !m.dead;
    });
    stunned = (player.stun || 0) > 0;
    if (refs.stunChip) refs.stunChip.classList.toggle('hidden', !stunned);
    if (refs.struggle) refs.struggle.classList.toggle('hidden', !stunned);
    if (refs.dock) refs.dock.classList.toggle('stunned', stunned);
    if (refs.dockHint) {
      refs.dockHint.textContent = stunned ? '被控制：点击「挣扎」跳过本回合' : '攻击 -1 体力 · 击败全部怪物进入结算';
    }

    refs.stageLabel.textContent = '第 ' + state.stage + ' / ' + CONFIG.campaign.stages + ' 关';
    if (boss) {
      refs.stageSub.textContent = 'BOSS 战 · ' + boss.name;
    } else if (state.phase === 'question') {
      refs.stageSub.textContent = 'AI 误解诊疗';
    } else if (state.phase === 'rune') {
      refs.stageSub.textContent = '传送符文已出现';
    } else if (state.phase === 'ending') {
      refs.stageSub.textContent = '旅程的终点';
    } else {
      refs.stageSub.textContent = '认知森林 · 击败全部怪物';
    }
    refs.token.textContent = String(player.tokens);
    refs.questionCount.textContent = String(state.questionAnswers.length) + ' / ' + Questions.CASES.length;

    if (boss) {
      refs.bossWrap.classList.remove('hidden');
      setBossArt(boss);
      refs.bossName.textContent = boss.name;
      refs.bossHpText.textContent = Math.max(0, Math.ceil(boss.hp)) + ' / ' + boss.maxHp;
      refs.bossFill.style.width = ((Math.max(0, boss.hp) / boss.maxHp) * 100).toFixed(1) + '%';
      const def = boss.bossDef;
      const phases = def && def.phases;
      const label = phases && phases[boss.phaseIdx] ? phases[boss.phaseIdx].label : '';
      refs.bossPhase.textContent = label || (def && def.title ? def.title : '');
    } else {
      refs.bossWrap.classList.add('hidden');
    }

    const hpPct = Math.max(0, Math.min(1, player.hp / stats.maxHp));
    refs.hpText.textContent = Math.ceil(player.hp) + ' / ' + stats.maxHp;
    refs.hpFill.style.width = (hpPct * 100).toFixed(1) + '%';
    refs.hpBar.classList.toggle('low', hpPct <= 0.3);

    refs.staminaPips.innerHTML = '';
    for (let i = 0; i < stats.stamina; i += 1) {
      refs.staminaPips.appendChild(h('span', { class: 'ap-pip' + (i >= player.stamina ? ' empty' : '') }));
    }
    refs.staminaNum.textContent = player.stamina + ' / ' + stats.stamina;

    const cls = CONFIG.classes[state.classId];
    refs.playerName.textContent = cls.name;
    refs.playerTag.textContent = cls.tagline;
    refs.playerClass.textContent = cls.emoji;
    if (refs.avatarImg && refs.playerFish) {
      if (cls.sprite) {
        if (refs.avatarImg.getAttribute('src') !== cls.sprite.icon) {
          refs.avatarImg.src = cls.sprite.icon;
        }
        refs.avatarImg.classList.remove('hidden');
        refs.playerFish.classList.add('hidden');
      } else {
        refs.avatarImg.classList.add('hidden');
        refs.playerFish.classList.remove('hidden');
      }
    }

    refs.statGrid.innerHTML = '';
    [
      ['攻击', stats.atk],
      ['射程', stats.range],
      ['体力', stats.stamina],
      ['暴击', Math.round(stats.crit * 100) + '%'],
      ['减伤', Math.round(stats.damageReduction * 100) + '%'],
      ['技能栏', player.skills.length + '/' + player.slots]
    ].forEach(function (pair) {
      refs.statGrid.appendChild(
        h('div', { class: 'stat-cell' }, [
          h('span', { text: pair[0] }),
          h('b', { text: String(pair[1]) })
        ])
      );
    });

    updateCognition(state);
    updateWeapon(state);
    updateSkills(state);
    updateLog(state);

    const phaseOk = state.phase === 'battle';
    const staminaFull = player.stamina >= stats.stamina;
    refs.rest.disabled = busy || stunned || !phaseOk || staminaFull;
    refs.rice.disabled = busy || stunned || !phaseOk || player.rice <= 0 || player.hp >= stats.maxHp;
    refs.riceCount.textContent = '×' + player.rice;
    refs.rice.title = player.rice > 0
      ? '吃掉一碗米饭，回复 ' + Math.round(CONFIG.shop.riceHealPct * 100) + '% 最大生命'
      : '米饭可以去蟹老板的商店购买';
    refs.rest.title = staminaFull ? '体力已满' : '恢复 ' + CONFIG.campaign.restStamina + ' 点体力，但怪物会趁机逼近';
  }

  function updateCognition(state) {
    const pct = Questions.axesPercent(state);
    refs.cognitionList.innerHTML = '';
    Object.keys(CONFIG.axes).forEach(function (key) {
      const value = pct[key] || 0;
      refs.cognitionList.appendChild(
        h('div', { class: 'cognition-row' }, [
          h('span', { class: 'cognition-name', text: CONFIG.axes[key] }),
          h('div', { class: 'cognition-track' }, [
            h('i', { style: 'width:' + Math.min(100, value) + '%' })
          ]),
          h('b', { class: 'cognition-value', text: String(value) })
        ])
      );
    });
    refs.cognitionCount.textContent = state.questionAnswers.length + ' 例';
  }

  function updateWeapon(state) {
    const weapon = state.player.weapon;
    const wdef = CONFIG.weapons[weapon.id];
    const stats = state.player.stats;
    const panel = refs.weaponPanel;
    panel.innerHTML = '';
    panel.appendChild(
      h('div', { class: 'weapon-head' }, [
        h('span', { class: 'weapon-emoji', text: wdef.emoji }),
        h('div', {}, [
          h('div', { class: 'weapon-name', text: wdef.name }),
          h('div', { class: 'weapon-lv', text: 'Lv ' + weapon.level + ' / ' + wdef.maxLevel })
        ])
      ])
    );
    let detail = '攻击 ' + stats.atk + ' · 射程 ' + stats.range;
    if (stats.splash > 0) detail += ' · 溅射 ' + Math.round(stats.splash * 100) + '%';
    if (stats.tokenAtkBonus > 0) detail += ' · 储备 +' + stats.tokenAtkBonus;
    panel.appendChild(h('div', { class: 'weapon-stats', text: detail }));
    if (weapon.level < wdef.maxLevel) {
      const cost = CONFIG.combat.weaponCostBase + CONFIG.combat.weaponCostPerLevel * (weapon.level - 1);
      panel.appendChild(
        h('div', { class: 'weapon-stats' }, [
          h('span', { text: '下一级：Lv ' + (weapon.level + 1) + ' · ' }),
          h('b', { text: cost + ' Token' }),
          h('span', { text: '（回合结算时升级）' })
        ])
      );
    } else {
      panel.appendChild(h('div', { class: 'weapon-stats', text: '已强化至极限。' }));
    }
  }

  function updateSkills(state) {
    const container = refs.skills;
    container.innerHTML = '';
    const player = state.player;
    for (let i = 0; i < player.slots; i += 1) {
      const owned = player.skills[i];
      if (!owned) {
        container.appendChild(
          h('button', {
            class: 'slot empty',
            type: 'button',
            disabled: true,
            title: '空技能格：每 5 关或商店可获得技能',
            dataset: { empty: '1' }
          }, [
            h('span', { class: 'slot-emoji', text: '＋' }),
            h('span', { class: 'slot-name', text: '空' })
          ])
        );
        continue;
      }
      const def = CONFIG.skillMap[owned.id];
      const isActive = def && def.type === 'active';
      const cooling = owned.cd > 0;
      const disabledAttr = !isActive || cooling;
      const slot = h('button', {
        class: 'slot' + (isActive ? ' active-skill' : ''),
        type: 'button',
        title: def ? def.name + ' Lv' + owned.level + '：' + (def.desc[owned.level - 1] || '') : owned.id,
        dataset: { skillId: owned.id, disabled: disabledAttr ? '1' : '0' }
      }, [
        h('span', { class: 'slot-emoji', text: def ? def.emoji : '❔' }),
        h('span', { class: 'slot-name', text: def ? def.name : owned.id }),
        h('span', { class: 'slot-lv', text: 'Lv' + owned.level })
      ]);
      if (cooling) {
        slot.appendChild(h('span', { class: 'slot-cd', text: String(owned.cd) }));
      }
      slot.disabled = busy || stunned || disabledAttr;
      if (isActive && !cooling) {
        slot.addEventListener('click', function () {
          if (handlers.onSkill) handlers.onSkill(owned.id);
        });
      }
      container.appendChild(slot);
    }
  }

  function updateLog(state) {
    const list = refs.logList;
    list.innerHTML = '';
    state.log.slice(-9).reverse().forEach(function (entry) {
      const cls = entry.text.indexOf('第 ') === 0 ? 'log-item stage' : 'log-item';
      list.appendChild(h('div', { class: cls, text: entry.text }));
    });
  }

  BQ.Hud = {
    mount: mount,
    update: update,
    setBusy: setBusy,
    updateMuteLabel: updateMuteLabel,
    updateMusicLabel: updateMusicLabel
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
