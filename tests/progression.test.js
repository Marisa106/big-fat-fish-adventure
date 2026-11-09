'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('./_helpers.js');
const Grid = H.Grid;

function killAll(state) {
  let guard = 0;
  while (state.monsters.length && guard < 40) {
    guard += 1;
    const monster = state.monsters[0];
    H.standAdjacent(state, monster.pos);
    state.player.stats.atk = 99999;
    state.player.stats.range = 99;
    const result = H.P.playerAttack(state, monster.id);
    if (!result.ok) {
      state.player.stamina = state.player.stats.stamina;
      continue;
    }
  }
}

test('startRound spawns monsters, restores stamina and reports the stage', function () {
  const state = H.makeRun();
  const events = [];
  state.stage = 0;
  H.P.startRound(state, events, true);
  assert.equal(state.stage, 1);
  assert.equal(state.phase, 'battle');
  assert.equal(state.player.stamina, state.player.stats.stamina);
  assert.equal(state.monsters.length, H.CONFIG.spawn.base);
  assert.ok(events.some(function (ev) { return ev.type === 'stage-start'; }));
});

test('the player moves exactly one tile per action and spends stamina', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  const start = { x: state.player.pos.x, y: state.player.pos.y };
  const staminaBefore = state.player.stamina;
  const neighbor = Grid.neighbors(state.board, start).find(function (tile) {
    return !Grid.isBlocked(state.board, tile.x, tile.y)
      && !H.P.monsterAt(state, tile.x, tile.y);
  });
  assert.ok(neighbor);
  const result = H.P.movePlayer(state, neighbor.x, neighbor.y);
  assert.equal(result.ok, true);
  assert.equal(state.player.stamina, staminaBefore - H.CONFIG.campaign.moveCost);
  assert.equal(state.player.pos.x, neighbor.x);
});

test('moving two tiles away in a single action is rejected', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  state.player.stamina = state.player.stats.stamina;
  const info = H.P.playerReachable(state);
  let target = null;
  info.dist.forEach(function (dist, key) {
    if (dist === 2 && !target) target = Grid.parseKey(key);
  });
  assert.ok(target);
  const result = H.P.movePlayer(state, target.x, target.y);
  assert.equal(result.ok, false);
  assert.match(result.reason, /一格/);
});

test('attacks spend stamina, damage monsters and let the wave react', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  H.buff(state);
  H.clearMonsters(state);
  const monster = H.addMonster(state, 'promptBubble', H.freeNeighbor(state, state.player.pos), {
    hp: 100,
    maxHp: 100
  });
  const stamina = state.player.stamina;
  const result = H.P.playerAttack(state, monster.id);
  assert.equal(result.ok, true);
  assert.equal(state.player.stamina, stamina - H.CONFIG.campaign.attackCost);
  assert.ok(monster.hp < 100);
});

test('attacks are rejected when stamina is empty', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  H.buff(state);
  H.clearMonsters(state);
  const monster = H.addMonster(state, 'promptBubble', H.freeNeighbor(state, state.player.pos), {
    hp: 100,
    maxHp: 100
  });
  state.player.stamina = 0;
  const result = H.P.playerAttack(state, monster.id);
  assert.equal(result.ok, false);
  assert.match(result.reason, /体力/);
  assert.equal(monster.hp, 100);
});

test('rest restores stamina but is rejected at full stamina', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  state.player.stamina = 1;
  const result = H.P.rest(state);
  assert.equal(result.ok, true);
  assert.equal(state.player.stamina, 1 + H.CONFIG.campaign.restStamina);
  state.player.stamina = state.player.stats.stamina;
  assert.equal(H.P.rest(state).ok, false);
});

test('clearing every monster automatically opens the reward phase', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  H.buff(state);
  H.clearMonsters(state);
  const monster = H.addMonster(state, 'promptBubble', H.freeNeighbor(state, state.player.pos), {
    hp: 1,
    maxHp: 1
  });
  const result = H.P.playerAttack(state, monster.id);
  assert.equal(result.ok, true);
  assert.equal(state.phase, 'reward');
  assert.ok(state.shop && state.shop.items.length === 3);
});

test('nextRound advances the stage and respawns monsters at round start', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  state.monsters = [];
  state.phase = 'reward';
  const result = H.P.nextRound(state);
  assert.equal(result.ok, true);
  assert.equal(state.stage, 2);
  assert.equal(state.phase, 'battle');
  assert.ok(state.monsters.length > 0);
});

test('every fourth stage from 4 asks an AI case and records the diagnosis', function () {
  const state = H.makeRun();
  H.begin(state, 4, { questions: true });
  assert.equal(state.phase, 'question');
  assert.ok(state.pendingQuestion);
  assert.equal(state.pendingQuestion.caseData.id, 'c01');
  const result = H.answerCurrent(state, 1);
  assert.equal(result.ok, true);
  assert.equal(state.phase, 'battle');
  assert.equal(state.questionAnswers.length, 1);
  assert.equal(state.questionAnswers[0].score, 60);
  assert.equal(state.questionAnswers[0].diagnosisCorrect, false);
  assert.ok(state.axes.reliance > 0);
});

test('guardian bosses must be fully cleared before rewards and dialogue', function () {
  const state = H.makeRun();
  H.buff(state);
  H.begin(state, 10);
  assert.ok(H.findBoss(state));
  killAll(state);
  assert.equal(state.phase, 'reward');
  assert.ok(state.pendingBossDialogue);
  assert.ok(state.pendingBossReward);
  const choice = state.pendingBossDialogue.choices[0];
  const applied = H.P.applyBossDialogue(state, choice.id);
  assert.equal(applied.ok, true);
  assert.equal(state.pendingBossDialogue, null);
  assert.ok(state.axes.knowledge + state.axes.critical > 0);
});

test('the final boss drops the rune and the final dialogue resolves an ending', function () {
  const state = H.makeRun();
  H.buff(state);
  H.begin(state, 40);
  assert.ok(H.findBoss(state));
  killAll(state);
  assert.equal(state.phase, 'rune');
  assert.equal(state.monsters.length, 0);
  assert.ok(state.rune);
  const rune = state.rune;
  H.standAdjacent(state, rune);
  const move = H.P.movePlayer(state, rune.x, rune.y);
  assert.equal(move.ok, true);
  assert.equal(state.phase, 'dialogue');
  const ending = H.P.applyFinalDialogue(state, 'home');
  assert.equal(ending.ok, true);
  assert.equal(ending.endingId, 'rice');
  assert.equal(state.phase, 'ending');
  assert.equal(state.result, 'victory');
});

test('weapon upgrades spend Tokens and stop at max level', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  state.phase = 'reward';
  state.player.tokens = 100;
  const cost = H.CONFIG.combat.weaponCostBase;
  const first = H.P.upgradeWeapon(state);
  assert.equal(first.ok, true);
  assert.equal(state.player.tokens, 100 - cost);
  state.player.weapon.level = H.CONFIG.weapons.axe.maxLevel;
  assert.equal(H.P.upgradeWeapon(state).ok, false);
});

test('rice heals a share of max health', function () {
  const state = H.makeRun();
  H.begin(state, 1);
  state.player.rice = 1;
  state.player.hp = 10;
  const result = H.P.useRice(state);
  assert.equal(result.ok, true);
  assert.equal(state.player.rice, 0);
  assert.ok(state.player.hp > 10);
  assert.equal(state.stats.riceEaten, 1);
});
