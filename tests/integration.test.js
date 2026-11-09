'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { simulateRun } = require('../tools/simulate.js');
const CONFIG = require('../js/core/config.js').CONFIG;
const Endings = require('../js/core/endings.js');

const endingIds = Endings.ENDINGS.map(function (ending) { return ending.id; });

test('heuristic bot completes full runs without stalling', function () {
  const runs = [];
  for (const cls of ['warrior', 'mage']) {
    for (let seed = 1; seed <= 6; seed += 1) {
      runs.push(simulateRun({ classId: cls, seed: seed }));
    }
  }
  runs.forEach(function (run) {
    assert.ok(run.result === 'victory' || run.result === 'defeat', 'unexpected result: ' + run.result);
    assert.ok(run.stage >= 1 && run.stage <= CONFIG.campaign.stages, 'stage out of range: ' + run.stage);
    assert.ok(run.kills >= 0);
    assert.ok(run.tokens >= 0);
    assert.ok(run.questions >= 0 && run.questions <= 10);
    assert.ok(run.weapon >= 1 && run.weapon <= 20);
    assert.ok(run.slots >= 4 && run.slots <= 8);
    assert.ok(run.maxHp >= run.hp);
    if (run.result === 'victory') {
      assert.ok(endingIds.indexOf(run.ending) >= 0, 'unknown ending: ' + run.ending);
    }
  });
});

test('the 40-stage campaign is beatable with the current balance', function () {
  const runs = [];
  for (let seed = 1; seed <= 16; seed += 1) {
    runs.push(simulateRun({ classId: 'warrior', seed: seed }));
  }
  const wins = runs.filter(function (run) { return run.result === 'victory'; }).length;
  assert.ok(wins >= 1, 'expected at least one simulated victory, got ' + wins);
  assert.ok(wins <= 15, 'expected the campaign not to be trivially winnable, got ' + wins);
  runs.filter(function (run) { return run.result === 'victory'; }).forEach(function (run) {
    assert.ok(run.ending, 'victory must have an ending');
  });
});

test('the campaign is 40 stages with bosses at 10/20/30/40', function () {
  assert.equal(CONFIG.campaign.stages, 40);
  assert.deepEqual(CONFIG.campaign.bossStages, [10, 20, 30, 40]);
  assert.equal(CONFIG.campaign.caseStartLevel, 4);
  assert.equal(CONFIG.campaign.caseEvery, 4);
});

test('runs are deterministic for a fixed seed', function () {
  const first = simulateRun({ classId: 'mage', seed: 42 });
  const second = simulateRun({ classId: 'mage', seed: 42 });
  assert.deepEqual(first, second);
});
