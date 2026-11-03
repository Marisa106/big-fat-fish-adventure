/* 派生属性：职业基础 + 武器等级 + 被动技能 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({ Config: require('./config.js') });
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Stats = factory(root.BQ);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BQ) {
  'use strict';

  const CONFIG = BQ.Config.CONFIG;

  function compute(state) {
    const cls = CONFIG.classes[state.classId];
    const weapon = state.player.weapon;
    const wdef = CONFIG.weapons[weapon.id];

    let maxHp = cls.hp;
    let atk = cls.atk + (weapon.level - 1) * wdef.atkPerLevel;
    let range = cls.range;
    let stamina = cls.stamina;
    let tokenMult = 1;
    let lifesteal = 0;
    let thorns = 0;
    let regen = 0;
    let crit = 0;
    let damageReduction = 0;
    let skillPower = 0;
    let revivePct = 0;
    let splash = 0;
    let tokenAtkPer50 = 0;

    if (wdef.hpBonusEvery) {
      maxHp += Math.floor(weapon.level / wdef.hpBonusEvery) * wdef.hpBonus;
    }
    if (wdef.rangeAt) {
      Object.keys(wdef.rangeAt).forEach(function (lv) {
        if (weapon.level >= Number(lv)) range += wdef.rangeAt[lv];
      });
    }
    if (wdef.splashAt) {
      Object.keys(wdef.splashAt).forEach(function (lv) {
        if (weapon.level >= Number(lv)) {
          splash = Math.max(splash, wdef.splashAt[lv]);
        }
      });
    }

    state.player.skills.forEach(function (owned) {
      const def = CONFIG.skillMap[owned.id];
      if (!def || !def.passive) return;
      const idx = Math.min(owned.level, def.maxLevel) - 1;
      Object.keys(def.passive).forEach(function (field) {
        const values = def.passive[field];
        const value = values[idx];
        if (value == null) return;
        switch (field) {
          case 'maxHp': maxHp += value; break;
          case 'atk': atk += value; break;
          case 'range': range += value; break;
          case 'stamina': stamina += value; break;
          case 'tokenMult': tokenMult += value; break;
          case 'lifesteal': lifesteal += value; break;
          case 'thorns': thorns += value; break;
          case 'regen': regen += value; break;
          case 'crit': crit += value; break;
          case 'damageReduction': damageReduction += value; break;
          case 'skillPower': skillPower += value; break;
          case 'revivePct': revivePct = Math.max(revivePct, value); break;
          case 'tokenAtk': tokenAtkPer50 += value; break;
          default: break;
        }
      });
    });

    const tokenAtkBonus = Math.floor((state.player.tokens || 0) / 50) * tokenAtkPer50;
    atk += tokenAtkBonus;

    damageReduction = Math.min(0.8, damageReduction);
    crit = Math.min(0.9, crit);

    return {
      maxHp: Math.max(1, Math.round(maxHp)),
      atk: Math.max(1, Math.round(atk)),
      tokenAtkBonus: tokenAtkBonus,
      tokenAtkPer50: tokenAtkPer50,
      range: Math.max(1, range),
      stamina: Math.max(1, Math.round(stamina)),
      tokenMult: tokenMult,
      lifesteal: lifesteal,
      thorns: thorns,
      regen: regen,
      crit: crit,
      damageReduction: damageReduction,
      skillPower: skillPower,
      revivePct: revivePct,
      splash: splash
    };
  }

  function recompute(state) {
    const stats = compute(state);
    state.player.stats = stats;
    if (state.player.hp > stats.maxHp) state.player.hp = stats.maxHp;
    if (state.player.stamina > stats.stamina) state.player.stamina = stats.stamina;
    return stats;
  }

  return {
    compute: compute,
    recompute: recompute
  };
});
