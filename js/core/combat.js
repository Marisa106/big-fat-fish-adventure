/* 伤害结算：玩家攻击、技能伤害、怪物攻击、治疗与死亡 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      Config: require('./config.js'),
      Stats: require('./stats.js')
    });
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Combat = factory(root.BQ);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BQ) {
  'use strict';

  const CONFIG = BQ.Config.CONFIG;
  const Stats = BQ.Stats;

  function manhattan(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  function healPlayer(state, amount, events) {
    const player = state.player;
    if (!amount || amount <= 0) return 0;
    const before = player.hp;
    player.hp = Math.min(player.stats.maxHp, player.hp + Math.round(amount));
    const gained = player.hp - before;
    if (gained > 0 && events) {
      events.push({
        type: 'heal',
        targetId: 'player',
        amount: gained,
        pos: { x: player.pos.x, y: player.pos.y }
      });
    }
    return gained;
  }

  function healPlayerPct(state, pct, events) {
    return healPlayer(state, state.player.stats.maxHp * pct, events);
  }

  function killMonster(state, monster, events) {
    if (monster.dead) return;
    monster.dead = true;
    monster.hp = 0;
    state.monsters = state.monsters.filter(function (m) {
      return m !== monster;
    });
    const tokens = Math.max(0, Math.round((monster.tokenValue || 0) * state.player.stats.tokenMult));
    state.player.tokens += tokens;
    state.stats.tokensEarned += tokens;
    state.stats.kills += 1;
    /* 「知识储备」按当前 Token 加攻，击杀后立即刷新 */
    Stats.recompute(state);
    if (monster.isBoss) {
      state.pendingBoss = monster;
      state.telegraph = null;
    }
    if (events) {
      events.push({
        type: 'kill',
        id: monster.id,
        name: monster.name,
        emoji: monster.emoji,
        img: monster.img,
        voice: monster.voice,
        pos: { x: monster.pos.x, y: monster.pos.y },
        tokens: tokens,
        isBoss: !!monster.isBoss
      });
    }
  }

  function damageMonster(state, monster, amount, opts) {
    const options = opts || {};
    if (!monster || monster.dead) return 0;
    const dmg = Math.max(1, Math.round(amount));
    monster.hp -= dmg;
    if (options.events) {
      options.events.push({
        type: 'damage',
        targetId: monster.id,
        amount: dmg,
        crit: !!options.crit,
        splash: !!options.splash,
        thorns: !!options.thorns,
        pos: { x: monster.pos.x, y: monster.pos.y }
      });
    }
    if (monster.hp <= 0) {
      killMonster(state, monster, options.events);
    }
    return dmg;
  }

  function playerAttack(state, monster, events) {
    const stats = state.player.stats;
    const crit = state.rng.chance(stats.crit);
    const base = Math.round(stats.atk * (crit ? CONFIG.combat.critMultiplier : 1));
    const ranged = stats.range > 1;
    events.push({
      type: 'attack',
      source: 'player',
      targetId: monster.id,
      kind: ranged ? 'ranged' : 'melee'
    });

    let total = damageMonster(state, monster, base, { events: events, crit: crit });

    if (stats.splash > 0 && total > 0) {
      const origin = { x: monster.pos.x, y: monster.pos.y };
      state.monsters.slice().forEach(function (other) {
        if (other === monster || other.dead) return;
        if (manhattan(other.pos, origin) > 1) return;
        const splashDamage = Math.max(1, Math.round(base * stats.splash));
        total += damageMonster(state, other, splashDamage, {
          events: events,
          crit: crit,
          splash: true
        });
      });
    }

    if (stats.lifesteal > 0 && total > 0) {
      healPlayer(state, total * stats.lifesteal, events);
    }

    return { damage: base, crit: crit, total: total };
  }

  function damageMonstersInRadius(state, anchor, radius, amount, events, opts) {
    const options = opts || {};
    let total = 0;
    state.monsters.slice().forEach(function (monster) {
      if (monster.dead) return;
      if (manhattan(monster.pos, anchor) > radius) return;
      total += damageMonster(state, monster, amount, {
        events: events,
        crit: false,
        splash: !!options.splash
      });
    });
    return total;
  }

  function attackPlayer(state, monster, mul, events) {
    const player = state.player;
    const stats = player.stats;
    const raw = Math.max(1, Math.round(monster.atk * (mul || 1)));
    const dmg = Math.max(1, Math.round(raw * (1 - stats.damageReduction)));

    events.push({
      type: 'attack',
      source: monster.id,
      targetId: 'player',
      kind: monster.range > 1 ? 'ranged' : 'melee'
    });

    player.hp = Math.max(0, player.hp - dmg);
    events.push({
      type: 'damage',
      targetId: 'player',
      amount: dmg,
      crit: false,
      pos: { x: player.pos.x, y: player.pos.y }
    });

    if (stats.thorns > 0 && !monster.dead) {
      const reflect = Math.max(1, Math.round(raw * stats.thorns));
      damageMonster(state, monster, reflect, { events: events, thorns: true });
    }

    if (player.hp <= 0) {
      handleLethal(state, events);
    }
    return dmg;
  }

  function handleLethal(state, events) {
    const player = state.player;
    const stats = player.stats;
    if (stats.revivePct > 0 && !player.reviveUsed) {
      player.reviveUsed = true;
      player.hp = Math.max(1, Math.round(stats.maxHp * stats.revivePct));
      events.push({
        type: 'revive',
        targetId: 'player',
        amount: player.hp,
        pos: { x: player.pos.x, y: player.pos.y }
      });
      return false;
    }
    player.hp = 0;
    player.dead = true;
    events.push({ type: 'player-dead', pos: { x: player.pos.x, y: player.pos.y } });
    return true;
  }

  return {
    healPlayer: healPlayer,
    healPlayerPct: healPlayerPct,
    killMonster: killMonster,
    damageMonster: damageMonster,
    damageMonstersInRadius: damageMonstersInRadius,
    playerAttack: playerAttack,
    attackPlayer: attackPlayer,
    handleLethal: handleLethal
  };
});
