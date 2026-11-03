/* 技能：技能栏、学习/升级/替换、冷却与主动技能释放 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      Config: require('./config.js'),
      Combat: require('./combat.js'),
      Grid: require('./grid.js'),
      Stats: require('./stats.js')
    });
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Skills = factory(root.BQ);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BQ) {
  'use strict';

  const CONFIG = BQ.Config.CONFIG;
  const Combat = BQ.Combat;
  const Grid = BQ.Grid;
  const Stats = BQ.Stats;

  function def(skillId) {
    return CONFIG.skillMap[skillId] || null;
  }

  function findSkill(state, skillId) {
    for (let i = 0; i < state.player.skills.length; i += 1) {
      if (state.player.skills[i].id === skillId) return state.player.skills[i];
    }
    return null;
  }

  function isMax(owned) {
    const d = def(owned.id);
    return !!d && owned.level >= d.maxLevel;
  }

  function canLearn(state, skillId) {
    const d = def(skillId);
    if (!d) return false;
    if (findSkill(state, skillId)) return false;
    if (d.classOnly && d.classOnly !== state.classId) return false;
    return true;
  }

  function applyOnLearn(state, skillId, level, events) {
    const d = def(skillId);
    if (!d || !d.onLearn) return;
    const idx = Math.min(level, d.maxLevel) - 1;
    if (d.onLearn.healHp) {
      Combat.healPlayer(state, d.onLearn.healHp[idx], events);
    }
  }

  function learn(state, skillId, events) {
    if (!canLearn(state, skillId)) return false;
    state.player.skills.push({ id: skillId, level: 1, cd: 0 });
    Stats.recompute(state);
    applyOnLearn(state, skillId, 1, events);
    return true;
  }

  function upgrade(state, skillId, events) {
    const owned = findSkill(state, skillId);
    if (!owned) return false;
    const d = def(skillId);
    if (!d || owned.level >= d.maxLevel) return false;
    owned.level += 1;
    Stats.recompute(state);
    applyOnLearn(state, skillId, owned.level, events);
    return true;
  }

  function forget(state, skillId) {
    const before = state.player.skills.length;
    state.player.skills = state.player.skills.filter(function (s) {
      return s.id !== skillId;
    });
    if (state.player.skills.length === before) return false;
    Stats.recompute(state);
    return true;
  }

  function tick(state) {
    state.player.skills.forEach(function (s) {
      if (s.cd > 0) s.cd -= 1;
    });
  }

  function resetCooldowns(state) {
    state.player.skills.forEach(function (s) {
      s.cd = 0;
    });
  }

  function eligibleNew(state, pool) {
    const out = [];
    CONFIG.skills.forEach(function (d) {
      if (pool === 'boss' && d.rarity !== 'boss') return;
      if (pool !== 'boss' && d.rarity === 'boss') return;
      if (d.classOnly && d.classOnly !== state.classId) return;
      if (findSkill(state, d.id)) return;
      out.push(d);
    });
    return out;
  }

  function eligibleUpgrades(state, pool) {
    const out = [];
    state.player.skills.forEach(function (owned) {
      const d = def(owned.id);
      if (!d) return;
      if (pool === 'boss' && d.rarity !== 'boss') return;
      if (pool !== 'boss' && d.rarity === 'boss') return;
      if (owned.level >= d.maxLevel) return;
      out.push(d);
    });
    return out;
  }

  function generateChoices(state, opts) {
    const options = opts || {};
    const count = options.count || 3;
    const pool = options.pool === 'boss' ? 'boss' : 'normal';
    const rng = state.rng;
    const newPool = eligibleNew(state, pool);
    const upPool = eligibleUpgrades(state, pool);
    const used = new Set();
    const picks = [];

    for (let i = 0; i < count; i += 1) {
      const entries = [];
      newPool.forEach(function (d) {
        if (used.has(d.id)) return;
        entries.push([{ d: d, kind: 'new' }, d.rarity === 'rare' ? 1.2 : 1.8]);
      });
      upPool.forEach(function (d) {
        if (used.has(d.id)) return;
        entries.push([{ d: d, kind: 'upgrade' }, 1.5]);
      });
      if (!entries.length) {
        picks.push({
          type: 'token',
          amount: pool === 'boss' ? CONFIG.campaign.bossSkillFallbackTokens : CONFIG.campaign.skillFallbackTokens
        });
        continue;
      }
      const picked = rng.weighted(entries);
      used.add(picked.d.id);
      picks.push({
        type: 'skill',
        skillId: picked.d.id,
        kind: picked.kind
      });
    }
    return picks;
  }

  function applyChoice(state, choice, events) {
    if (!choice) return { type: 'none' };
    if (choice.type === 'token') {
      state.player.tokens += choice.amount;
      state.stats.tokensEarned += choice.amount;
      Stats.recompute(state);
      return { type: 'token', amount: choice.amount };
    }
    const owned = findSkill(state, choice.skillId);
    if (owned) {
      if (!upgrade(state, choice.skillId, events)) return { type: 'none' };
      return { type: 'upgrade', skillId: choice.skillId };
    }
    if (state.player.skills.length >= state.player.slots) {
      return { type: 'needsSwap', skillId: choice.skillId };
    }
    if (!learn(state, choice.skillId, events)) return { type: 'none' };
    return { type: 'new', skillId: choice.skillId };
  }

  function finishSwap(state, newSkillId, oldSkillId, events) {
    forget(state, oldSkillId);
    const ok = learn(state, newSkillId, events);
    return { ok: ok, oldSkillId: oldSkillId, newSkillId: newSkillId };
  }

  function canUse(state, skillId, target) {
    const owned = findSkill(state, skillId);
    const d = def(skillId);
    if (!owned || !d) return { ok: false, reason: '尚未掌握该技能' };
    if (d.type !== 'active') return { ok: false, reason: '被动技能无需释放' };
    if (owned.cd > 0) return { ok: false, reason: '冷却中（剩余 ' + owned.cd + ' 回合）' };

    const active = d.active;
    const player = state.player;
    if (active.target === 'tile') {
      if (!target || target.x == null || target.y == null) {
        return { ok: false, reason: '请选择目标格子' };
      }
      if (!Grid.inBounds(state.board, target.x, target.y)) {
        return { ok: false, reason: '目标超出棋盘' };
      }
      if (Grid.manhattan(player.pos, target) > active.range) {
        return { ok: false, reason: '目标超出施法距离' };
      }
      if (!Grid.hasLineOfSight(state.board, player.pos, target)) {
        return { ok: false, reason: '视线被遗迹挡住' };
      }
    } else if (active.target === 'enemy') {
      const monster = state.monsters.find(function (m) {
        return target && m.id === target.monsterId;
      });
      if (!monster) return { ok: false, reason: '请选择目标怪物' };
      if (Grid.manhattan(player.pos, monster.pos) > active.range) {
        return { ok: false, reason: '目标超出施法距离' };
      }
      if (!Grid.hasLineOfSight(state.board, player.pos, monster.pos)) {
        return { ok: false, reason: '视线被遗迹挡住' };
      }
    }
    return { ok: true, def: d, owned: owned };
  }

  function use(state, skillId, target, events) {
    const check = canUse(state, skillId, target);
    if (!check.ok) return { ok: false, reason: check.reason };
    const d = check.def;
    const owned = check.owned;
    const active = d.active;
    const idx = owned.level - 1;
    const stats = state.player.stats;
    const player = state.player;

    events.push({
      type: 'skill',
      id: d.id,
      name: d.name,
      emoji: d.emoji,
      target: target ? { x: target.x, y: target.y, monsterId: target.monsterId } : null
    });

    const power = 1 + (stats.skillPower || 0);
    let total = 0;

    if (active.damage) {
      const base = Math.round(stats.atk * active.damage[idx] * power);
      if (active.target === 'tile') {
        total += Combat.damageMonstersInRadius(
          state,
          { x: target.x, y: target.y },
          active.radius || 0,
          base,
          events
        );
      } else if (active.target === 'self') {
        total += Combat.damageMonstersInRadius(
          state,
          { x: player.pos.x, y: player.pos.y },
          active.radius || 0,
          base,
          events
        );
      } else if (active.target === 'enemy') {
        const monster = state.monsters.find(function (m) {
          return target && m.id === target.monsterId;
        });
        if (monster) total += Combat.damageMonster(state, monster, base, { events: events });
      }
    }

    if (active.freeze) {
      const radius = active.radius || 0;
      state.monsters.slice().forEach(function (monster) {
        if (monster.dead || monster.isBoss) return;
        if (Grid.manhattan(player.pos, monster.pos) > radius) return;
        monster.frozen = Math.max(monster.frozen, active.freeze);
        events.push({ type: 'freeze', id: monster.id, pos: { x: monster.pos.x, y: monster.pos.y } });
      });
    }

    if (active.healPct) {
      Combat.healPlayerPct(state, active.healPct[idx], events);
    }

    if (active.drain && total > 0) {
      Combat.healPlayer(state, total, events);
    }

    owned.cd = active.cooldown;
    return { ok: true, def: d, damage: total };
  }

  return {
    def: def,
    findSkill: findSkill,
    isMax: isMax,
    canLearn: canLearn,
    learn: learn,
    upgrade: upgrade,
    forget: forget,
    tick: tick,
    resetCooldowns: resetCooldowns,
    eligibleNew: eligibleNew,
    eligibleUpgrades: eligibleUpgrades,
    generateChoices: generateChoices,
    applyChoice: applyChoice,
    finishSwap: finishSwap,
    canUse: canUse,
    use: use
  };
});
