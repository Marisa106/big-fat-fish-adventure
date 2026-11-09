/* 控制器：界面状态机、行动编排、AI 误解诊疗、对话、结局与演出 */
(function (root) {
  'use strict';
  const BQ = (root.BQ = root.BQ || {});
  const Dom = BQ.Dom;
  const h = Dom.h;
  const CONFIG = BQ.Config.CONFIG;
  const Grid = BQ.Grid;
  const State = BQ.State;
  const P = BQ.Progression;
  const Skills = BQ.Skills;
  const Shop = BQ.Shop;
  const Stats = BQ.Stats;
  const Questions = BQ.Questions;
  const Endings = BQ.Endings;
  const AI = BQ.AI;
  const Render = BQ.Render;
  const Hud = BQ.Hud;
  const Modals = BQ.Modals;
  const EndingsUI = BQ.EndingsUI;
  const Cinematics = BQ.Cinematics;
  const Audio = BQ.Audio;
  const Bgm = BQ.Bgm;

  const App = {
    state: null,
    busy: false,
    targeting: null
  };

  const params = new URLSearchParams(root.location ? root.location.search : '');
  const isDev = params.get('dev') === '1';
  const isSelftest = params.get('selftest') === '1';

  function setBusy(next) {
    App.busy = !!next;
    Hud.setBusy(App.busy);
  }

  function toast(text) {
    if (text) Modals.toast(text);
  }

  function showScreen(name) {
    ['title', 'story', 'class', 'game'].forEach(function (key) {
      const el = Dom.$('#screen-' + key);
      if (el) el.classList.toggle('hidden', key !== name);
    });
  }

  function hideAllScreens() {
    ['title', 'story', 'class', 'game'].forEach(function (key) {
      const el = Dom.$('#screen-' + key);
      if (el) el.classList.add('hidden');
    });
  }

  function renderStory() {
    const box = Dom.$('#story-lines');
    Dom.clear(box);
    CONFIG.story.forEach(function (line) {
      box.appendChild(h('p', { text: line }));
    });
  }

  function renderClassCards() {
    const wrap = Dom.$('#class-cards');
    Dom.clear(wrap);
    ['warrior', 'mage'].forEach(function (id) {
      const cls = CONFIG.classes[id];
      const weapon = CONFIG.weapons[cls.weapon];
      const card = h('div', {
        class: 'class-card',
        role: 'button',
        tabindex: '0',
        'aria-label': '选择' + cls.name,
        style: '--class-glow:' + cls.color + '33',
        onclick: function () { startRun(cls.id); },
        onkeydown: function (event) {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            startRun(cls.id);
          }
        }
      }, [
        h('div', { class: 'class-art' }, [
          cls.sprite
            ? h('img', {
                class: 'class-portrait',
                src: cls.sprite.icon,
                alt: cls.name
              })
            : h('span', { class: 'class-emoji', text: cls.emoji }),
          h('span', { class: 'class-fish', text: cls.fish || '🐳' })
        ]),
        h('h3', { text: cls.name }),
        h('div', { class: 'class-tag', text: cls.tagline }),
        h('div', { class: 'class-stats' }, [
          h('div', { class: 'class-stat' }, ['生命', h('b', { text: cls.hp })]),
          h('div', { class: 'class-stat' }, ['攻击', h('b', { text: cls.atk })]),
          h('div', { class: 'class-stat' }, ['射程', h('b', { text: cls.range })]),
          h('div', { class: 'class-stat' }, ['体力', h('b', { text: cls.stamina })])
        ]),
        h('p', { class: 'class-weapon', text: weapon.emoji + ' ' + weapon.name + '：' + weapon.desc }),
        h('button', {
          class: 'btn btn-primary class-pick',
          type: 'button',
          text: '选择' + cls.short,
          onclick: function (event) {
            event.stopPropagation();
            startRun(cls.id);
          }
        })
      ]);
      wrap.appendChild(card);
    });
  }

  function toggleMute() {
    Audio.setMuted(!Audio.isMuted());
    updateMuteButtons();
  }

  function toggleMusic() {
    Bgm.setMuted(!Bgm.isMuted());
    updateMusicButtons();
  }

  function updateMusicButtons() {
    const btn = Dom.$('#btn-music-title');
    if (btn) {
      btn.textContent = Bgm.isMuted() ? '🔇 音乐关' : '🎵 音乐开';
    }
    if (BQ.Hud) Hud.updateMusicLabel();
  }

  function updateMuteButtons() {
    const btn = Dom.$('#btn-mute-title');
    if (btn) {
      btn.textContent = Audio.isMuted() ? '🔇 音效关' : '🔊 音效开';
    }
    if (BQ.Hud) Hud.updateMuteLabel();
  }

  function updateAiStatus() {
    const el = Dom.$('#ai-status');
    if (!el) return;
    const settings = AI.getSettings();
    el.textContent = 'AI：' + AI.modeLabel(settings);
    el.className = 'ai-status' + (AI.isConfigured(settings) ? ' online' : '');
    el.title = settings.mode === 'proxy'
      ? '本地代理：' + settings.proxyUrl
      : settings.mode === 'direct'
        ? '直连：' + settings.baseUrl
        : '使用内置本地评分';
  }

  function updateGalleryLabel() {
    const btn = Dom.$('#btn-gallery');
    if (!btn) return;
    const unlocked = EndingsUI.loadUnlocked();
    btn.textContent = '结局图鉴 (' + unlocked.length + '/' + Endings.ENDINGS.length + ')';
  }

  function openApiSettings() {
    Modals.apiSettings(AI.getSettings(), {
      onSave: function (settings) {
        AI.saveSettings(settings);
        updateAiStatus();
        toast('API 设置已保存：' + AI.modeLabel(AI.getSettings()));
      },
      onTest: function (settings) {
        return AI.testConnection(settings);
      },
      onClose: function () {
        updateAiStatus();
      }
    });
  }

  function openGallery() {
    EndingsUI.gallery(EndingsUI.loadUnlocked(), {
      onClose: updateGalleryLabel
    });
    updateGalleryLabel();
  }

  async function startRun(classId, options) {
    const opts = options || {};
    Audio.unlock();
    Audio.play('click');
    Modals.closeModal();
    App.targeting = null;
    App.busy = false;
    const run = State.createRun({
      classId: classId,
      seed: opts.seed == null ? Date.now() : opts.seed
    });
    if (opts.tokens) run.player.tokens = opts.tokens;
    if (opts.rice) run.player.rice = Math.min(CONFIG.shop.maxRice, opts.rice);
    if (opts.slots) run.player.slots = Math.max(4, Math.min(CONFIG.shop.maxSlots, opts.slots));
    if (opts.weaponLevel) {
      run.player.weapon.level = Math.max(1, Math.min(10, opts.weaponLevel));
      Stats.recompute(run);
      run.player.hp = run.player.stats.maxHp;
    }
    if (opts.skills && opts.skills.length) {
      opts.skills.forEach(function (id) { Skills.learn(run, id, null); });
    }
    if (opts.hp) {
      run.player.hp = Math.max(1, Math.min(run.player.stats.maxHp, opts.hp));
    }
    if (opts.stamina != null) {
      run.player.stamina = Math.max(0, Math.min(run.player.stats.stamina, opts.stamina));
    }
    if (opts.atk) {
      run.player.stats.atk = opts.atk;
    }
    if (opts.skipQuestions) run.devSkipQuestions = true;
    App.state = run;
    if (isDev && root) root.__BQ_STATE = run;
    showScreen('game');
    Hud.mount(hudHandlers);
    Render.init(run);
    refresh();
    if (root) root.__BQ_STAGE_READY = false;

    setBusy(true);
    const events = [];
    if (opts.stage && opts.stage > 1) {
      run.stage = Math.min(CONFIG.campaign.stages, opts.stage) - 1;
    }
    P.startRound(run, events, true);
    await handleRoundEvents(events);
    if (opts.stamina != null) {
      run.player.stamina = Math.max(0, Math.min(run.player.stats.stamina, opts.stamina));
    }
    if (opts.atk) {
      run.player.stats.atk = opts.atk;
    }
    if (opts.stun) {
      run.player.stun = Math.max(0, Math.min(3, opts.stun));
    }
    refresh();

    if (opts.panel) {
      await openDevPanel(opts.panel);
      return;
    }
    refresh();
    setBusy(false);
  }

  async function handleRoundEvents(events) {
    setBusy(true);
    if (root) root.__BQ_STAGE_READY = false;
    await Render.playEvents(events, App.state);
    refresh();
    const stageEvent = events.find(function (ev) { return ev.type === 'stage-start'; });
    if (stageEvent) {
      const sub = stageEvent.isBossStage ? 'BOSS 战 · ' + stageEvent.boss : '认知森林 · 击败全部怪物';
      await Render.showBanner('第 ' + stageEvent.stage + ' / ' + stageEvent.total + ' 关', sub, 1500);
    }
    const introEvent = events.find(function (ev) { return ev.type === 'boss-intro'; });
    if (introEvent) {
      const def = CONFIG.bosses.find(function (b) { return b.id === introEvent.bossId; });
      if (def) await Cinematics.bossIntro(def);
    }
    if (App.state && App.state.pendingQuestion) {
      await openQuestionFlow();
    }
    refresh();
    setBusy(false);
    if (root) root.__BQ_STAGE_READY = true;
  }

  function refresh() {
    if (!App.state) return;
    const state = App.state;
    const opts = {};
    if (state.phase === 'battle') {
      if (state.player.stamina >= CONFIG.campaign.moveCost) {
        opts.reachable = P.adjacentMoves(state);
      }
      const stats = state.player.stats;
      const attack = new Set();
      state.monsters.forEach(function (monster) {
        if (monster.dead) return;
        if (Grid.manhattan(state.player.pos, monster.pos) > stats.range) return;
        if (stats.range > 1 && !Grid.hasLineOfSight(state.board, state.player.pos, monster.pos)) return;
        attack.add(Grid.key(monster.pos));
      });
      opts.attack = attack;
    } else if (state.phase === 'rune') {
      const reach = new Set();
      Grid.neighbors(state.board, state.player.pos).forEach(function (tile) {
        if (Grid.isBlocked(state.board, tile.x, tile.y)) return;
        if (P.monsterAt(state, tile.x, tile.y)) return;
        reach.add(Grid.key(tile));
      });
      opts.reachable = reach;
    }
    if (App.targeting) opts.preview = skillPreviewSet();
    Render.draw(state, opts);
    Hud.update(state);
  }

  function skillPreviewSet() {
    const set = new Set();
    if (!App.targeting || !App.state) return set;
    const active = App.targeting.def.active || {};
    const player = App.state.player.pos;
    const range = active.range || 0;
    for (let y = 0; y < App.state.board.size; y += 1) {
      for (let x = 0; x < App.state.board.size; x += 1) {
        if (Grid.manhattan(player, { x: x, y: y }) > range) continue;
        if (range > 1 && !Grid.hasLineOfSight(App.state.board, player, { x: x, y: y })) continue;
        set.add(x + ',' + y);
      }
    }
    return set;
  }

  function onHover(tile) {
    Dom.$$('.tile.hover').forEach(function (el) { el.classList.remove('hover'); });
    if (!tile) return;
    const el = Dom.$('#board .tile[data-x="' + tile.x + '"][data-y="' + tile.y + '"]');
    if (el) el.classList.add('hover');
  }

  async function onTile(x, y) {
    if (App.busy || !App.state) return;
    const state = App.state;
    if (state.phase === 'question' || state.phase === 'dialogue' || state.phase === 'over' || state.phase === 'ending') return;
    if (App.targeting) {
      handleTargetTile(x, y);
      return;
    }
    if (state.phase === 'rune') {
      await doMove(x, y);
      return;
    }
    if (state.phase !== 'battle') return;
    const monster = P.monsterAt(state, x, y);
    if (monster) {
      await doAttack(monster);
      return;
    }
    await doMove(x, y);
  }

  function handleTargetTile(x, y) {
    const targeting = App.targeting;
    if (!targeting) return;
    if (targeting.target === 'enemy') {
      const monster = P.monsterAt(App.state, x, y);
      if (!monster) {
        toast('请点击射程内的怪物');
        return;
      }
      doSkill(targeting.skillId, { monsterId: monster.id, x: x, y: y });
      return;
    }
    doSkill(targeting.skillId, { x: x, y: y });
  }

  async function doMove(x, y) {
    if (App.busy) return;
    const res = P.movePlayer(App.state, x, y);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    await playAction(res);
  }

  async function doAttack(monster) {
    if (App.busy) return;
    const state = App.state;
    const stats = state.player.stats;
    const dist = Grid.manhattan(state.player.pos, monster.pos);
    if (dist > stats.range) {
      toast('超出攻击距离');
      return;
    }
    if (stats.range > 1 && !Grid.hasLineOfSight(state.board, state.player.pos, monster.pos)) {
      toast('视线被挡住了');
      return;
    }
    const res = P.playerAttack(state, monster.id);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    await playAction(res);
  }

  async function doSkill(skillId, target) {
    if (App.busy) return;
    App.targeting = null;
    const res = P.useSkill(App.state, skillId, target);
    if (!res.ok) {
      toast(res.reason);
      refresh();
      return;
    }
    await playAction(res);
  }

  function beginSkill(skillId) {
    if (App.busy || !App.state) return;
    const state = App.state;
    if (state.phase !== 'battle') return;
    if (state.player.stun > 0) {
      toast('被控制，无法行动；点击「挣扎」跳过本回合');
      return;
    }
    if (App.targeting && App.targeting.skillId === skillId) {
      App.targeting = null;
      refresh();
      return;
    }
    const def = Skills.def(skillId);
    const owned = Skills.findSkill(state, skillId);
    if (!def || !owned) return;
    if (def.type !== 'active') {
      toast('被动技能已经生效');
      return;
    }
    if (owned.cd > 0) {
      toast('技能冷却中（还需要 ' + owned.cd + ' 次行动）');
      return;
    }
    const active = def.active || {};
    if (active.target === 'self' || active.target === 'none' || !active.target) {
      doSkill(skillId, {});
      return;
    }
    App.targeting = { skillId: skillId, def: def, target: active.target, range: active.range };
    refresh();
    toast(active.target === 'enemy' ? '选择射程内的怪物（Esc 取消）' : '选择目标格子（Esc 取消）');
  }

  function cancelTargeting() {
    if (!App.targeting) return;
    App.targeting = null;
    refresh();
  }

  async function doRice() {
    if (App.busy || !App.state) return;
    const res = P.useRice(App.state);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    await playAction(res);
  }

  async function doRest() {
    if (App.busy || !App.state) return;
    const res = P.rest(App.state);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    await playAction(res);
  }

  async function doStruggle() {
    if (App.busy || !App.state) return;
    const res = P.struggle(App.state);
    if (!res.ok) {
      toast(res.reason);
      return;
    }
    await playAction(res);
  }

  function handleRestKey() {
    if (App.state && App.state.player.stun > 0) {
      doStruggle();
      return;
    }
    doRest();
  }

  async function playAction(res) {
    if (!res || !res.ok) {
      if (res && res.reason) toast(res.reason);
      return false;
    }
    setBusy(true);
    App.targeting = null;
    await Render.playEvents(res.events, App.state);
    refresh();

    if (App.state.phase === 'over') {
      await showDefeat();
      setBusy(false);
      return true;
    }
    if (App.state.phase === 'reward') {
      await handleRewards();
      refresh();
      setBusy(false);
      return true;
    }
    if (App.state.phase === 'rune') {
      toast('终焉电饭煲倒下了！走到传送符文上把它捡起来。');
      refresh();
      setBusy(false);
      return true;
    }
    if (App.state.phase === 'dialogue') {
      await handleFinalDialogue();
      setBusy(false);
      return true;
    }
    refresh();
    setBusy(false);
    return true;
  }

  async function handleRewards() {
    if (App.state.pendingBossDialogue) await bossDialogueFlow();
    if (App.state.pendingBossReward) await bossRewardFlow();
    if (App.state.pendingSkillReward) await skillRewardFlow();
    await rewardPanelFlow();
  }

  function chooseBossModal(reward) {
    return new Promise(function (resolve) {
      Modals.bossReward(App.state, reward, {
        onPick: function (choice) {
          Modals.closeModal();
          Audio.play('level');
          resolve(choice);
        }
      });
    });
  }

  function chooseSkillModal(reward) {
    return new Promise(function (resolve) {
      Modals.skillChoice(
        App.state,
        '第 ' + App.state.stage + ' 关 · 技能奖励',
        '每 5 关一次的成长机会：学习新技能，或升级已有技能。',
        reward.choices,
        {
          onPick: function (choice) {
            Modals.closeModal();
            Audio.play('click');
            resolve(choice);
          },
          onCancel: function () {
            Modals.closeModal();
            resolve(null);
          }
        }
      );
    });
  }

  function pickSwap(newSkillId) {
    return new Promise(function (resolve) {
      Modals.swapPicker(App.state, newSkillId, {
        onPick: function (oldId) {
          Modals.closeModal();
          resolve(oldId);
        },
        onCancel: function () {
          Modals.closeModal();
          resolve(null);
        }
      });
    });
  }

  async function bossDialogueFlow() {
    while (App.state.pendingBossDialogue) {
      const dialogue = App.state.pendingBossDialogue;
      const choiceId = await new Promise(function (resolve) {
        Modals.bossDialogue(dialogue, {
          onPick: function (id) {
            Modals.closeModal();
            resolve(id);
          }
        });
      });
      const applied = P.applyBossDialogue(App.state, choiceId);
      if (!applied.ok) {
        toast(applied.reason);
        continue;
      }
      refresh();
      await new Promise(function (resolve) {
        Modals.dialogueReply(dialogue.character, applied.choice.reply, {
          onContinue: function () {
            Modals.closeModal();
            resolve();
          }
        });
      });
      refresh();
    }
  }

  async function bossRewardFlow() {
    while (App.state.pendingBossReward) {
      const reward = App.state.pendingBossReward;
      const choice = await chooseBossModal(reward);
      const applied = P.applyChoice(App.state, choice);
      if (applied.result.type === 'needsSwap') {
        const oldId = await pickSwap(applied.result.skillId);
        if (!oldId) continue;
        P.swapAndApply(App.state, applied.result.skillId, oldId);
      }
      App.state.pendingBossReward = null;
      refresh();
    }
  }

  async function skillRewardFlow() {
    while (App.state.pendingSkillReward) {
      const reward = App.state.pendingSkillReward;
      const choice = await chooseSkillModal(reward);
      if (!choice) {
        App.state.player.tokens += CONFIG.campaign.skillFallbackTokens;
        App.state.stats.tokensEarned += CONFIG.campaign.skillFallbackTokens;
        Stats.recompute(App.state);
        toast('跳过技能奖励，获得 ' + CONFIG.campaign.skillFallbackTokens + ' Token');
        App.state.pendingSkillReward = null;
        refresh();
        continue;
      }
      const applied = P.applyChoice(App.state, choice);
      if (applied.result.type === 'needsSwap') {
        const oldId = await pickSwap(applied.result.skillId);
        if (!oldId) continue;
        P.swapAndApply(App.state, applied.result.skillId, oldId);
      }
      App.state.pendingSkillReward = null;
      refresh();
    }
  }

  function rewardPanelFlow() {
    return new Promise(function (resolve) {
      let working = false;
      function show() {
        if (!App.state || App.state.phase !== 'reward') {
          resolve();
          return;
        }
        Modals.rewardPanel(App.state, {
          onUpgrade: function () {
            const res = P.upgradeWeapon(App.state);
            if (!res.ok) toast(res.reason);
            else Audio.play('level');
            refresh();
            show();
          },
          onBuy: async function (index) {
            if (working) return;
            working = true;
            const res = Shop.buy(App.state, index);
            if (res.ok) {
              Audio.play('buy');
              refresh();
              working = false;
              show();
              return;
            }
            if (res.needsSwap) {
              const oldId = await pickSwap(res.skillId);
              if (oldId) {
                const done = Shop.completeBuyWithSwap(App.state, index, oldId);
                if (done.ok) Audio.play('level');
                else toast(done.reason);
              }
              working = false;
              refresh();
              show();
              return;
            }
            toast(res.reason || '无法购买');
            working = false;
            show();
          },
          onReroll: function () {
            const res = Shop.reroll(App.state);
            if (!res.ok) toast(res.reason);
            else Audio.play('click');
            refresh();
            show();
          },
          onNext: async function () {
            Modals.closeModal();
            const res = P.nextRound(App.state);
            if (!res.ok) {
              toast(res.reason);
              return;
            }
            await handleRoundEvents(res.events);
            resolve();
          }
        });
      }
      show();
    });
  }

  async function openQuestionFlow() {
    const pending = App.state.pendingQuestion;
    if (!pending) return;
    const answer = await new Promise(function (resolve) {
      Modals.caseFile(App.state, pending.level, pending.caseData, {
        onSubmit: function (submitted) {
          Modals.closeModal();
          resolve(submitted);
        }
      });
    });
    const settings = AI.getSettings();
    let judged = null;
    if (AI.isConfigured(settings)) {
      Modals.judging();
      const result = await AI.judge(pending.caseData, answer);
      Modals.closeModal();
      if (result.ok) {
        judged = result.judged;
      } else {
        toast('AI 点评失败，已使用本地评分：' + result.error);
      }
    }
    if (!judged) judged = Questions.localJudge(pending.caseData, answer);
    const applied = P.answerQuestion(App.state, answer, judged);
    if (!applied.ok) {
      toast(applied.reason);
      return;
    }
    refresh();
    await new Promise(function (resolve) {
      Modals.caseFeedback(App.state, pending.caseData, applied.record, {
        onContinue: function () {
          Modals.closeModal();
          resolve();
        }
      });
    });
    refresh();
  }

  async function handleFinalDialogue() {
    const dialogue = App.state.pendingFinalDialogue;
    if (!dialogue) return;
    const choiceId = await new Promise(function (resolve) {
      Modals.finalDialogue(dialogue, {
        onPick: function (id) {
          Modals.closeModal();
          resolve(id);
        }
      });
    });
    const applied = P.applyFinalDialogue(App.state, choiceId);
    if (!applied.ok) {
      toast(applied.reason);
      return;
    }
    refresh();
    await new Promise(function (resolve) {
      Modals.dialogueReply(dialogue.character, applied.choice.reply, {
        onContinue: function () {
          Modals.closeModal();
          resolve();
        }
      });
    });
    const ending = Endings.getEnding(applied.endingId);
    EndingsUI.unlockEnding(applied.endingId);
    updateGalleryLabel();
    await EndingsUI.playCG(applied.endingId);
    EndingsUI.showSummary(ending, App.state, {
      onRestart: function () { startRun(App.state.classId); },
      onTitle: function () { resetToTitle(); }
    });
    refresh();
  }

  async function showDefeat() {
    Modals.defeat(App.state, {
      onRestart: function () { startRun(App.state.classId); },
      onTitle: function () { resetToTitle(); }
    });
  }

  function resetToTitle() {
    Modals.closeModal();
    App.state = null;
    App.busy = false;
    App.targeting = null;
    showScreen('title');
    updateGalleryLabel();
    updateAiStatus();
    updateMuteButtons();
    if (root) root.__BQ_STAGE_READY = false;
  }

  function onNumber(num) {
    if (!App.state || App.busy) return;
    const owned = App.state.player.skills[num - 1];
    if (owned) beginSkill(owned.id);
  }

  function onMoveDirection(dx, dy) {
    if (!App.state || App.busy) return;
    if (App.state.phase !== 'battle' && App.state.phase !== 'rune') return;
    const x = App.state.player.pos.x + dx;
    const y = App.state.player.pos.y + dy;
    onTile(x, y);
  }

  /* ---------- dev 直达画面 ---------- */
  async function openDevPanel(kind) {
    const state = App.state;
    if (!state) return;
    if (kind === 'screen-gallery') {
      openGallery();
    } else if (kind === 'screen-api') {
      openApiSettings();
    } else if (kind === 'shop') {
      state.phase = 'reward';
      state.shop = Shop.createShop(state);
      refresh();
      Modals.rewardPanel(state, {
        onUpgrade: function () {},
        onBuy: function () {},
        onReroll: function () {},
        onNext: function () {}
      });
    } else if (kind === 'skills') {
      const choices = Skills.generateChoices(state, { count: 3 });
      Modals.skillChoice(state, '第 5 关 · 技能奖励', '每 5 关一次的成长机会。', choices, {
        onPick: function () {},
        onCancel: function () {}
      });
    } else if (kind === 'bossreward') {
      const choices = Skills.generateChoices(state, { count: 2, pool: 'boss' });
      Modals.bossReward(state, { bossName: '过拟合石像鬼', tokens: 100, choices: choices }, {
        onPick: function () {}
      });
    } else if (kind === 'swap') {
      const firstNew = Skills.eligibleNew(state, 'normal')[0];
      Modals.swapPicker(state, firstNew ? firstNew.id : 'power', {
        onPick: function () {},
        onCancel: function () {}
      });
    } else if (kind === 'bossintro') {
      const bossId = params.get('boss');
      const def = CONFIG.bosses.find(function (b) { return b.id === bossId; }) || CONFIG.bosses[0];
      await Cinematics.bossIntro(def);
    } else if (kind === 'rune') {
      state.monsters = [];
      state.boss = null;
      state.telegraph = null;
      const blocked = Grid.makeBlockedFn(state.board, new Set());
      const info = Grid.reachable(state.board, state.player.pos, blocked);
      let spot = null;
      info.dist.forEach(function (dist, key) {
        if (spot) return;
        if (dist > 0 && dist <= 3) spot = Grid.parseKey(key);
      });
      if (!spot) spot = { x: state.player.pos.x, y: state.player.pos.y };
      state.rune = { x: spot.x, y: spot.y };
      state.phase = 'rune';
      refresh();
      toast('走到传送符文上把它捡起来。');
    } else if (kind === 'final') {
      state.phase = 'dialogue';
      state.pendingFinalDialogue = {
        character: CONFIG.dialogues.final.character,
        line: CONFIG.dialogues.final.line,
        choices: CONFIG.dialogues.final.choices
      };
      refresh();
      handleFinalDialogue();
    } else if (kind === 'bossdialogue') {
      const d = CONFIG.dialogues.bosses.overfit;
      state.pendingBossDialogue = {
        id: 'overfit',
        character: d.character,
        line: d.line,
        choices: d.choices
      };
      Modals.bossDialogue(state.pendingBossDialogue, { onPick: function () {} });
    } else if (kind.indexOf('ending-summary-') === 0) {
      const id = kind.slice('ending-summary-'.length);
      EndingsUI.unlockEnding(id);
      EndingsUI.showSummary(Endings.getEnding(id) || Endings.ENDINGS[0], state, {
        onRestart: function () {},
        onTitle: function () {}
      });
    } else if (kind.indexOf('ending-') === 0) {
      const id = kind.slice('ending-'.length);
      EndingsUI.unlockEnding(id);
      await EndingsUI.playCG(id);
      const ending = Endings.getEnding(id) || Endings.ENDINGS[0];
      EndingsUI.showSummary(ending, state, { onRestart: function () {}, onTitle: function () {} });
    } else if (kind === 'gallery') {
      openGallery();
    } else if (kind === 'api') {
      openApiSettings();
    } else if (kind === 'defeat') {
      state.result = 'defeat';
      Modals.defeat(state, { onRestart: function () {}, onTitle: function () {} });
    }
  }

  async function devBootstrap() {
    const cls = params.get('class') === 'mage' ? 'mage' : 'warrior';
    const stage = Number(params.get('stage') || 1);
    const panel = params.get('panel') || '';
    const options = {
      seed: Number(params.get('seed') || 20261101),
      tokens: Number(params.get('tokens') || 120),
      rice: Number(params.get('rice') || 1),
      slots: Number(params.get('slots') || 4),
      hp: Number(params.get('hp') || 0),
      stamina: params.has('stamina') ? Number(params.get('stamina')) : null,
      atk: Number(params.get('atk') || 0),
      stun: Number(params.get('stun') || 0),
      skipQuestions: params.get('skipquestions') === '1' || params.get('skipcases') === '1',
      weaponLevel: Number(params.get('weapon') || 0),
      skills: (params.get('skills') || '').split(',').filter(Boolean),
      stage: stage,
      panel: panel
    };
    await startRun(cls, options);
  }

  /* ---------- 无头自检 ---------- */
  function runSelftest() {
    const out = Dom.$('#selftest-result');
    try {
      const state = State.createRun({ classId: 'mage', seed: 20260101 });
      P.startRound(state, [], true);
      let guard = 0;
      while (state.stage <= 6 && guard < 900) {
        guard += 1;
        if (state.phase === 'question') {
          const pending = state.pendingQuestion;
          const caseData = pending.caseData;
          const answer = {
            diagnosisId: caseData.diagnoses[0].id,
            checkIds: caseData.checks.filter(function (item) { return item.points >= 10; }).slice(0, 2).map(function (item) { return item.id; }),
            prescriptionId: caseData.prescriptions[0].id,
            text: ''
          };
          const judged = Questions.localJudge(caseData, answer);
          P.answerQuestion(state, answer, judged);
          continue;
        }
        if (state.phase === 'battle') {
          let inner = 0;
          while (state.phase === 'battle' && inner < 200) {
            inner += 1;
            const target = state.monsters.slice().sort(function (a, b) {
              return Grid.manhattan(a.pos, state.player.pos) - Grid.manhattan(b.pos, state.player.pos);
            })[0];
            if (!target) break;
            const dist = Grid.manhattan(target.pos, state.player.pos);
            const stats = state.player.stats;
            if (dist <= stats.range && (stats.range <= 1 || Grid.hasLineOfSight(state.board, state.player.pos, target.pos))) {
              P.playerAttack(state, target.id);
              continue;
            }
            if (state.player.stamina < 1) {
              if (!P.rest(state).ok) break;
              continue;
            }
            const path = Grid.findPath(state.board, state.player.pos, target.pos, new Set(
              state.monsters.filter(function (m) { return m !== target; }).map(function (m) { return Grid.key(m.pos); })
            ));
            if (!path || !path.length) {
              if (!P.rest(state).ok) break;
              continue;
            }
            if (!P.movePlayer(state, path[0].x, path[0].y).ok) break;
          }
          continue;
        }
        if (state.phase === 'reward') {
          if (state.pendingBossDialogue) P.applyBossDialogue(state, state.pendingBossDialogue.choices[0].id);
          if (state.pendingBossReward) {
            P.applyChoice(state, state.pendingBossReward.choices[0]);
            state.pendingBossReward = null;
          }
          if (state.pendingSkillReward) {
            P.applyChoice(state, state.pendingSkillReward.choices[0]);
            state.pendingSkillReward = null;
          }
          if (!P.nextRound(state).ok) break;
          continue;
        }
        break;
      }
      state.finalChoice = 'home';
      const sample = Endings.resolveEnding(state);
      out.dataset.status = 'pass';
      out.textContent = 'PASS stage=' + state.stage + ' kills=' + state.stats.kills
        + ' answers=' + state.questionAnswers.length
        + ' endings=' + Endings.ENDINGS.length
        + ' sample=' + sample;
    } catch (err) {
      out.dataset.status = 'fail';
      out.textContent = 'FAIL ' + (err && err.stack ? err.stack : String(err));
    }
  }

  /* ---------- 启动 ---------- */
  function init() {
    renderStory();
    renderClassCards();
    Bgm.bindAutoplay();
    updateMuteButtons();
    updateMusicButtons();
    updateAiStatus();
    updateGalleryLabel();

    const bind = function (id, fn) {
      const el = Dom.$(id);
      if (el) el.addEventListener('click', fn);
    };
    bind('#btn-start', function () {
      Audio.unlock();
      Audio.play('click');
      Bgm.start();
      showScreen('story');
    });
    bind('#btn-rules', function () { Modals.rules(); });
    bind('#btn-gallery', function () { Audio.play('click'); openGallery(); });
    bind('#btn-api', function () { Audio.play('click'); openApiSettings(); });
    bind('#btn-mute-title', toggleMute);
    bind('#btn-music-title', toggleMusic);
    bind('#btn-story-next', function () { Audio.play('click'); showScreen('class'); });
    bind('#btn-story-skip', function () { Audio.play('click'); showScreen('class'); });
    bind('#btn-class-back', function () { Audio.play('click'); showScreen('title'); });

    BQ.Input.init({
      onTile: onTile,
      onHover: onHover,
      onRest: handleRestKey,
      onNumber: onNumber,
      onEscape: cancelTargeting,
      onMoveDirection: onMoveDirection,
      onModalEscape: function () {}
    });

    showScreen('title');

    if (isDev) {
      const screen = params.get('screen');
      if (params.get('unlock') === 'all') {
        /* 截图用：一次性解锁全部结局，方便验收图鉴与各结局 CG */
        Endings.ENDINGS.forEach(function (ending) { EndingsUI.unlockEnding(ending.id); });
        updateGalleryLabel();
      }
      if (screen === 'story' || screen === 'class') {
        showScreen(screen);
      } else if (screen === 'gallery') {
        hideAllScreens();
        openGallery();
      } else if (screen === 'api') {
        hideAllScreens();
        openApiSettings();
      } else if (screen === 'beam') {
        hideAllScreens();
        Cinematics.beam();
      } else if (screen === 'home') {
        hideAllScreens();
        Cinematics.home();
      } else if (screen === 'ending-video') {
        hideAllScreens();
        Cinematics.riceEnding();
      } else if (screen === 'bossintro') {
        hideAllScreens();
        const bossId = params.get('boss');
        const def = CONFIG.bosses.find(function (b) { return b.id === bossId; }) || CONFIG.bosses[0];
        Cinematics.bossIntro(def);
      } else {
        devBootstrap().catch(function (err) {
          console.error('dev bootstrap failed', err);
        });
      }
    } else if (isSelftest) {
      setTimeout(runSelftest, 60);
    }
  }

  const hudHandlers = {
    onSkill: beginSkill,
    onRice: doRice,
    onRest: handleRestKey,
    onStruggle: doStruggle,
    onHelp: function () { Modals.rules(); },
    onMute: toggleMute,
    onMusic: toggleMusic,
    onApi: openApiSettings,
    onRestart: function () {
      if (App.state) {
        Modals.confirmRestart(function () { resetToTitle(); });
      }
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this);
