'use strict';

/* 本次平衡调整：怪物数量/成长、20 级武器、知识储备、Boss 控制 */
const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_helpers.js');
const Skills = require('../js/core/skills.js');

test('later stages spawn more monsters, capped at six', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  assert.equal(state.monsters.length, 2);

  state.monsters = [];
  state.stage = 24;
  H.P.startRound(state, [], true);
  assert.equal(state.stage, 25);
  assert.equal(state.monsters.length, 5);

  state.monsters = [];
  state.stage = 32;
  H.P.startRound(state, [], true);
  assert.equal(state.stage, 33);
  assert.equal(state.monsters.length, H.CONFIG.spawn.max);
  assert.equal(state.monsters.length, 6);
});

test('both weapons can be upgraded to level 20 with a gentler cost curve', function () {
  assert.equal(H.CONFIG.weapons.axe.maxLevel, 20);
  assert.equal(H.CONFIG.weapons.staff.maxLevel, 20);
  assert.ok(H.CONFIG.combat.weaponCostBase < 6, 'early weapon upgrades should be cheaper');

  const state = H.makeRun();
  H.begin(state, 1);
  state.phase = 'reward';
  state.player.tokens = 10000;
  for (let i = 0; i < 19; i += 1) {
    assert.equal(H.P.upgradeWeapon(state).ok, true);
  }
  assert.equal(state.player.weapon.level, 20);
  assert.equal(H.P.upgradeWeapon(state).ok, false);
});

test('knowledge reserve grants +10 attack per 50 Tokens and reacts to spending', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  assert.equal(Skills.learn(state, 'knowledgeReserve', []), true);

  state.player.tokens = 0;
  H.Stats.recompute(state);
  const base = state.player.stats.atk;

  state.player.tokens = 49;
  H.Stats.recompute(state);
  assert.equal(state.player.stats.tokenAtkBonus, 0);

  state.player.tokens = 120;
  H.Stats.recompute(state);
  assert.equal(state.player.stats.tokenAtkBonus, 20);
  assert.equal(state.player.stats.atk, base + 20);

  state.player.tokens = 50;
  H.Stats.recompute(state);
  assert.equal(state.player.stats.tokenAtkBonus, 10);
  assert.equal(state.player.stats.atk, base + 10);
});

test('a boss control skill stuns for one action, and struggle consumes that action', function () {
  const state = H.makeRun();
  H.begin(state, 10);
  const boss = H.findBoss(state);
  assert.ok(boss);
  state.player.hp = 9999;
  state.player.stats.maxHp = 9999;
  state.player.stamina = 8;

  boss.charge = 3;
  boss.specialIndex = 0;
  const events = [];
  H.Monsters.reactAll(state, events);
  assert.equal(state.player.stun, 1);
  assert.ok(events.some(function (ev) { return ev.type === 'player-stun'; }));

  const blocked = H.P.rest(state);
  assert.equal(blocked.ok, false);
  assert.match(blocked.reason, /控制/);

  const res = H.P.struggle(state);
  assert.equal(res.ok, true);
  assert.equal(state.player.stun, 0);
  assert.ok(res.events.some(function (ev) { return ev.type === 'stun-skip'; }));
});
