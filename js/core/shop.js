/* 商店：技能、米饭、技能栏扩充的随机刷新与购买 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory({
      Config: require('./config.js'),
      Skills: require('./skills.js'),
      Stats: require('./stats.js')
    });
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Shop = factory(root.BQ);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (BQ) {
  'use strict';

  const CONFIG = BQ.Config.CONFIG;
  const Skills = BQ.Skills;
  const Stats = BQ.Stats;

  function skillCandidates(state, usedIds) {
    const list = [];
    CONFIG.skills.forEach(function (def) {
      if (def.rarity === 'boss') return;
      if (def.classOnly && def.classOnly !== state.classId) return;
      if (usedIds.has(def.id)) return;
      const owned = Skills.findSkill(state, def.id);
      if (owned) {
        if (owned.level >= def.maxLevel) return;
        list.push({ def: def, kind: 'upgrade', weight: 1.5 });
      } else {
        list.push({ def: def, kind: 'new', weight: def.rarity === 'rare' ? 1.1 : 1.8 });
      }
    });
    return list;
  }

  function priceFor(def, kind) {
    const prices = CONFIG.shop.prices;
    if (kind === 'upgrade') {
      return def.rarity === 'rare' ? prices.rareUpgrade : prices.commonUpgrade;
    }
    return def.rarity === 'rare' ? prices.rareNew : prices.commonNew;
  }

  function makeSkillItem(state, usedIds) {
    const candidates = skillCandidates(state, usedIds);
    if (!candidates.length) return null;
    const entries = candidates.map(function (c) {
      return [c, c.weight];
    });
    const picked = state.rng.weighted(entries);
    usedIds.add(picked.def.id);
    return {
      type: 'skill',
      skillId: picked.def.id,
      kind: picked.kind,
      price: priceFor(picked.def, picked.kind),
      sold: false
    };
  }

  function makeRiceItem() {
    return {
      type: 'rice',
      price: CONFIG.shop.ricePrice,
      sold: false
    };
  }

  function makeSlotItem(state) {
    if (state.player.slots >= CONFIG.shop.maxSlots) return null;
    const idx = Math.max(0, state.player.slots - 4);
    const price = CONFIG.shop.slotPrices[Math.min(idx, CONFIG.shop.slotPrices.length - 1)];
    return {
      type: 'slot',
      price: price,
      sold: false
    };
  }

  function generateItems(state) {
    const items = [];
    const usedIds = new Set();
    let riceUsed = false;
    let slotUsed = false;

    const first = makeSkillItem(state, usedIds) || makeRiceItem();
    items.push(first);
    if (first.type === 'rice') riceUsed = true;

    while (items.length < CONFIG.shop.itemCount) {
      const options = [];
      if (skillCandidates(state, usedIds).length) options.push(['skill', CONFIG.shop.weights.skill]);
      if (!riceUsed) options.push(['rice', CONFIG.shop.weights.rice]);
      if (!slotUsed && state.player.slots < CONFIG.shop.maxSlots) {
        options.push(['slot', CONFIG.shop.weights.slot]);
      }
      if (!options.length) {
        options.push(['rice', 1]);
      }
      const type = state.rng.weighted(options);
      if (type === 'skill') {
        const item = makeSkillItem(state, usedIds);
        if (item) {
          items.push(item);
        } else {
          items.push(makeRiceItem());
          riceUsed = true;
        }
      } else if (type === 'rice') {
        items.push(makeRiceItem());
        riceUsed = true;
      } else {
        const item = makeSlotItem(state);
        if (item) {
          items.push(item);
          slotUsed = true;
        } else {
          const fallback = makeRiceItem();
          items.push(fallback);
          riceUsed = true;
        }
      }
    }
    return items;
  }

  function createShop(state) {
    return {
      items: generateItems(state),
      rerolls: 0
    };
  }

  function rerollCost(state) {
    const rerolls = state.shop ? state.shop.rerolls : 0;
    return CONFIG.shop.rerollBase + CONFIG.shop.rerollStep * rerolls;
  }

  function reroll(state) {
    if (!state.shop) return { ok: false, reason: '商店还没有营业' };
    const cost = rerollCost(state);
    if (state.player.tokens < cost) {
      return { ok: false, reason: 'Token 不足，刷新需要 ' + cost };
    }
    state.player.tokens -= cost;
    state.shop.rerolls += 1;
    state.shop.items = generateItems(state);
    Stats.recompute(state);
    return { ok: true, cost: cost };
  }

  function itemBlockReason(state, index) {
    const item = state.shop.items[index];
    if (!item) return '商品不存在';
    if (item.sold) return '已经售罄';
    if (state.player.tokens < item.price) return 'Token 不足（还差 ' + (item.price - state.player.tokens) + '）';
    if (item.type === 'rice' && state.player.rice >= CONFIG.shop.maxRice) return '米饭已带满（上限 ' + CONFIG.shop.maxRice + '）';
    if (item.type === 'slot' && state.player.slots >= CONFIG.shop.maxSlots) return '技能栏已满';
    return null;
  }

  function buy(state, index) {
    const item = state.shop.items[index];
    const blocked = itemBlockReason(state, index);
    if (blocked) return { ok: false, reason: blocked };

    if (item.type === 'skill' && item.kind === 'new') {
      if (state.player.skills.length >= state.player.slots) {
        return {
          ok: false,
          needsSwap: true,
          skillId: item.skillId,
          price: item.price,
          index: index
        };
      }
    }

    state.player.tokens -= item.price;
    item.sold = true;

    if (item.type === 'rice') {
      state.player.rice += 1;
    } else if (item.type === 'slot') {
      state.player.slots = Math.min(CONFIG.shop.maxSlots, state.player.slots + 1);
    } else if (item.kind === 'upgrade') {
      Skills.upgrade(state, item.skillId, null);
    } else {
      Skills.learn(state, item.skillId, null);
    }
    Stats.recompute(state);
    return { ok: true, item: item };
  }

  function completeBuyWithSwap(state, index, replaceId) {
    const item = state.shop.items[index];
    if (!item) return { ok: false, reason: '商品不存在' };
    if (item.sold) return { ok: false, reason: '已经售罄' };
    if (state.player.tokens < item.price) return { ok: false, reason: 'Token 不足' };
    if (!replaceId) return { ok: false, reason: '请选择要替换的技能' };
    if (!Skills.findSkill(state, replaceId)) return { ok: false, reason: '要替换的技能不存在' };

    state.player.tokens -= item.price;
    item.sold = true;
    Skills.forget(state, replaceId);
    Skills.learn(state, item.skillId, null);
    Stats.recompute(state);
    return { ok: true, item: item, replaced: replaceId };
  }

  return {
    createShop: createShop,
    generateItems: generateItems,
    reroll: reroll,
    rerollCost: rerollCost,
    buy: buy,
    itemBlockReason: itemBlockReason,
    completeBuyWithSwap: completeBuyWithSwap,
    priceFor: priceFor
  };
});
