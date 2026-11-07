'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_helpers.js');
const Monsters = require('../js/core/monsters.js');
const Grid = H.Grid;

test('monster stats scale with the current stage', function () {
  const state = H.makeRun();
  state.stage = 20;
  const monster = Monsters.createMonster(state, 'promptBubble', { x: 0, y: 1 });
  assert.equal(monster.maxHp, Math.round(18 * (1 + H.CONFIG.scaling.hpPerStage * 19)));
  assert.equal(monster.atk, Math.round(5 * (1 + H.CONFIG.scaling.atkPerStage * 19)));
  assert.ok(monster.tokenValue >= 3);
});

test('a normal round spawns a small unique wave near the portals', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  assert.equal(state.monsters.length, H.CONFIG.spawn.base);
  state.monsters.forEach(function (monster) {
    assert.equal(Grid.isBlocked(state.board, monster.pos.x, monster.pos.y), false);
    const nearPortal = state.board.portals.some(function (portal) {
      return Grid.manhattan(portal, monster.pos) <= 1;
    });
    assert.equal(nearPortal, true);
  });
  const keys = new Set(state.monsters.map(function (m) { return Grid.key(m.pos); }));
  assert.equal(keys.size, state.monsters.length);
});

test('boss stages spawn the boss with its adds and an intro event', function () {
  const state = H.makeRun();
  const events = [];
  state.stage = 9;
  H.P.startRound(state, events, true);
  assert.equal(state.stage, 10);
  const boss = H.findBoss(state);
  assert.ok(boss);
  assert.equal(boss.bossDef.id, 'overfit');
  assert.equal(state.monsters.filter(function (m) { return !m.isBoss; }).length, 1);
  assert.ok(events.some(function (ev) { return ev.type === 'boss-intro'; }));
});

test('the living monster cap prevents further spawns', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  H.clearMonsters(state);
  for (let i = 0; i < H.CONFIG.combat.monsterCap; i += 1) {
    H.addMonster(state, 'promptBubble', { x: 0, y: 0 }, { hp: 10, maxHp: 10 });
  }
  const before = state.monsters.length;
  Monsters.spawnWave(state, []);
  assert.equal(state.monsters.length, before);
});

test('monsters chase along the shortest path when the player acts', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  H.buff(state);
  H.clearMonsters(state);
  const free = Grid.freeTiles(state.board, new Set([Grid.key(state.player.pos)]));
  const spot = free.find(function (tile) {
    return Grid.manhattan(tile, state.player.pos) === 3;
  });
  assert.ok(spot);
  const monster = H.addMonster(state, 'overfitSkeleton', spot, { hp: 100, maxHp: 100 });
  const before = Grid.manhattan(monster.pos, state.player.pos);
  const events = [];
  Monsters.reactAll(state, events);
  assert.ok(Grid.manhattan(monster.pos, state.player.pos) < before);
  assert.ok(events.some(function (ev) { return ev.type === 'monster-move'; }));
});

test('adjacent monsters attack when the player acts', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  H.buff(state);
  state.player.stats.damageReduction = 0;
  H.clearMonsters(state);
  const monster = H.addMonster(state, 'overfitSkeleton', H.freeNeighbor(state, state.player.pos), { atk: 7 });
  const before = state.player.hp;
  const events = [];
  Monsters.reactAll(state, events);
  assert.equal(state.player.hp, before - 7);
  assert.ok(events.some(function (ev) { return ev.type === 'attack' && ev.targetId === 'player'; }));
  assert.ok(monster);
});

test('frozen monsters skip one reaction and thaw', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  H.buff(state);
  H.clearMonsters(state);
  const monster = H.addMonster(state, 'overfitSkeleton', H.freeNeighbor(state, state.player.pos), { frozen: 1 });
  const pos = { x: monster.pos.x, y: monster.pos.y };
  const events = [];
  Monsters.reactAll(state, events);
  assert.equal(monster.frozen, 0);
  assert.deepEqual(monster.pos, pos);
  assert.ok(events.some(function (ev) { return ev.type === 'freeze-skip'; }));
});

test('boss specials are telegraphed one action early and can be dodged', function () {
  const state = H.makeRun();
  H.buff(state);
  H.begin(state, 10);
  const boss = H.findBoss(state);
  assert.ok(boss);
  state.player.pos = { x: 4, y: 4 };
  const interval = Monsters.bossInterval(boss);
  boss.charge = interval - 2;
  Monsters.reactAll(state, []);
  assert.ok(state.telegraph);
  assert.ok(state.telegraph.tiles.length > 0);
  const tile = state.telegraph.tiles[0];
  state.player.pos = { x: tile.x, y: tile.y };
  boss.charge = interval - 1;
  const events = [];
  Monsters.reactAll(state, events);
  assert.ok(events.some(function (ev) { return ev.type === 'boss-special'; }));
  assert.ok(state.player.hp < state.player.stats.maxHp);
});

test('the final boss enters new phases and speeds up its specials', function () {
  const state = H.makeRun();
  H.buff(state);
  H.begin(state, 40);
  const boss = H.findBoss(state);
  assert.ok(boss);
  assert.equal(boss.bossDef.id, 'ricecooker');
  boss.hp = Math.floor(boss.maxHp * 0.45);
  const events = [];
  Monsters.refreshBosses(state, events);
  assert.equal(boss.phaseIdx, 1);
  assert.equal(Monsters.bossInterval(boss), 3);
  assert.ok(events.some(function (ev) { return ev.type === 'boss-phase' && ev.label === '高压模式'; }));
  boss.hp = Math.floor(boss.maxHp * 0.1);
  Monsters.refreshBosses(state, events);
  assert.equal(boss.phaseIdx, 2);
  assert.equal(Monsters.bossInterval(boss), 2);
});

test('monster types are AI-themed and unlock progressively', function () {
  const names = Object.keys(H.CONFIG.monsters).map(function (key) {
    return H.CONFIG.monsters[key].name;
  });
  assert.ok(names.indexOf('提示词泡泡') >= 0);
  assert.ok(names.indexOf('幻觉弓手') >= 0);
  assert.ok(names.indexOf('隐私幽灵') >= 0);
  assert.ok(H.CONFIG.monsters.hallucinationArcher.unlock > H.CONFIG.monsters.promptBubble.unlock);
});
