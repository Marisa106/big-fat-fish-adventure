/* 种子随机数：mulberry32 + 常用抽样工具 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.BQ = root.BQ || {};
    root.BQ.Rng = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function hashSeed(input) {
    if (typeof input === 'number' && isFinite(input)) {
      return (input >>> 0) || 1;
    }
    const text = String(input == null ? '' : input);
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0) || 1;
  }

  function create(seedInput) {
    let a = hashSeed(seedInput);
    const rng = {
      seed: a,
      get state() {
        return a >>> 0;
      },
      next: function () {
        a |= 0;
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      },
      int: function (min, max) {
        const lo = Math.ceil(min);
        const hi = Math.floor(max);
        return lo + Math.floor(rng.next() * (hi - lo + 1));
      },
      chance: function (p) {
        return rng.next() < p;
      },
      pick: function (list) {
        if (!list || !list.length) return undefined;
        return list[Math.floor(rng.next() * list.length)];
      },
      shuffle: function (list) {
        const out = list.slice();
        for (let i = out.length - 1; i > 0; i -= 1) {
          const j = Math.floor(rng.next() * (i + 1));
          const tmp = out[i];
          out[i] = out[j];
          out[j] = tmp;
        }
        return out;
      },
      weighted: function (entries) {
        if (!entries || !entries.length) return undefined;
        let total = 0;
        entries.forEach(function (entry) {
          total += Math.max(0, entry[1]);
        });
        if (total <= 0) {
          return entries[0][0];
        }
        let roll = rng.next() * total;
        for (let i = 0; i < entries.length; i += 1) {
          roll -= Math.max(0, entries[i][1]);
          if (roll <= 0) return entries[i][0];
        }
        return entries[entries.length - 1][0];
      }
    };
    return rng;
  }

  return {
    create: create,
    hashSeed: hashSeed
  };
});
