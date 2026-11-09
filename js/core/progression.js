/* 回合推进：移动/攻击/技能/休息、怪物反应、回合结算、AI 误解诊疗、对话与结局 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      Config: require('./config.js'),
      Grid: require('./grid.js'),
      Combat: require('./combat.js'),
      Skills: require('./skills.js'),
      Monsters: require('./monsters.js'),
      Stats: require('./stats.js'),
      Shop: require('./shop.js'),
      State: require('./state.js'),
      Questions: require('./questions.js'),
      Endings: require('./endings.js')
    });
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Progression = factory(root.BQ);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BQ) {
  'use strict';

  const CONFIG = BQ.Config.CONFIG;
  const Grid = BQ.Grid;
  const Combat = BQ.Combat;
  const Skills = BQ.Skills;
  const Monsters = BQ.Monsters;
  const Stats = BQ.Stats;
  const Shop = BQ.Shop;
  const State = BQ.State;
  const Questions = BQ.Questions;
  const Endings = BQ.Endings;

  const log = State.pushLog;

  function fail(reason) {
    return { ok: false, reason: reason };
  }

  function stunGuard(state) {
    if (state.phase === 'battle' && state.player.stun > 0) {
      return fail('被控制，无法行动；点击「挣扎」跳过本回合');
    }
    return null;
  }

  function isBossStage(stage) {
    return CONFIG.campaign.bossStages.indexOf(stage) >= 0;
  }

  function currentBoss(state) {
    return state.monsters.find(function (m) {
      return m.isBoss && !m.dead;
    }) || null;
  }

  function monsterAt(state, x, y) {
    return state.monsters.find(function (m) {
      return m.pos.x === x && m.pos.y === y && !m.dead;
    }) || null;
  }

  function occupiedMonsterSet(state) {
    const set = new Set();
    state.monsters.forEach(function (m) {
      if (!m.dead) set.add(Grid.key(m.pos));
    });
    return set;
  }

  function playerReachable(state) {
    const blocked = Grid.makeBlockedFn(state.board, occupiedMonsterSet(state));
    return Grid.reachable(state.board, state.player.pos, blocked);
  }

  function adjacentMoves(state) {
    const set = new Set();
    Grid.neighbors(state.board, state.player.pos).forEach(function (tile) {
      if (Grid.isBlocked(state.board, tile.x, tile.y)) return;
      if (monsterAt(state, tile.x, tile.y)) return;
      set.add(Grid.key(tile));
    });
    return set;
  }

  function attackRangeSet(state) {
    const set = new Set();
    const player = state.player.pos;
    const range = state.player.stats.range;
    for (let y = 0; y < state.board.size; y += 1) {
      for (let x = 0; x < state.board.size; x += 1) {
        if (Grid.manhattan(player, { x: x, y: y }) > range) continue;
        if (range > 1 && !Grid.hasLineOfSight(state.board, player, { x: x, y: y })) continue;
        set.add(x + ',' + y);
      }
    }
    return set;
  }

  function startRound(state, events, advance) {
    if (advance && state.stage < CONFIG.campaign.stages) state.stage += 1;
    state.phase = 'battle';
    state.pendingBoss = null;
    state.pendingBossReward = null;
    state.pendingSkillReward = null;
    state.pendingQuestion = null;
    state.pendingBossDialogue = null;
    state.pendingFinalDialogue = null;
    state.lastDialogue = null;
    state.boss = null;
    state.bossDefeated = false;
    state.lastBoss = null;
    state.telegraph = null;
    state.shop = null;
    state.rune = null;
    state.ending = null;
    state.player.dead = false;
    state.player.stun = 0;
    state.flags.skillOffered = false;
    state.flags.bossDialogueShown = false;
    state.flags.finalAnswered = false;

    Stats.recompute(state);
    state.player.stamina = state.player.stats.stamina;
    Skills.resetCooldowns(state);

    events.push({
      type: 'stage-start',
      stage: state.stage,
      isBossStage: isBossStage(state.stage),
      boss: CONFIG.bossByStage[state.stage] ? CONFIG.bossByStage[state.stage].name : null,
      total: CONFIG.campaign.stages
    });
    log(state, '第 ' + state.stage + ' 关 · 认知森林的怪物出现了');
    state.stats.stageReached = Math.max(state.stats.stageReached || 0, state.stage);

    const restHeal = Math.max(1, Math.round(state.player.stats.maxHp * CONFIG.campaign.regenPct));
    if (state.player.hp < state.player.stats.maxHp) {
      Combat.healPlayer(state, restHeal, events);
    }
    if (state.player.stats.regen > 0) {
      Combat.healPlayer(state, state.player.stats.regen, events);
    }

    Monsters.spawnWave(state, events);

    const level = state.stage;
    const shouldAsk = !state.devSkipQuestions
      && level >= CONFIG.campaign.caseStartLevel
      && level % CONFIG.campaign.caseEvery === 0
      && !Questions.levelHasCase(state, level);
    if (shouldAsk) {
      const caseData = Questions.caseByLevel(level);
      if (caseData) {
        state.pendingQuestion = { level: level, caseData: caseData };
        state.phase = 'question';
        events.push({ type: 'case-open', level: level, caseId: caseData.id, topic: caseData.topic });
      }
    }
    return { ok: true, events: events };
  }

  function answerQuestion(state, answer, judged) {
    if (state.phase !== 'question' || !state.pendingQuestion) {
      return fail('现在没有待处理的病例');
    }
    const pending = state.pendingQuestion;
    const result = judged || Questions.localJudge(pending.caseData, answer);
    const record = Questions.applyAnswer(state, pending.level, pending.caseData, answer || {}, result);
    state.pendingQuestion = null;
    state.phase = 'battle';
    state.stats.questionsAnswered += 1;
    log(state, '完成第 ' + pending.level + ' 关的 AI 误解诊疗「' + pending.caseData.title + '」，得分 ' + record.score);
    return {
      ok: true,
      record: record,
      events: [{ type: 'case-answered', record: record }]
    };
  }

  function startRunePhase(state, events) {
    state.phase = 'rune';
    state.monsters = [];
    state.telegraph = null;
    state.boss = null;
    const boss = state.lastBoss;
    state.rune = boss
      ? { x: boss.pos.x, y: boss.pos.y }
      : { x: CONFIG.board.start.x, y: CONFIG.board.start.y };
    state.player.stamina = state.player.stats.stamina;
    log(state, '终焉电饭煲倒下了。传送符文出现了！');
    events.push({ type: 'rune-drop', pos: { x: state.rune.x, y: state.rune.y } });
    return events;
  }

  function endRound(state, events) {
    state.phase = 'reward';
    state.telegraph = null;

    if (state.bossDefeated && state.stage !== CONFIG.campaign.stages) {
      const boss = state.lastBoss;
      if (boss) {
        Combat.healPlayer(state, Math.round(state.player.stats.maxHp * CONFIG.combat.bossHealPct), events);
        state.pendingBossReward = {
          bossName: boss.name,
          bossId: boss.bossDef ? boss.bossDef.id : null,
          tokens: boss.tokenValue,
          choices: Skills.generateChoices(state, { count: 2, pool: 'boss' })
        };
        const dialogue = boss.bossDef ? CONFIG.dialogues.bosses[boss.bossDef.id] : null;
        if (dialogue) {
          state.pendingBossDialogue = {
            id: boss.bossDef.id,
            character: dialogue.character,
            line: dialogue.line,
            choices: dialogue.choices
          };
        }
        log(state, boss.name + ' 被击败了，但它还有话想说。');
      }
    }

    if (state.stage % CONFIG.campaign.skillRewardEvery === 0
      && state.stage !== CONFIG.campaign.stages
      && !state.flags.skillOffered) {
      state.flags.skillOffered = true;
      state.pendingSkillReward = {
        choices: Skills.generateChoices(state, { count: 3 })
      };
    }

    state.shop = Shop.createShop(state);
    events.push({ type: 'reward-open', stage: state.stage });
    return { ok: true, events: events };
  }

  function afterPlayerAction(state, events) {
    if (state.pendingBoss) {
      state.bossDefeated = true;
      state.lastBoss = state.pendingBoss;
      state.pendingBoss = null;
      state.telegraph = null;
    }

    Monsters.reactAll(state, events);

    if (state.player.dead) {
      state.phase = 'over';
      state.result = 'defeat';
      log(state, '大肥鱼倒在了认知森林里……');
      events.push({ type: 'defeat' });
      return { ok: true, events: events };
    }

    if (state.monsters.length === 0) {
      state.player.stun = 0;
      if (state.stage === CONFIG.campaign.stages && state.bossDefeated) {
        startRunePhase(state, events);
      } else {
        endRound(state, events);
      }
    }
    return { ok: true, events: events };
  }

  function movePlayer(state, x, y) {
    if (state.phase !== 'battle' && state.phase !== 'rune') {
      return fail('现在不能移动');
    }
    const lock = stunGuard(state);
    if (lock) return lock;
    if (!Grid.inBounds(state.board, x, y)) return fail('目标超出棋盘');
    if (Grid.isBlocked(state.board, x, y)) return fail('那里是认知障碍');
    if (monsterAt(state, x, y)) return fail('那里有怪物挡路');
    if (Grid.manhattan(state.player.pos, { x: x, y: y }) !== 1) {
      return fail('每次只能移动一格');
    }

    if (state.phase === 'battle') {
      if (state.player.stamina < CONFIG.campaign.moveCost) {
        return fail('体力不足，先休息一下吧');
      }
      state.player.stamina -= CONFIG.campaign.moveCost;
      Skills.tick(state);
    }

    state.player.pos = { x: x, y: y };
    const events = [{ type: 'player-move', path: [{ x: x, y: y }], free: state.phase === 'rune' }];

    if (state.phase === 'rune') {
      if (state.rune && state.rune.x === x && state.rune.y === y) {
        state.phase = 'dialogue';
        state.pendingFinalDialogue = {
          character: CONFIG.dialogues.final.character,
          line: CONFIG.dialogues.final.line,
          choices: CONFIG.dialogues.final.choices
        };
        state.flags.finalAnswered = false;
        log(state, '大肥鱼拾起了传送符文。');
        events.push({ type: 'rune-pickup', pos: { x: x, y: y } });
        events.push({ type: 'final-dialogue-open' });
      }
      return { ok: true, events: events };
    }

    if (state.pendingQuestion) {
      return { ok: true, events: events };
    }
    return afterPlayerAction(state, events);
  }

  function playerAttack(state, monsterId) {
    if (state.phase !== 'battle') return fail('现在不能攻击');
    const lock = stunGuard(state);
    if (lock) return lock;
    const monster = state.monsters.find(function (m) {
      return m.id === monsterId && !m.dead;
    });
    if (!monster) return fail('目标已经不存在');
    const stats = state.player.stats;
    const dist = Grid.manhattan(state.player.pos, monster.pos);
    if (dist > stats.range) return fail('超出攻击距离');
    if (stats.range > 1 && !Grid.hasLineOfSight(state.board, state.player.pos, monster.pos)) {
      return fail('视线被挡住了');
    }
    const cost = Math.max(0, Number(CONFIG.campaign.attackCost) || 0);
    if (state.player.stamina < cost) {
      return fail('体力不足，先休息一下');
    }
    state.player.stamina -= cost;

    Skills.tick(state);
    const events = [];
    const result = Combat.playerAttack(state, monster, events);
    log(state, '大肥鱼攻击 ' + monster.name + '，造成 ' + result.damage + ' 点伤害' + (result.crit ? '（暴击！）' : ''));
    return afterPlayerAction(state, events);
  }

  function useSkill(state, skillId, target) {
    if (state.phase !== 'battle') return fail('现在不能释放技能');
    const lock = stunGuard(state);
    if (lock) return lock;
    Skills.tick(state);
    const events = [];
    const result = Skills.use(state, skillId, target, events);
    if (!result.ok) return fail(result.reason);
    const def = CONFIG.skillMap[skillId];
    log(state, '大肥鱼释放「' + (def ? def.name : skillId) + '」');
    return afterPlayerAction(state, events);
  }

  function rest(state) {
    if (state.phase !== 'battle') return fail('现在不能休息');
    const lock = stunGuard(state);
    if (lock) return lock;
    if (state.player.stamina >= state.player.stats.stamina) return fail('体力已经满了');
    const before = state.player.stamina;
    state.player.stamina = Math.min(
      state.player.stats.stamina,
      state.player.stamina + CONFIG.campaign.restStamina
    );
    Skills.tick(state);
    const events = [{
      type: 'rest',
      amount: state.player.stamina - before,
      pos: { x: state.player.pos.x, y: state.player.pos.y }
    }];
    log(state, '大肥鱼喘了口气，恢复 ' + (state.player.stamina - before) + ' 点体力');
    return afterPlayerAction(state, events);
  }

  /* 被 Boss 控制后，用一次“挣扎”消耗掉这次行动，怪物会再行动一轮 */
  function struggle(state) {
    if (state.phase !== 'battle') return fail('现在不能挣扎');
    if (!state.player.stun || state.player.stun <= 0) return fail('现在没有被控制');
    state.player.stun = 0;
    Skills.tick(state);
    const events = [{ type: 'stun-skip', pos: { x: state.player.pos.x, y: state.player.pos.y } }];
    log(state, '大肥鱼挣脱了控制，但这一回合无法行动');
    return afterPlayerAction(state, events);
  }

  function useRice(state) {
    if (state.phase !== 'battle' && state.phase !== 'reward') return fail('现在不能吃米饭');
    const lock = stunGuard(state);
    if (lock) return lock;
    if (state.player.rice <= 0) return fail('没有米饭了，去商店买一碗吧');
    if (state.player.hp >= state.player.stats.maxHp) return fail('生命已满');
    state.player.rice -= 1;
    state.stats.riceEaten += 1;
    const events = [];
    Combat.healPlayerPct(state, CONFIG.shop.riceHealPct, events);
    log(state, '大肥鱼吃掉一碗米饭，恢复了一些生命');
    return { ok: true, events: events };
  }

  function upgradeWeapon(state) {
    if (state.phase !== 'reward') return fail('只能在回合结算时升级武器');
    const weapon = state.player.weapon;
    const wdef = CONFIG.weapons[weapon.id];
    if (weapon.level >= wdef.maxLevel) return fail('武器已经满级');
    const cost = CONFIG.combat.weaponCostBase + CONFIG.combat.weaponCostPerLevel * (weapon.level - 1);
    if (state.player.tokens < cost) return fail('Token 不足（需要 ' + cost + '）');
    state.player.tokens -= cost;
    weapon.level += 1;
    Stats.recompute(state);
    const events = [];
    if (wdef.hpBonusEvery && weapon.level % wdef.hpBonusEvery === 0) {
      Combat.healPlayer(state, wdef.hpBonus, events);
    }
    log(state, wdef.name + ' 升级到 Lv' + weapon.level);
    return { ok: true, cost: cost, events: events };
  }

  function nextRound(state) {
    if (state.phase !== 'reward') return fail('现在不能开始下一关');
    state.phase = 'battle';
    state.pendingBossReward = null;
    state.pendingSkillReward = null;
    state.pendingBossDialogue = null;
    state.shop = null;
    const events = [];
    startRound(state, events, true);
    return { ok: true, events: events };
  }

  function applyChoice(state, choice) {
    const events = [];
    const result = Skills.applyChoice(state, choice, events);
    if (result.type === 'token') {
      log(state, '获得 ' + result.amount + ' Token');
    } else if (result.type === 'upgrade') {
      const def = CONFIG.skillMap[result.skillId];
      if (def) log(state, '技能「' + def.name + '」升级！');
    } else if (result.type === 'new') {
      const def = CONFIG.skillMap[result.skillId];
      if (def) log(state, '学会了技能「' + def.name + '」');
    }
    return { ok: true, result: result, events: events };
  }

  function swapAndApply(state, newSkillId, oldSkillId) {
    const events = [];
    const result = Skills.finishSwap(state, newSkillId, oldSkillId, events);
    const def = CONFIG.skillMap[newSkillId];
    if (def) log(state, '遗忘了旧技能，学会「' + def.name + '」');
    return { ok: true, result: result, events: events };
  }

  function mergeAxes(state, axes) {
    if (!axes) return;
    Object.keys(state.axes).forEach(function (key) {
      if (typeof axes[key] === 'number') {
        state.axes[key] += Math.max(0, axes[key]);
      }
    });
  }

  function applyBossDialogue(state, choiceId) {
    if (!state.pendingBossDialogue) return fail('现在没有对话');
    const dialogue = state.pendingBossDialogue;
    const choice = dialogue.choices.find(function (item) {
      return item.id === choiceId;
    });
    if (!choice) return fail('无效的对话选项');
    mergeAxes(state, choice.axes);
    state.lastDialogue = {
      id: dialogue.id,
      choiceId: choice.id,
      reply: choice.reply
    };
    state.pendingBossDialogue = null;
    log(state, '对话：' + choice.text);
    return { ok: true, choice: choice };
  }

  function applyFinalDialogue(state, choiceId) {
    if (state.phase !== 'dialogue' || !state.pendingFinalDialogue) {
      return fail('现在没有最终对话');
    }
    const dialogue = state.pendingFinalDialogue;
    const choice = dialogue.choices.find(function (item) {
      return item.id === choiceId;
    });
    if (!choice) return fail('无效的结局选择');
    mergeAxes(state, choice.axes);
    state.finalChoice = choice.id;
    state.flags.finalAnswered = true;
    state.pendingFinalDialogue = null;
    state.lastDialogue = {
      id: 'final',
      choiceId: choice.id,
      reply: choice.reply
    };
    state.ending = {
      id: Endings.resolveEnding(state),
      choiceId: choice.id,
      at: Date.now()
    };
    state.phase = 'ending';
    state.result = 'victory';
    log(state, '结局选择：' + choice.text);
    return {
      ok: true,
      choice: choice,
      endingId: state.ending.id,
      events: [{ type: 'ending-start', endingId: state.ending.id, choiceId: choice.id }]
    };
  }

  function resolveEndingPreview(state) {
    return Endings.resolveEnding(state);
  }

  return {
    isBossStage: isBossStage,
    currentBoss: currentBoss,
    monsterAt: monsterAt,
    playerReachable: playerReachable,
    adjacentMoves: adjacentMoves,
    attackRangeSet: attackRangeSet,
    startRound: startRound,
    answerQuestion: answerQuestion,
    movePlayer: movePlayer,
    playerAttack: playerAttack,
    useSkill: useSkill,
    rest: rest,
    struggle: struggle,
    useRice: useRice,
    usePotion: useRice,
    upgradeWeapon: upgradeWeapon,
    nextRound: nextRound,
    applyChoice: applyChoice,
    swapAndApply: swapAndApply,
    applyBossDialogue: applyBossDialogue,
    applyFinalDialogue: applyFinalDialogue,
    resolveEndingPreview: resolveEndingPreview
  };
});
