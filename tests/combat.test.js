'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_helpers.js');
const Grid = H.Grid;
const Combat = H.Combat;

function setup(opts) {
  const state = H.makeRun(opts);
  H.begin(state, 1);
  H.buff(state);
  H.clearMonsters(state);
  return state;
}

test('player attack deals base damage and emits events', function () {
  const state = setup();
  state.player.stats.atk = 10;
  state.player.stats.crit = 0;
  state.player.stats.splash = 0;
  const pos = H.freeNeighbor(state, state.player.pos);
  const monster = H.addMonster(state, 'promptBubble', pos, { maxHp: 100, hp: 100 });
  const events = [];
  const result = Combat.playerAttack(state, monster, events);
  assert.equal(result.damage, 10);
  assert.equal(monster.hp, 90);
  assert.ok(events.some(function (ev) { return ev.type === 'attack'; }));
  assert.ok(events.some(function (ev) { return ev.type === 'damage' && ev.amount === 10; }));
});

test('critical hits multiply damage and are marked', function () {
  const state = setup();
  state.player.stats.atk = 10;
  state.player.stats.crit = 1;
  state.rng.chance = function () { return true; };
  const pos = H.freeNeighbor(state, state.player.pos);
  const monster = H.addMonster(state, 'promptBubble', pos, { maxHp: 100, hp: 100 });
  const events = [];
  const result = Combat.playerAttack(state, monster, events);
  assert.equal(result.crit, true);
  assert.equal(result.damage, 16);
  assert.equal(monster.hp, 84);
});

test('killing a monster grants scaled Tokens and kills stat', function () {
  const state = setup();
  state.player.tokens = 0;
  state.player.stats.tokenMult = 1.5;
  const pos = H.freeNeighbor(state, state.player.pos);
  const monster = H.addMonster(state, 'promptBubble', pos, { maxHp: 10, hp: 1, tokenValue: 10 });
  const events = [];
  Combat.damageMonster(state, monster, 50, { events: events });
  assert.equal(state.monsters.length, 0);
  assert.equal(state.player.tokens, 15);
  assert.equal(state.stats.kills, 1);
  assert.ok(events.some(function (ev) { return ev.type === 'kill' && ev.tokens === 15; }));
});

test('mage splash damages monsters adjacent to the target', function () {
  const state = setup({ classId: 'mage' });
  state.player.stats.atk = 10;
  state.player.stats.crit = 0;
  state.player.stats.splash = 0.5;
  state.player.stats.range = 2;
  const free = Grid.freeTiles(state.board, new Set([Grid.key(state.player.pos)]));
  const targetPos = free.find(function (tile) {
    return Grid.manhattan(tile, state.player.pos) === 2
      && Grid.neighbors(state.board, tile).some(function (nb) {
        return Grid.manhattan(nb, state.player.pos) <= 2;
      });
  });
  assert.ok(targetPos);
  const neighborPos = Grid.neighbors(state.board, targetPos).find(function (nb) {
    return !Grid.isBlocked(state.board, nb.x, nb.y)
      && Grid.neighbors(state.board, nb).length > 0;
  });
  const target = H.addMonster(state, 'promptBubble', targetPos, { maxHp: 100, hp: 100 });
  const bystander = H.addMonster(state, 'promptBubble', neighborPos, { maxHp: 100, hp: 100 });
  const events = [];
  Combat.playerAttack(state, target, events);
  assert.equal(target.hp, 90);
  assert.equal(bystander.hp, 95);
});

test('monster attacks respect damage reduction and reflect thorns', function () {
  const state = setup();
  state.player.stats.damageReduction = 0.5;
  state.player.stats.thorns = 0.5;
  state.player.stats.maxHp = 100;
  state.player.hp = 100;
  state.player.stats.revivePct = 0;
  const monster = H.addMonster(state, 'promptBubble', H.freeNeighbor(state, state.player.pos), {
    atk: 20,
    hp: 100,
    maxHp: 100
  });
  const events = [];
  Combat.attackPlayer(state, monster, 1, events);
  assert.equal(state.player.hp, 90);
  assert.equal(monster.hp, 90);
  assert.ok(events.some(function (ev) { return ev.type === 'damage' && ev.targetId === 'player' && ev.amount === 10; }));
});

test('revive triggers once and prevents death', function () {
  const state = setup();
  state.player.stats.maxHp = 100;
  state.player.hp = 1;
  state.player.stats.damageReduction = 0;
  state.player.stats.thorns = 0;
  state.player.stats.revivePct = 0.5;
  state.player.reviveUsed = false;
  const monster = H.addMonster(state, 'promptBubble', H.freeNeighbor(state, state.player.pos), { atk: 100 });
  const events = [];
  Combat.attackPlayer(state, monster, 1, events);
  assert.equal(state.player.dead, false);
  assert.equal(state.player.hp, 50);
  assert.equal(state.player.reviveUsed, true);
  assert.ok(events.some(function (ev) { return ev.type === 'revive'; }));
});

test('lethal damage without revive marks the player dead', function () {
  const state = setup();
  state.player.stats.maxHp = 100;
  state.player.hp = 5;
  state.player.stats.damageReduction = 0;
  state.player.stats.thorns = 0;
  state.player.stats.revivePct = 0;
  const monster = H.addMonster(state, 'promptBubble', H.freeNeighbor(state, state.player.pos), { atk: 100 });
  const events = [];
  Combat.attackPlayer(state, monster, 1, events);
  assert.equal(state.player.hp, 0);
  assert.equal(state.player.dead, true);
  assert.ok(events.some(function (ev) { return ev.type === 'player-dead'; }));
});

test('healing never exceeds max hp', function () {
  const state = setup();
  state.player.stats.maxHp = 100;
  state.player.hp = 90;
  const events = [];
  const healed = Combat.healPlayer(state, 50, events);
  assert.equal(healed, 10);
  assert.equal(state.player.hp, 100);
  assert.equal(Combat.healPlayer(state, 10, events), 0);
});

