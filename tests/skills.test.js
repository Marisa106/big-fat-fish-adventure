'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_helpers.js');
const Skills = require('../js/core/skills.js');
const Monsters = require('../js/core/monsters.js');
const CONFIG = H.CONFIG;

function setup(opts) {
  const state = H.makeRun(opts);
  H.begin(state, 1);
  H.buff(state);
  H.clearMonsters(state);
  return state;
}

test('learning passives immediately updates derived stats', function () {
  const state = setup();
  const baseStamina = state.player.stats.stamina;
  assert.equal(Skills.learn(state, 'power', []), true);
  assert.equal(Skills.learn(state, 'haste', []), true);
  assert.equal(state.player.stats.atk, H.CONFIG.classes.warrior.atk + 2);
  assert.equal(state.player.stats.stamina, baseStamina + 1);
  assert.equal(Skills.learn(state, 'power', []), false);
});

test('active skills can only be upgraded up to maxLevel', function () {
  const state = setup();
  Skills.learn(state, 'fireball', []);
  assert.equal(Skills.upgrade(state, 'fireball', []), true);
  assert.equal(Skills.upgrade(state, 'fireball', []), true);
  assert.equal(Skills.upgrade(state, 'fireball', []), false);
  assert.equal(Skills.findSkill(state, 'fireball').level, 3);
});

test('full skill bar requires a swap before learning a new skill', function () {
  const state = setup();
  state.player.slots = 4;
  ['power', 'haste', 'regen', 'ironwall'].forEach(function (id) {
    Skills.learn(state, id, []);
  });
  const choice = { type: 'skill', skillId: 'crit', kind: 'new' };
  const applied = Skills.applyChoice(state, choice, []);
  assert.equal(applied.type, 'needsSwap');
  assert.equal(Skills.findSkill(state, 'crit'), null);
  Skills.finishSwap(state, 'crit', 'ironwall', []);
  assert.ok(Skills.findSkill(state, 'crit'));
  assert.equal(Skills.findSkill(state, 'ironwall'), null);
});

test('normal skill offers exclude boss skills and other class exclusives', function () {
  const warrior = setup();
  const choices = Skills.generateChoices(warrior, { count: 6 });
  assert.equal(choices.length, 6);
  const ids = choices.map(function (c) { return c.skillId; }).filter(Boolean);
  assert.equal(new Set(ids).size, ids.length);
  ids.forEach(function (id) {
    const def = CONFIG.skillMap[id];
    assert.notEqual(def.rarity, 'boss');
    if (def.classOnly) assert.equal(def.classOnly, 'warrior');
  });
});

test('boss offers only contain boss rarity skills', function () {
  const state = setup();
  const choices = Skills.generateChoices(state, { count: 2, pool: 'boss' });
  assert.equal(choices.length, 2);
  choices.forEach(function (choice) {
    if (choice.type !== 'skill') return;
    assert.equal(CONFIG.skillMap[choice.skillId].rarity, 'boss');
  });
});

test('fireball hits every enemy around the target tile and starts cooldown', function () {
  const state = setup();
  Skills.learn(state, 'fireball', []);
  state.player.stats.atk = 10;
  state.player.stats.skillPower = 0;
  state.player.pos = { x: 4, y: 4 };
  const first = H.addMonster(state, 'promptBubble', { x: 5, y: 4 }, { hp: 100, maxHp: 100 });
  const second = H.addMonster(state, 'promptBubble', { x: 6, y: 4 }, { hp: 100, maxHp: 100 });
  const events = [];
  const result = Skills.use(state, 'fireball', { x: 5, y: 4 }, events);
  assert.equal(result.ok, true);
  assert.equal(first.hp, 88);
  assert.equal(second.hp, 88);
  assert.equal(Skills.findSkill(state, 'fireball').cd, 4);
  const again = Skills.use(state, 'fireball', { x: 5, y: 4 }, []);
  assert.equal(again.ok, false);
  assert.match(again.reason, /冷却/);
});

test('targeted skills are blocked by walls without line of sight', function () {
  const state = setup();
  Skills.learn(state, 'fireball', []);
  state.player.pos = { x: 4, y: 4 };
  state.board.blocked.add('4,3');
  const check = Skills.canUse(state, 'fireball', { x: 4, y: 2 });
  assert.equal(check.ok, false);
  assert.match(check.reason, /视线/);
  assert.equal(Skills.use(state, 'fireball', { x: 4, y: 2 }, []).ok, false);
});

test('frost nova freezes normal monsters but not bosses', function () {
  const state = setup();
  Skills.learn(state, 'frostnova', []);
  state.player.pos = { x: 4, y: 4 };
  state.player.stats.atk = 10;
  const slime = H.addMonster(state, 'promptBubble', { x: 5, y: 4 }, { hp: 100, maxHp: 100 });
  const bossDef = CONFIG.bosses[0];
  const boss = Monsters.createBoss(state, bossDef, { x: 4, y: 5 });
  boss.hp = 9999;
  boss.maxHp = 9999;
  state.monsters.push(boss);
  const events = [];
  const result = Skills.use(state, 'frostnova', {}, events);
  assert.equal(result.ok, true);
  assert.equal(slime.frozen, 1);
  assert.equal(boss.frozen, 0);
  assert.ok(events.some(function (ev) { return ev.type === 'freeze' && ev.id === slime.id; }));
});

test('healing skill restores a percentage of max health', function () {
  const state = setup();
  Skills.learn(state, 'heal', []);
  state.player.stats.maxHp = 100;
  state.player.hp = 20;
  const result = Skills.use(state, 'heal', {}, []);
  assert.equal(result.ok, true);
  assert.equal(state.player.hp, 45);
});

test('active skills must exist and be off cooldown', function () {
  const state = setup();
  assert.equal(Skills.use(state, 'fireball', { x: 5, y: 4 }, []).ok, false);
  Skills.learn(state, 'power', []);
  assert.equal(Skills.use(state, 'power', {}, []).ok, false);
});

