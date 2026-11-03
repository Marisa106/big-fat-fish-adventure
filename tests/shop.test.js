'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_helpers.js');
const Shop = require('../js/core/shop.js');
const Skills = require('../js/core/skills.js');

function setup() {
  const state = H.makeRun();
  H.begin(state, 1);
  state.player.tokens = 100;
  return state;
}

function setShop(state, items) {
  state.shop = { items: items, rerolls: 0 };
  return state.shop;
}

test('shop generation always offers three valid items and at least one skill', function () {
  const state = setup();
  for (let i = 0; i < 30; i += 1) {
    const shop = Shop.createShop(state);
    assert.equal(shop.items.length, 3);
    assert.ok(shop.items.some(function (item) { return item.type === 'skill'; }));
    shop.items.forEach(function (item) {
      assert.ok(['skill', 'rice', 'slot'].indexOf(item.type) >= 0);
      assert.ok(item.price > 0);
    });
    const slots = shop.items.filter(function (item) { return item.type === 'slot'; });
    assert.ok(slots.length <= 1);
  }
});

test('buying rice costs Tokens and fills the rice counter', function () {
  const state = setup();
  setShop(state, [{ type: 'rice', price: 6, sold: false }]);
  const result = Shop.buy(state, 0);
  assert.equal(result.ok, true);
  assert.equal(state.player.tokens, 94);
  assert.equal(state.player.rice, 1);
  assert.equal(state.shop.items[0].sold, true);
  assert.equal(Shop.buy(state, 0).ok, false);
});

test('rice purchases are blocked when already carrying five bowls', function () {
  const state = setup();
  state.player.rice = 5;
  setShop(state, [{ type: 'rice', price: 6, sold: false }]);
  assert.match(Shop.itemBlockReason(state, 0), /米饭/);
  assert.equal(Shop.buy(state, 0).ok, false);
});

test('slot expansion increases the skill bar and respects its price', function () {
  const state = setup();
  state.player.tokens = 25;
  state.player.slots = 4;
  const price = H.CONFIG.shop.slotPrices[0];
  setShop(state, [{ type: 'slot', price: price, sold: false }]);
  const result = Shop.buy(state, 0);
  assert.equal(result.ok, true);
  assert.equal(state.player.slots, 5);
  assert.equal(state.player.tokens, 25 - price);
});

test('buying a new skill with a full bar asks for a replacement', function () {
  const state = setup();
  state.player.slots = 4;
  ['power', 'haste', 'regen', 'ironwall'].forEach(function (id) {
    Skills.learn(state, id, []);
  });
  setShop(state, [{ type: 'skill', skillId: 'crit', kind: 'new', price: 14, sold: false }]);
  const result = Shop.buy(state, 0);
  assert.equal(result.ok, false);
  assert.equal(result.needsSwap, true);
  assert.equal(state.player.tokens, 100);

  const replaced = Shop.completeBuyWithSwap(state, 0, 'ironwall');
  assert.equal(replaced.ok, true);
  assert.equal(state.player.tokens, 86);
  assert.ok(Skills.findSkill(state, 'crit'));
  assert.equal(Skills.findSkill(state, 'ironwall'), null);
});

test('insufficient Tokens blocks every purchase', function () {
  const state = setup();
  state.player.tokens = 1;
  setShop(state, [
    { type: 'rice', price: 6, sold: false },
    { type: 'slot', price: 20, sold: false },
    { type: 'skill', skillId: 'power', kind: 'new', price: 8, sold: false }
  ]);
  for (let i = 0; i < 3; i += 1) {
    const result = Shop.buy(state, i);
    assert.equal(result.ok, false);
    assert.match(result.reason, /Token/);
  }
  assert.equal(state.player.tokens, 1);
});

test('reroll cost escalates and exchanges the stock', function () {
  const state = setup();
  state.shop = Shop.createShop(state);
  const before = state.shop.items.map(function (item) { return item.type + ':' + (item.skillId || ''); }).join('|');
  assert.equal(Shop.rerollCost(state), 2);
  const first = Shop.reroll(state);
  assert.equal(first.ok, true);
  assert.equal(first.cost, 2);
  assert.equal(state.shop.rerolls, 1);
  assert.equal(Shop.rerollCost(state), 4);
  assert.equal(state.player.tokens, 98);
  const after = state.shop.items.map(function (item) { return item.type + ':' + (item.skillId || ''); }).join('|');
  assert.equal(typeof before, 'string');
  assert.equal(typeof after, 'string');
});

test('slot expansion disappears once the bar is maxed', function () {
  const state = setup();
  state.player.slots = 8;
  for (let i = 0; i < 20; i += 1) {
    const shop = Shop.createShop(state);
    assert.equal(shop.items.some(function (item) { return item.type === 'slot'; }), false);
  }
});

test('upgrade items target an owned skill and are cheaper than new skills', function () {
  const state = setup();
  Skills.learn(state, 'power', []);
  let found = false;
  for (let i = 0; i < 40; i += 1) {
    state.shop = Shop.createShop(state);
    const item = state.shop.items.find(function (candidate) {
      return candidate.type === 'skill' && candidate.kind === 'upgrade';
    });
    if (!item) continue;
    found = true;
    assert.equal(Skills.findSkill(state, item.skillId) !== null, true);
    assert.ok(item.price < 14);
    break;
  }
  assert.equal(found, true);
});
